"""Deep insights generation service using LLM.

This service generates detailed, quantifiable insights from candidate resumes.
The insights are designed to:
1. Help HR make faster decisions
2. Identify startup mindset signals
3. Provide actionable areas to probe during interviews
4. Generate scores that can be used for ranking
"""
import json
import logging
from typing import Optional, Dict, Any
import httpx

from config import OPENROUTER_API_KEY, OPENROUTER_INSIGHTS_MODEL

logger = logging.getLogger(__name__)

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1/chat/completions"


INSIGHTS_PROMPT = """You are a CRITICAL and DISCERNING hiring analyst for a startup. Your job is to provide honest, sometimes harsh assessments. Do NOT inflate scores - most candidates are average (50-65), some are good (66-79), and only exceptional candidates score 80+.

CRITICAL: Return ONLY valid JSON. No markdown, no explanation, just the JSON object.

## JOB REQUIREMENTS (This is what we're hiring for):
---
Job Title: {job_title}
Job Description: {job_description}

Required Skills: {required_skills}
Nice-to-Have Skills: {nice_to_have_skills}
Experience Required: {experience_required}
Education Required: {education_required}
---

## CANDIDATE RESUME:
---
{resume_text}
---

## YOUR TASK:
Evaluate how well this candidate matches the SPECIFIC job above. Not a generic analysis - score them against the actual requirements.

Return a JSON object with this EXACT structure:

{{
  "scores": {{
    "overall_score": <0-100 - MOST candidates should be 40-70. Only exceptional matches 80+>,
    "technical_depth": <0-100 - Do they have DEPTH in required skills or just surface knowledge?>,
    "experience_relevance": <0-100 - Is their experience DIRECTLY relevant to this job?>,
    "education_quality": <0-100 - Does education match role needs?>,
    "startup_mindset": <0-100 - Evidence of scrappiness, ownership, moving fast?>,
    "communication_signals": <0-100 - Resume clarity, quantified achievements?>
  }},
  
  "mindset": {{
    "startup_fit": <boolean - would they thrive in a fast, ambiguous startup?>,
    "fit_level": "<'high', 'medium', or 'low'>",
    "positive_signals": [<SPECIFIC quotes or evidence from resume - not generic praise>],
    "concerns": [<Be honest - what concerns you about this candidate?>],
    "culture_indicators": [<What environment do they seem to prefer?>]
  }},
  
  "technical": {{
    "primary_skills": [<Their actual top skills>],
    "skill_depth": {{<skill: "expert"|"intermediate"|"beginner" - be realistic>}},
    "missing_skills": [<REQUIRED skills from job that they DON'T have>],
    "tech_trajectory": "<Are they growing technically or stagnant?>",
    "standout_technical": "<What's actually impressive, if anything? 'Nothing notable' is valid>"
  }},
  
  "experience": {{
    "total_years": <number or null>,
    "highlights": [<Only genuinely impressive achievements with NUMBERS>],
    "trajectory": "<Growing, stable, or declining? Be honest>",
    "red_flags": [<Job hopping, gaps, vague descriptions, no impact metrics>],
    "company_types": [<startup, mid-size, enterprise, consulting, academic>],
    "leadership_signals": [<Real evidence only, not generic claims>]
  }},
  
  "summary": {{
    "headline": "<One honest line - can be critical if warranted>",
    "top_strengths": [<Only list if genuinely strong - can be empty>],
    "key_concerns": [<Be thorough - what would you probe in interview?>],
    "areas_to_probe": [<Specific questions based on gaps or concerns>],
    "quick_verdict": "<'strong_yes'=exceptional match, 'yes'=good match, 'maybe'=unclear, 'no'=poor match, 'strong_no'=clear mismatch>"
  }},
  
  "job_match": {{
    "required_skills_match": [<Which required skills they have with evidence>],
    "required_skills_missing": [<Which required skills they're MISSING>],
    "match_percentage": <0-100 - % of required skills matched>,
    "experience_gap": "<Do they have enough years? Honest assessment>",
    "overall_fit_for_role": "<Direct assessment: 'strong fit', 'moderate fit', 'weak fit', 'poor fit'>"
  }}
}}

## SCORING CALIBRATION (Be strict):
- 90-100: Exceptional - perfect for the role, rare candidate
- 80-89: Strong - clearly above average, interview priority
- 70-79: Good - solid candidate, worth considering
- 60-69: Average - typical candidate, proceed with caution
- 50-59: Below average - notable gaps or concerns
- 40-49: Weak - significant mismatches with requirements
- Below 40: Poor fit - doesn't match the role

## WHAT MAKES A GENUINELY STRONG CANDIDATE:
- SPECIFIC metrics: "Reduced API latency by 40%" not "improved performance"
- REQUIRED skills with demonstrated depth, not just listed
- Experience at relevant companies (startups if startup role)
- Projects showing ownership, not just "worked on"
- Career progression that makes sense

## RED FLAGS TO HEAVILY PENALIZE:
- Lists skills without demonstrating usage
- No quantified achievements
- Vague descriptions: "responsible for", "helped with", "participated in"
- Skills listed but no relevant projects
- Mismatch between claimed experience and job titles
- Missing REQUIRED skills from job posting

Be honest. It's better to say "maybe" than to give a false "strong_yes".

Return ONLY the JSON object, nothing else."""


