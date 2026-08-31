"""Question Bank (QB) Generator Service.

Generates interview question banks with suggested answers based on:
- Job Description (JD) requirements
- Candidate's resume and experience
- Core technical fundamentals
- Behavioral/startup mindset questions
- Candidate insights (strengths, concerns, areas to probe)
- Previous round reviews (for later rounds)
- LeetCode questions matching candidate skills
"""
import logging
import json
import json5
import httpx
import re
from typing import Optional, Dict, List, Any
from fastapi import HTTPException

import config
from services.leetcode_questions import get_leetcode_questions_for_skills

logger = logging.getLogger(__name__)


class QBGeneratorService:
    """Generates interview question banks with answers using LLM."""
    
    def __init__(self):
        self.api_key = config.OPENROUTER_API_KEY
        self.model = config.OPENROUTER_INSIGHTS_MODEL  # Use the insights model for better quality
        self.api_url = "https://openrouter.ai/api/v1/chat/completions"
    
    def is_configured(self) -> bool:
        """Check if the service is properly configured."""
        return bool(self.api_key)
    
    async def generate_question_bank(
        self,
        resume_text: str,
        job_description: str,
        job_requirements: Optional[Dict[str, Any]] = None,
        candidate_skills: Optional[List[str]] = None,
        focus_areas: Optional[List[str]] = None,
        insights: Optional[Dict[str, Any]] = None,
        previous_reviews: Optional[List[Dict[str, Any]]] = None,
        round_number: int = 1
    ) -> Dict[str, Any]:
        """Generate a comprehensive question bank with suggested answers for an interview.
        
        Args:
            resume_text: Full text of the candidate's resume
            job_description: Job description text
            job_requirements: Structured requirements (skills, experience, etc.)
            candidate_skills: List of candidate's skills (from parsing)
            focus_areas: Optional specific areas to focus on
            insights: Candidate insights (scores, strengths, concerns, areas_to_probe)
            previous_reviews: List of reviews from previous interview rounds
            round_number: Current interview round number (1, 2, etc.)
            
        Returns:
            Dictionary containing categorized questions with suggested answers
        """
        if not self.is_configured():
            logger.warning("QB Generator not configured - API key missing")
            return self._get_fallback_questions(job_requirements, candidate_skills, insights)
        
        # Build the prompt with enhanced context
        prompt = self._build_enhanced_prompt(
            resume_text, 
            job_description, 
            job_requirements, 
            candidate_skills,
            focus_areas,
            insights,
            previous_reviews,
            round_number
        )
        
        try:
            async with httpx.AsyncClient(timeout=90.0) as client:
                response = await client.post(
                    self.api_url,
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                        "HTTP-Referer": "http://localhost:8000",
                        "X-Title": "Hiring Platform QB Generator"
                    },
                    json={
                        "model": self.model,
                        "messages": [
                            {
                                "role": "system",
                                "content": self._get_system_prompt(round_number)
                            },
                            {
                                "role": "user", 
                                "content": prompt
                            }
                        ],
                        "temperature": 0.7,
                        "max_tokens": 8000
                    }
                )
                
                response.raise_for_status()
                data = response.json()
                
                # Parse the LLM response
                content = data["choices"][0]["message"]["content"]
                result = self._parse_response(content)
                
                # Add LeetCode questions based on skills
                if candidate_skills:
                    leetcode_questions = get_leetcode_questions_for_skills(candidate_skills)
                    result["leetcode_questions"] = leetcode_questions
                
                return result
                
        except httpx.HTTPError as e:
            logger.error(f"HTTP error generating QB: {str(e)}")
            return self._get_fallback_questions(job_requirements, candidate_skills, insights)
        except Exception as e:
            logger.error(f"Error generating QB: {str(e)}")
            return self._get_fallback_questions(job_requirements, candidate_skills, insights)
    
    def _get_system_prompt(self, round_number: int) -> str:
        """Get the system prompt based on round number."""
        base_prompt = """You are an expert technical interviewer and hiring manager. 
Your task is to generate comprehensive, thoughtful interview questions WITH suggested answers that:
1. Test fundamental knowledge in the relevant domain
2. Probe specific claims and experiences from the candidate's resume
3. Assess problem-solving ability and technical depth
4. Evaluate startup mindset and cultural fit

For each question, provide a suggested "ideal answer" that shows what a strong candidate would say.
Generate questions that are specific, actionable, and designed to reveal true competency.
Always respond with valid JSON only, no markdown formatting."""

        if round_number > 1:
            base_prompt += f"""

IMPORTANT: This is Round {round_number} interview. You must:
1. SKIP areas already validated as strong (gold areas) - don't repeat questions about proven strengths
2. DIG DEEPER into areas of concern or weakness (grey areas) - create probing questions
3. Build on context from previous rounds - reference specific feedback
4. Ask more advanced/nuanced questions since basics were covered in earlier rounds"""
        
        return base_prompt
    
    def _build_enhanced_prompt(
        self,
        resume_text: str,
        job_description: str,
        job_requirements: Optional[Dict[str, Any]],
        candidate_skills: Optional[List[str]],
        focus_areas: Optional[List[str]],
        insights: Optional[Dict[str, Any]],
        previous_reviews: Optional[List[Dict[str, Any]]],
        round_number: int
    ) -> str:
        """Build the enhanced prompt with insights and review context."""
        
        requirements_text = ""
        if job_requirements:
            skills = job_requirements.get("skills", [])
            exp_years = job_requirements.get("experience_years", "Not specified")
            nice_to_have = job_requirements.get("nice_to_have", [])
            requirements_text = f"""
Job Requirements:
- Required Skills: {', '.join(skills) if skills else 'Not specified'}
- Experience: {exp_years} years
- Nice to Have: {', '.join(nice_to_have) if nice_to_have else 'None specified'}
"""
        
        skills_text = ""
        if candidate_skills:
            skills_text = f"\nCandidate's Listed Skills: {', '.join(candidate_skills)}"
        
        focus_text = ""
        if focus_areas:
            focus_text = f"\n\n**Special Focus Areas**: Please emphasize questions related to: {', '.join(focus_areas)}"
        
        # Add insights context
        insights_text = ""
        if insights:
            insights_text = "\n\n## AI-Generated Candidate Insights\n"
            
            # Add scores
            if insights.get("scores"):
                insights_text += "### Scores (0-100 scale):\n"
                for key, value in insights["scores"].items():
                    if value is not None:
                        insights_text += f"- {key.replace('_', ' ').title()}: {value}\n"
            
            # Add summary
            summary = insights.get("summary", {})
            if summary.get("headline"):
                insights_text += f"\n### Headline: {summary['headline']}\n"
            
            if summary.get("top_strengths"):
                insights_text += "\n### Validated Strengths (GOLD AREAS - skip or verify briefly):\n"
                for s in summary["top_strengths"]:
                    insights_text += f"- ✅ {s}\n"
            
            if summary.get("key_concerns"):
                insights_text += "\n### Areas of Concern (GREY AREAS - probe deeply):\n"
                for c in summary["key_concerns"]:
                    insights_text += f"- ⚠️ {c}\n"
            
            if summary.get("areas_to_probe"):
                insights_text += "\n### Specific Areas to Probe:\n"
                for a in summary["areas_to_probe"]:
                    insights_text += f"- 🔍 {a}\n"
            
            if summary.get("quick_verdict"):
                insights_text += f"\n### Quick Verdict: {summary['quick_verdict']}\n"
        
        # Add previous review context for later rounds
        reviews_text = ""
        if previous_reviews and len(previous_reviews) > 0:
            reviews_text = "\n\n## Previous Interview Round Reviews\n"
            reviews_text += "**IMPORTANT: Use this feedback to tailor your questions. Skip validated areas, probe weaknesses.**\n\n"
            
            for i, review in enumerate(previous_reviews):
                round_num = review.get("round_number", i + 1)
                reviews_text += f"### Round {round_num} Review:\n"
                
                if review.get("overall_rating"):
                    reviews_text += f"- Overall Rating: {review['overall_rating']}/5\n"
                
                ratings = []
                if review.get("technical_skills"):
                    ratings.append(f"Technical: {review['technical_skills']}/5")
                if review.get("communication"):
                    ratings.append(f"Communication: {review['communication']}/5")
                if review.get("problem_solving"):
                    ratings.append(f"Problem Solving: {review['problem_solving']}/5")
                if review.get("cultural_fit"):
                    ratings.append(f"Cultural Fit: {review['cultural_fit']}/5")
                if ratings:
                    reviews_text += f"- Ratings: {', '.join(ratings)}\n"
                
                if review.get("strengths"):
                    reviews_text += f"- **STRENGTHS (GOLD AREAS)**: {review['strengths']}\n"
                
                if review.get("areas_for_improvement"):
                    reviews_text += f"- **WEAKNESSES (PROBE DEEPER)**: {review['areas_for_improvement']}\n"
                
                if review.get("notes"):
                    reviews_text += f"- Notes: {review['notes']}\n"
                
                if review.get("recommendation"):
                    reviews_text += f"- Recommendation: {review['recommendation'].replace('_', ' ').upper()}\n"
                
                reviews_text += "\n"
        
        # Build the full prompt
        round_context = ""
        if round_number > 1:
            round_context = f"""
## Interview Context
This is **Round {round_number}** of the interview process.
- Focus on areas NOT yet validated
- Ask more advanced questions in validated skill areas
- Dig deep into any concerns from previous rounds
"""
        
        return f"""Generate a comprehensive interview question bank WITH SUGGESTED ANSWERS based on the following:

## Job Description
{job_description}
{requirements_text}

## Candidate Resume
{resume_text[:5000]}
{skills_text}
{insights_text}
{reviews_text}
{round_context}
{focus_text}

Generate questions in the following categories. Each question should have a "question" and "suggested_answer" field.
Return ONLY valid JSON with this exact structure:

{{
    "jd_based_questions": [
        {{
            "question": "Technical question about JD requirement",
            "suggested_answer": "What a strong candidate would answer, including key points to look for"
        }}
        // 5-7 questions directly testing skills required in the job description
    ],
    "fundamental_questions": [
        {{
            "question": "Core concept question relevant to the candidate's claimed skills",
            "suggested_answer": "Expected answer demonstrating solid fundamentals"
        }}
        // 5-7 questions testing core fundamentals based on THEIR specific skills (not generic)
    ],
    "resume_questions": [
        {{
            "question": "Question about specific project or claim from resume",
            "suggested_answer": "What to expect if their resume claims are genuine (be specific to this candidate)"
        }}
        // 5-7 questions probing specific projects, achievements, or claims from the resume
    ],
    "behavioral_questions": [
        {{
            "question": "Behavioral/STAR format question",
            "suggested_answer": "Signs of startup mindset: ownership, resourcefulness, learning from failure"
        }}
        // 4-5 questions assessing startup mindset, ownership, handling ambiguity
    ],
    "insights_based_questions": [
        {{
            "question": "Question targeting specific insight or area to probe",
            "suggested_answer": "What would indicate the concern is addressed vs still a red flag"
        }}
        // 3-5 questions based on AI insights - probe concerns, verify strengths
    ],
    "follow_up_topics": [
        "Area to probe deeper based on candidate's background"
        // 3-4 topics as simple strings
    ],
    "red_flag_probes": [
        {{
            "question": "Question to investigate concern",
            "suggested_answer": "What a satisfactory vs concerning answer would look like"
        }}
        // 2-3 questions to investigate gaps or concerns
    ]
}}

IMPORTANT GUIDELINES:
- Make questions specific and actionable. Avoid generic questions.
- For resume questions, reference ACTUAL projects or experiences mentioned in this resume.
- For fundamental questions, base them on the candidate's ACTUAL listed skills (e.g., if they know Python, ask Python-specific fundamentals).
- Suggested answers should help interviewers evaluate responses.
- Include what to look for in a strong answer vs red flags.
- If insights mention areas to probe, create targeted questions for those areas.
{"- SKIP areas validated as strong in previous rounds, focus on unvalidated skills and concerns." if round_number > 1 else ""}
"""
    
    def _build_prompt(
        self,
        resume_text: str,
        job_description: str,
        job_requirements: Optional[Dict[str, Any]],
        candidate_skills: Optional[List[str]],
        focus_areas: Optional[List[str]]
    ) -> str:
        """Build the prompt for question generation with answers (legacy - kept for compatibility)."""
        return self._build_enhanced_prompt(
            resume_text, job_description, job_requirements, 
            candidate_skills, focus_areas, None, None, 1
        )

    def _parse_response(self, content: str) -> Dict[str, Any]:
        """Parse the LLM response into structured question bank with answers."""
        try:
            # Try to extract JSON from the response
            content = content.strip()
            
            # Handle if wrapped in markdown code blocks
            if content.startswith("```json"):
                content = content[7:]
            if content.startswith("```"):
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]
            
            questions = json.loads(content.strip())
            
            # Ensure all expected fields exist
            return {
                "jd_based_questions": questions.get("jd_based_questions", []),
                "fundamental_questions": questions.get("fundamental_questions", []),
                "resume_questions": questions.get("resume_questions", []),
                "behavioral_questions": questions.get("behavioral_questions", []),
                "insights_based_questions": questions.get("insights_based_questions", []),
                "follow_up_topics": questions.get("follow_up_topics", []),
                "red_flag_probes": questions.get("red_flag_probes", []),
                "generated": True
            }
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse QB response as JSON: {e}")
            logger.debug(f"Raw content: {content[:500]}")
            return self._get_fallback_questions(None, None, None)
    
    def _get_fallback_questions(
        self,
        job_requirements: Optional[Dict[str, Any]],
        candidate_skills: Optional[List[str]],
        insights: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Return fallback questions with answers when LLM is unavailable."""
        
        jd_questions = []
        if job_requirements and job_requirements.get("skills"):
            for skill in job_requirements["skills"][:5]:
                jd_questions.append({
                    "question": f"Can you describe your experience with {skill}?",
                    "suggested_answer": f"Look for: specific projects, depth of knowledge, hands-on experience with {skill}"
                })
        
        skill_questions = []
        if candidate_skills:
            for skill in candidate_skills[:3]:
                skill_questions.append({
                    "question": f"Tell me about a project where you used {skill} extensively.",
                    "suggested_answer": f"Look for: concrete examples, measurable impact, understanding of {skill} best practices"
                })
        
        # Generate insights-based questions if insights are available
        insights_questions = []
        if insights:
            summary = insights.get("summary", {})
            areas_to_probe = summary.get("areas_to_probe", [])
            key_concerns = summary.get("key_concerns", [])
            
            for area in areas_to_probe[:2]:
                insights_questions.append({
                    "question": f"Tell me more about your experience with {area}.",
                    "suggested_answer": f"Look for: concrete examples, depth of understanding, honest self-assessment regarding {area}"
                })
            
            for concern in key_concerns[:2]:
                insights_questions.append({
                    "question": f"I noticed {concern}. Can you help me understand this better?",
                    "suggested_answer": "Look for: honest acknowledgment, concrete improvements made, learning mindset"
                })
        
        # Get LeetCode questions
        leetcode_questions = []
        if candidate_skills:
            leetcode_questions = get_leetcode_questions_for_skills(candidate_skills)
        
        return {
            "jd_based_questions": jd_questions or [
                {
                    "question": "What experience do you have with the core technologies mentioned in this role?",
                    "suggested_answer": "Look for: specific examples, depth of experience, relevant projects"
                },
                {
                    "question": "How does your background align with the requirements of this position?",
                    "suggested_answer": "Look for: self-awareness, concrete connections between experience and role"
                }
            ],
            "fundamental_questions": [
                {
                    "question": "Can you explain your approach to solving complex technical problems?",
                    "suggested_answer": "Look for: structured thinking, breaking down problems, consideration of trade-offs"
                },
                {
                    "question": "Describe how you ensure code quality in your work.",
                    "suggested_answer": "Look for: testing practices, code reviews, documentation, CI/CD awareness"
                },
                {
                    "question": "What's your experience with system design and architecture?",
                    "suggested_answer": "Look for: scalability thinking, understanding of distributed systems, practical experience"
                },
                {
                    "question": "How do you approach debugging difficult issues?",
                    "suggested_answer": "Look for: systematic approach, use of tools, logging/monitoring awareness"
                }
            ],
            "resume_questions": skill_questions or [
                {
                    "question": "Walk me through your most impactful project.",
                    "suggested_answer": "Look for: clear problem statement, their specific role, measurable outcomes"
                },
                {
                    "question": "What was your specific contribution to your most recent team?",
                    "suggested_answer": "Look for: clear ownership, collaboration, technical or leadership growth"
                },
                {
                    "question": "Describe a technical challenge you overcame.",
                    "suggested_answer": "Look for: problem-solving approach, learning, resilience"
                }
            ],
            "behavioral_questions": [
                {
                    "question": "Tell me about a time you had to work with ambiguous requirements.",
                    "suggested_answer": "Look for: proactive clarification, MVP thinking, stakeholder communication"
                },
                {
                    "question": "Describe a situation where you took ownership beyond your defined role.",
                    "suggested_answer": "Look for: initiative, impact-driven thinking, not waiting for permission"
                },
                {
                    "question": "How do you handle tight deadlines and competing priorities?",
                    "suggested_answer": "Look for: prioritization skills, communication, quality trade-offs awareness"
                },
                {
                    "question": "Tell me about a failure and what you learned from it.",
                    "suggested_answer": "Look for: genuine reflection, growth mindset, concrete changes made"
                }
            ],
            "insights_based_questions": insights_questions or [],
            "follow_up_topics": [
                "Technical depth in claimed skills",
                "Team collaboration style",
                "Growth mindset indicators"
            ],
            "red_flag_probes": [
                {
                    "question": "What made you leave your previous positions?",
                    "suggested_answer": "Look for: professional reasons, growth-oriented thinking. Red flags: blaming others, frequent job-hopping without explanation"
                },
                {
                    "question": "Are there any gaps in employment you'd like to explain?",
                    "suggested_answer": "Look for: honest explanation, productive use of time. Red flags: evasiveness, inconsistencies"
                }
            ],
            "leetcode_questions": leetcode_questions,
            "generated": False,
            "fallback_reason": "LLM unavailable or not configured"
        }
    
    def _clean_json_string(self, content: str) -> str:
        """Clean and fix common JSON formatting issues from LLM responses.

        Handles:
        - Markdown code fences
        - Single/multi-line comments
        - Trailing commas
        - Unescaped newlines in strings (attempts to fix)
        """
        # Remove markdown code fences
        content = content.strip()
        if content.startswith("```json"):
            content = content[7:]
        elif content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()

        # Remove single-line comments (// ...)
        content = re.sub(r'//.*?$', '', content, flags=re.MULTILINE)

        # Remove multi-line comments (/* ... */)
        content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)

        # Remove trailing commas before closing brackets/braces
        content = re.sub(r',(\s*[}\]])', r'\1', content)

        # Try to fix unescaped newlines within string values
        # This is a heuristic approach and may not catch all cases
        # Find strings that aren't properly closed before a newline
        # Pattern: "some text\n without closing quote
        def fix_newlines_in_strings(match):
            """Replace actual newlines with escaped newlines in JSON strings."""
            string_content = match.group(1)
            # Replace actual newlines with \n
            fixed = string_content.replace('\n', '\\n').replace('\r', '\\r')
            return f'"{fixed}"'

        # This regex attempts to match strings that may contain unescaped newlines
        # It's not perfect but handles common cases
        try:
            # Match quoted strings and fix newlines within them
            content = re.sub(
                r'"([^"\\]*(?:\\.[^"\\]*)*)"',
                lambda m: '"' + m.group(1).replace('\n', '\\n').replace('\r', '\\r') + '"',
                content,
                flags=re.DOTALL
            )
        except Exception as e:
            logger.warning(f"Failed to fix newlines in JSON: {e}")

        return content

    async def _parse_json_with_fallback(
        self,
        content: str,
        fallback_questions: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Parse JSON with multi-level fallback strategies.

        Strategy 1: Standard JSON parser
        Strategy 2: json5 parser (allows trailing commas, comments)
        Strategy 3: Extract JSON and retry with json5
        Strategy 4: Ask LLM to fix its own JSON (self-correction)

        Returns:
            Parsed dict or None if all strategies fail
        """
        parse_errors = []

        # Clean the content first
        content = self._clean_json_string(content)

        # Strategy 1: Standard JSON parser
        try:
            return json.loads(content)
        except json.JSONDecodeError as e:
            parse_errors.append(f"json.loads: {str(e)}")
            logger.warning(f"Standard JSON parsing failed: {e}")

        # Strategy 2: json5 parser
        try:
            parsed = json5.loads(content)
            logger.info("Successfully parsed with json5")
            return parsed
        except Exception as e:
            parse_errors.append(f"json5.loads: {str(e)}")
            logger.warning(f"json5 parsing failed: {e}")

        # Strategy 3: Extract JSON from text and retry with json5
        json_match = re.search(r'\{[\s\S]*\}', content)
        if json_match:
            extracted = self._clean_json_string(json_match.group(0))
            try:
                parsed = json5.loads(extracted)
                logger.info("Successfully parsed extracted JSON with json5")
                return parsed
            except Exception as e:
                parse_errors.append(f"Extraction + json5: {str(e)}")
                logger.warning(f"Extracted JSON parsing failed: {e}")

        # Strategy 4: Ask LLM to fix its own JSON (self-correction)
        logger.warning("Attempting LLM self-correction for malformed JSON...")
        try:
            fixed_json = await self._fix_json_with_llm(content)
            if fixed_json:
                logger.info("Successfully fixed JSON via LLM self-correction")
                return fixed_json
        except Exception as e:
            parse_errors.append(f"LLM self-correction: {str(e)}")
            logger.error(f"LLM self-correction failed: {e}")

        # All strategies failed
        logger.error(f"All parsing strategies failed. Errors: {'; '.join(parse_errors[:3])}")
        logger.error(f"Failed content (first 1000 chars):\n{content[:1000]}")
        return None

    async def _fix_json_with_llm(self, malformed_json: str) -> Optional[Dict[str, Any]]:
        """Ask the LLM to fix its own malformed JSON.

        Args:
            malformed_json: The malformed JSON string

        Returns:
            Parsed dict or None if correction fails
        """
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    self.api_url,
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                        "HTTP-Referer": "http://localhost:8000",
                        "X-Title": "Hiring Platform QB JSON Fixer"
                    },
                    json={
                        "model": self.model,
                        "messages": [
                            {
                                "role": "system",
                                "content": "You are a JSON fixing assistant. Fix malformed JSON and return ONLY the corrected JSON, nothing else."
                            },
                            {
                                "role": "user",
                                "content": f"Fix this malformed JSON and return ONLY the corrected JSON:\n\n{malformed_json[:2000]}"
                            }
                        ],
                        "temperature": 0.1,
                        "max_tokens": 8000,
                        "response_format": {"type": "json_object"}
                    }
                )

                response.raise_for_status()
                data = response.json()
                fixed_content = data["choices"][0]["message"]["content"]

                # Try to parse the fixed version
                fixed_content = self._clean_json_string(fixed_content)
                return json.loads(fixed_content)

        except Exception as e:
            logger.error(f"LLM self-correction failed: {str(e)}")
            return None

    async def chat_modify_questions(
        self,
        current_questions: Dict[str, Any],
        user_message: str,
        candidate_context: Optional[str] = None,
        chat_history: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """Chat-based modification of question bank with session memory.

        Args:
            current_questions: Current question bank structure
            user_message: User's request (e.g., "Add more system design questions")
            candidate_context: Optional context about the candidate
            chat_history: Previous conversation history for context continuity

        Returns:
            Modified question bank with changes applied
        """
        if not self.is_configured():
            return {
                "success": False,
                "message": "LLM not configured",
                "questions": current_questions
            }

        # Simplify the question bank for the prompt to reduce token count and complexity
        simplified_questions = {}
        for key, value in current_questions.items():
            if isinstance(value, list) and len(value) > 0:
                # For lists with question objects, show structure but limit examples
                if isinstance(value[0], dict) and 'question' in value[0]:
                    simplified_questions[key] = [
                        {"question": q.get("question", ""), "suggested_answer": "..."}
                        for q in value[:2]  # Only show first 2 as examples
                    ]
                    if len(value) > 2:
                        simplified_questions[key].append({"question": f"... ({len(value)-2} more questions)", "suggested_answer": "..."})
                else:
                    simplified_questions[key] = value[:3] if len(value) > 3 else value
            else:
                simplified_questions[key] = value

        prompt = f"""You are a helpful assistant for an interviewer preparing questions.

Current Question Bank Structure (showing examples):
{json.dumps(simplified_questions, indent=2)}

{f"Candidate Context: {candidate_context}" if candidate_context else ""}

User Request: {user_message}

Based on the user's request, modify the question bank.

CRITICAL FORMATTING RULES:
1. Return ONLY valid JSON - no markdown, no explanations before or after
2. Each "question" field must be a single line (use spaces instead of newlines)
3. Each "suggested_answer" must be under 150 characters
4. No trailing commas
5. No comments (// or /* */)
6. Keep questions concise (under 200 characters each)
7. Properly escape all quotes and special characters

Return this exact structure:
{{
    "modification_summary": "Brief one-line description",
    "jd_based_questions": [{{"question": "...", "suggested_answer": "..."}}],
    "fundamental_questions": [{{"question": "...", "suggested_answer": "..."}}],
    "resume_questions": [{{"question": "...", "suggested_answer": "..."}}],
    "behavioral_questions": [{{"question": "...", "suggested_answer": "..."}}],
    "insights_based_questions": [{{"question": "...", "suggested_answer": "..."}}],
    "follow_up_topics": ["...", "..."],
    "red_flag_probes": [{{"question": "...", "suggested_answer": "..."}}]
}}
"""

        # Build conversation messages with history for session-based memory
        messages = [
            {
                "role": "system",
                "content": "You are a helpful interview preparation assistant. Modify question banks based on user requests. CRITICAL: Return ONLY valid JSON with no markdown, no explanations, no trailing commas. Escape all quotes and newlines inside strings properly. Keep suggested_answer fields under 150 characters."
            }
        ]

        # Add chat history for context continuity (session-based memory)
        if chat_history:
            for entry in chat_history[-10:]:  # Last 10 messages to avoid token limits
                role = entry.get("role", "user")
                content = entry.get("content", "")
                if role in ["user", "assistant"]:
                    messages.append({"role": role, "content": content})

        # Add current user message
        messages.append({
            "role": "user",
            "content": prompt
        })

        try:
            # Try with retry logic (2 attempts)
            for attempt in range(2):
                is_retry = attempt > 0

                async with httpx.AsyncClient(timeout=60.0) as client:
                    payload = {
                        "model": self.model,
                        "messages": messages,
                        "temperature": 0.2 if is_retry else 0.3,  # Lower temp on retry
                        "max_tokens": 8000,
                        "response_format": {"type": "json_object"}  # OpenRouter JSON mode
                    }

                    response = await client.post(
                        self.api_url,
                        headers={
                            "Authorization": f"Bearer {self.api_key}",
                            "Content-Type": "application/json",
                            "HTTP-Referer": "http://localhost:8000",
                            "X-Title": "Hiring Platform QB Chat"
                        },
                        json=payload
                    )

                    response.raise_for_status()
                    data = response.json()
                    content = data["choices"][0]["message"]["content"]

                    # Try multiple parsing strategies
                    modified = await self._parse_json_with_fallback(content, current_questions)

                    if modified is not None:
                        # Success!
                        return {
                            "success": True,
                            "message": modified.get("modification_summary", "Questions modified successfully"),
                            "questions": {
                                "jd_based_questions": modified.get("jd_based_questions", current_questions.get("jd_based_questions", [])),
                                "fundamental_questions": modified.get("fundamental_questions", current_questions.get("fundamental_questions", [])),
                                "resume_questions": modified.get("resume_questions", current_questions.get("resume_questions", [])),
                                "behavioral_questions": modified.get("behavioral_questions", current_questions.get("behavioral_questions", [])),
                                "insights_based_questions": modified.get("insights_based_questions", current_questions.get("insights_based_questions", [])),
                                "follow_up_topics": modified.get("follow_up_topics", current_questions.get("follow_up_topics", [])),
                                "red_flag_probes": modified.get("red_flag_probes", current_questions.get("red_flag_probes", [])),
                                "leetcode_questions": current_questions.get("leetcode_questions", []),  # Preserve LeetCode questions
                            }
                        }

                    # Retry with stricter prompt
                    if is_retry:
                        break

                    logger.warning(f"Attempt {attempt + 1} failed, retrying with stricter prompt...")
                    messages.append({
                        "role": "assistant",
                        "content": content  # Show what it said
                    })
                    messages.append({
                        "role": "user",
                        "content": "That response had JSON formatting errors. Please return ONLY the JSON object with proper escaping. No explanations, no markdown."
                    })

            # All attempts failed
            return {
                "success": False,
                "message": "AI returned invalid JSON after multiple attempts. Please try rephrasing your request or use the manual edit buttons.",
                "questions": current_questions
            }

        except httpx.HTTPError as e:
            logger.error(f"HTTP error in chat modification: {str(e)}")
            return {
                "success": False,
                "message": f"Network error: {str(e)}",
                "questions": current_questions
            }
        except Exception as e:
            logger.error(f"Error in chat modification: {str(e)}")
            return {
                "success": False,
                "message": f"Error processing request: {str(e)}",
                "questions": current_questions
            }


# Singleton instance
qb_generator = QBGeneratorService()
