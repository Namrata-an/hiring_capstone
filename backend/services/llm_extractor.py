"""LLM-based resume extraction service using OpenRouter API."""
import os
import json
import logging
import httpx
from typing import Optional

logger = logging.getLogger(__name__)

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1/chat/completions"
# Use a cost-effective model for extraction
DEFAULT_MODEL = os.getenv("OPENROUTER_MODEL", "anthropic/claude-3-haiku")


EXTRACTION_PROMPT = """You are a resume parser. Extract the following information from the resume text provided.

Return a JSON object with these exact fields:
- name: The candidate's full name (string)
- email: The candidate's email address (string or null)
- phone: The candidate's phone number (string or null)  
- skills: A list of technical and professional skills mentioned (array of strings, max 15 most relevant skills)
- experience_years: Total years of work experience (string, e.g., "3", "5-7", "10+")
- current_position: Current or most recent job title (string or null)
- education: Array of education entries, each with:
  - degree: Degree type (e.g., "Bachelor of Science", "Master of Engineering", "BFA")
  - institution: Name of university/college
  - field: Field of study (e.g., "Computer Science", "Graphic Design")
  - years: Years attended (e.g., "2016-2020", "2020-2022")

Important guidelines:
- For skills, focus on technical skills, programming languages, frameworks, tools, and professional competencies
- For experience_years, calculate total years or provide the range mentioned (e.g., "3", "5-7", "10+")
- For current_position, use the most recent job title listed
- For education, include all degrees mentioned with complete details
- Clean up phone numbers to a standard format if possible
- If a field cannot be determined, use null (for strings) or empty array (for skills/education)
- Return ONLY valid JSON, no additional text or markdown

Resume text:
---
{resume_text}
---

Return the JSON object:"""


async def extract_resume_info(resume_text: str) -> dict:
    """
    Extract candidate information from resume text using LLM.
    
    Args:
        resume_text: The extracted text content from a resume PDF
        
    Returns:
        Dict with keys: name, email, phone, skills, experience_years, current_position, education
    """
    if not OPENROUTER_API_KEY:
        logger.warning("OPENROUTER_API_KEY not set, using fallback extraction")
        return _fallback_extraction(resume_text)
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                OPENROUTER_BASE_URL,
                headers={
                    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "http://localhost:8000",
                    "X-Title": "Hiring Co-Pilot"
                },
                json={
                    "model": DEFAULT_MODEL,
                    "messages": [
                        {
                            "role": "user",
                            "content": EXTRACTION_PROMPT.format(resume_text=resume_text[:8000])
                        }
                    ],
                    "temperature": 0.1,
                    "max_tokens": 1000
                }
            )
            
            if response.status_code != 200:
                logger.error(f"OpenRouter API error: {response.status_code} - {response.text}")
                return _fallback_extraction(resume_text)
            
            data = response.json()
            content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
            
            # Parse the JSON response
            extracted = _parse_llm_response(content)
            logger.info(f"LLM extracted: name={extracted.get('name')}, skills_count={len(extracted.get('skills', []))}, experience_years={extracted.get('experience_years')}")
            return extracted
            
    except httpx.TimeoutException:
        logger.error("OpenRouter API timeout")
        return _fallback_extraction(resume_text)
    except Exception as e:
        logger.error(f"LLM extraction failed: {e}")
        return _fallback_extraction(resume_text)


def _parse_llm_response(content: str) -> dict:
    """Parse the LLM response to extract JSON."""
    # Clean up the response - sometimes LLM adds markdown code blocks
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
        # Validate and clean the result
        return {
            "name": result.get("name") if isinstance(result.get("name"), str) else None,
            "email": result.get("email") if isinstance(result.get("email"), str) else None,
            "phone": result.get("phone") if isinstance(result.get("phone"), str) else None,
            "skills": result.get("skills", []) if isinstance(result.get("skills"), list) else [],
            "experience_years": result.get("experience_years") if isinstance(result.get("experience_years"), str) else None,
            "current_position": result.get("current_position") if isinstance(result.get("current_position"), str) else None,
            "education": result.get("education", []) if isinstance(result.get("education"), list) else []
        }
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse LLM JSON response: {e}")
        return {"name": None, "email": None, "phone": None, "skills": [], "experience_years": None, "current_position": None, "education": []}


def _fallback_extraction(resume_text: str) -> dict:
    """Fallback extraction using regex when LLM is unavailable."""
    import re
    from services.resume_parser import extract_basic_info
    
    # Use existing basic extraction
    basic = extract_basic_info(resume_text)
    
    # Simple skill extraction - look for common programming languages and tools
    common_skills = [
        "Python", "JavaScript", "TypeScript", "Java", "C++", "C#", "Go", "Rust", "Ruby", "PHP", "Swift", "Kotlin",
        "React", "Angular", "Vue", "Node.js", "Django", "Flask", "FastAPI", "Spring", "Express",
        "PostgreSQL", "MySQL", "MongoDB", "Redis", "Elasticsearch", "SQLite",
        "AWS", "Azure", "GCP", "Docker", "Kubernetes", "Terraform", "Jenkins", "Git",
        "HTML", "CSS", "SQL", "REST", "GraphQL", "gRPC",
        "Machine Learning", "Deep Learning", "NLP", "Computer Vision", "Data Science",
        "Agile", "Scrum", "CI/CD", "DevOps", "Linux"
    ]
    
    found_skills = []
    text_lower = resume_text.lower()
    for skill in common_skills:
        # Check for skill mention (case-insensitive, word boundary)
        pattern = r'\b' + re.escape(skill.lower()) + r'\b'
        if re.search(pattern, text_lower):
            found_skills.append(skill)
    
    # Try to extract experience years
    experience_years = None
    exp_patterns = [
        r'(\d+)\+?\s*years?\s+(?:of\s+)?(?:work\s+)?experience',
        r'experience[:\s]+(\d+)\+?\s*years?',
        r'(\d+)\+?\s*years?\s+in\s+(?:software|engineering|development)'
    ]
    for pattern in exp_patterns:
        match = re.search(pattern, text_lower)
        if match:
            experience_years = match.group(1)
            break
    
    # Try to extract current position - look for most recent job title patterns
    current_position = None
    job_patterns = [
        r'(?:currently|present)[:\s]+([A-Z][A-Za-z\s&]+?)(?:\s+at|\s+@|\n)',
        r'([A-Z][A-Za-z\s&]+?)\s+\|\s+(?:\d{4}[-–]\s*)?(?:Present|Current)',
    ]
    for pattern in job_patterns:
        match = re.search(pattern, resume_text)
        if match:
            current_position = match.group(1).strip()
            break
    
    return {
        "name": basic.get("name"),
        "email": basic.get("email"),
        "phone": basic.get("phone"),
        "skills": found_skills[:15],  # Limit to 15 skills
        "experience_years": experience_years,
        "current_position": current_position,
        "education": []  # Regex-based education extraction is complex, skip for fallback
    }