async def generate_insights(
    resume_text: str,
    job_title: Optional[str] = None,
    job_description: Optional[str] = None,
    job_requirements: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Generate deep insights from resume text using LLM.
    
    Args:
        resume_text: The extracted text content from a resume
        job_title: Title of the job position
        job_description: Full job description text
        job_requirements: Structured job requirements (skills, experience, etc.)
        
    Returns:
        Dict containing structured insights with scores
    """
    logger.info(f"generate_insights called. API key present: {bool(OPENROUTER_API_KEY)}, resume_text length: {len(resume_text) if resume_text else 0}")
    
    if not OPENROUTER_API_KEY:
        logger.warning("OPENROUTER_API_KEY not set, returning default insights")
        return _default_insights()
    
    if not resume_text or len(resume_text.strip()) < 50:
        logger.warning(f"Resume text too short or empty: {len(resume_text) if resume_text else 0} chars")
        return _default_insights()
    
    # Extract job details for prompt
    req = job_requirements or {}
    required_skills = ", ".join(req.get("skills", [])) or "Not specified"
    nice_to_have = ", ".join(req.get("nice_to_have", [])) or "None specified"
    experience_required = f"{req.get('experience_years', 'Not specified')} years" if req.get('experience_years') else "Not specified"
    education_required = req.get("education", "Not specified") or "Not specified"
    
    logger.info(f"Calling OpenRouter API with model: {OPENROUTER_INSIGHTS_MODEL}")
    logger.info(f"Job context - Title: {job_title}, Required skills: {required_skills}")
    
    try:
        async with httpx.AsyncClient(timeout=90.0) as client:
            response = await client.post(
                OPENROUTER_BASE_URL,
                headers={
                    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "http://localhost:8000",
                    "X-Title": "Hiring Co-Pilot - Insights"
                },
                json={
                    "model": OPENROUTER_INSIGHTS_MODEL,
                    "messages": [
                        {
                            "role": "user",
                            "content": INSIGHTS_PROMPT.format(
                                resume_text=resume_text[:12000],
                                job_title=job_title or "Software Engineer",
                                job_description=job_description or "General software development role",
                                required_skills=required_skills,
                                nice_to_have_skills=nice_to_have,
                                experience_required=experience_required,
                                education_required=education_required
                            )
                        }
                    ],
                    "temperature": 0.05,  # Very low temperature for consistent, critical analysis
                    "max_tokens": 2000
                }
            )
            
            if response.status_code != 200:
                logger.error(f"OpenRouter API error: {response.status_code} - {response.text}")
                return _default_insights()
            
            data = response.json()
            content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
            
            # Parse and validate the response
            insights = _parse_insights_response(content)
            insights["_raw_response"] = content  # Store for debugging
            
            logger.info(f"Generated insights: overall_score={insights.get('scores', {}).get('overall_score')}")
            return insights
            
    except httpx.TimeoutException:
        logger.error("OpenRouter API timeout during insights generation")
        return _default_insights()
    except Exception as e:
        logger.error(f"Insights generation failed: {e}")
        return _default_insights()


def _parse_insights_response(content: str) -> Dict[str, Any]:
    """Parse the LLM response to extract insights JSON."""
    # Clean up markdown if present
    content = content.strip()
    if content.startswith("```json"):
        content = content[7:]
    if content.startswith("```"):
        content = content[3:]
    if content.endswith("```"):
        content = content[:-3]
    content = content.strip()
    
    try:
        result = json.loads(content)
        
        # Validate required structure
        if "scores" not in result:
            result["scores"] = {}
        if "mindset" not in result:
            result["mindset"] = {}
        if "technical" not in result:
            result["technical"] = {}
        if "experience" not in result:
            result["experience"] = {}
        if "summary" not in result:
            result["summary"] = {}
        if "job_match" not in result:
            result["job_match"] = {}
        
        # Ensure score values are valid
        scores = result.get("scores", {})
        for key in ["overall_score", "technical_depth", "experience_relevance", 
                    "education_quality", "startup_mindset", "communication_signals"]:
            if key in scores:
                try:
                    scores[key] = max(0, min(100, int(scores[key])))
                except (ValueError, TypeError):
                    scores[key] = 50
        
        return result
        
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse insights JSON: {e}")
        return _default_insights()


def _default_insights() -> Dict[str, Any]:
    """Return default insights structure when LLM is unavailable."""
    return {
        "scores": {
            "overall_score": None,
            "technical_depth": None,
            "experience_relevance": None,
            "education_quality": None,
            "startup_mindset": None,
            "communication_signals": None
        },
        "mindset": {
            "startup_fit": None,
            "fit_level": "unknown",
            "positive_signals": [],
            "concerns": ["Unable to generate AI analysis"],
            "culture_indicators": []
        },
        "technical": {
            "primary_skills": [],
            "skill_depth": {},
            "missing_skills": [],
            "tech_trajectory": "Unable to analyze",
            "standout_technical": None
        },
        "experience": {
            "total_years": None,
            "highlights": [],
            "trajectory": "Unable to analyze",
            "red_flags": [],
            "company_types": [],
            "leadership_signals": []
        },
        "summary": {
            "headline": "Analysis unavailable",
            "top_strengths": [],
            "key_concerns": ["AI analysis not available"],
            "areas_to_probe": ["Review resume manually"],
            "quick_verdict": "maybe"
        },
        "_error": "LLM analysis unavailable"
    }


def insights_to_db_format(insights: Dict[str, Any]) -> Dict[str, Any]:
    """Convert insights dict to database model format."""
    scores = insights.get("scores", {})

    def _coerce_int(value):
        if value is None:
            return None
        try:
            return int(value)
        except (ValueError, TypeError):
            return None

    return {
        "overall_score": _coerce_int(scores.get("overall_score")),
        "technical_depth_score": _coerce_int(scores.get("technical_depth")),
        "experience_relevance_score": _coerce_int(scores.get("experience_relevance")),
        "education_score": _coerce_int(scores.get("education_quality")),
        "startup_mindset_score": _coerce_int(scores.get("startup_mindset")),
        "communication_score": _coerce_int(scores.get("communication_signals")),
        "scores_breakdown": scores,
        "mindset_analysis": insights.get("mindset"),
        "technical_analysis": insights.get("technical"),
        "experience_analysis": insights.get("experience"),
        "summary": insights.get("summary"),
        "job_match": insights.get("job_match"),
        "raw_response": insights.get("_raw_response"),
    }
