"""Resume parsing service - extract text and structured data from PDF files.

This module provides OCR-based extraction of resume information. The goal is to
extract as much structured data as possible WITHOUT calling an LLM, using regex
patterns and heuristics. LLM calls should only be used for complex analysis.
"""
import io
import logging
import re
from pathlib import Path
from typing import Optional, List, Dict, Any, Union

import httpx
import pdfplumber

logger = logging.getLogger(__name__)


def _extract_text_from_bytes(pdf_bytes: bytes) -> Optional[str]:
    text_parts: List[str] = []
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text)
    full_text = "\n\n".join(text_parts).strip()
    return full_text or None


def extract_text_from_pdf(source: Union[Path, str]) -> Optional[str]:
    """Extract text content from a PDF file or remote URL.

    Args:
        source: Local Path/string OR an https URL to a PDF.
    """
    try:
        if isinstance(source, str) and source.startswith(("http://", "https://")):
            with httpx.Client(timeout=60.0, follow_redirects=True) as client:
                resp = client.get(source)
                resp.raise_for_status()
                pdf_bytes = resp.content
        else:
            with open(source, "rb") as f:
                pdf_bytes = f.read()
        return _extract_text_from_bytes(pdf_bytes)
    except Exception as e:
        logger.error(f"Failed to extract text from PDF {source}: {e}")
        return None


def extract_email(text: str) -> Optional[str]:
    """Extract email address from text."""
    email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
    match = re.search(email_pattern, text)
    return match.group() if match else None


def extract_phone(text: str) -> Optional[str]:
    """Extract phone number from text (supports various formats)."""
    phone_patterns = [
        r'\+91[-.\s]?\d{5}[-.\s]?\d{5}\b',  # +91 98765 43210 (India)
        r'\+91[-.\s]?\d{10}\b',  # +91 9876543210
        r'\b\d{5}[-.\s]?\d{5}\b',  # 98765 43210 (India without country code)
        r'\b\d{10}\b',  # 9876543210
        r'\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b',  # 123-456-7890 (US)
        r'\b\(\d{3}\)\s*\d{3}[-.\s]?\d{4}\b',  # (123) 456-7890
        r'\+\d{1,3}[-.\s]?\d{10}\b',  # +1 1234567890
    ]
    for pattern in phone_patterns:
        match = re.search(pattern, text)
        if match:
            return match.group()
    return None


def extract_name(text: str) -> Optional[str]:
    """Extract candidate name from resume text.
    
    Uses multiple heuristics:
    1. First non-empty line that looks like a name
    2. Common patterns like "Name: John Doe"
    """
    lines = text.split('\n')
    
    # Try pattern-based extraction first
    name_patterns = [
        r'^Name\s*[:\-]\s*(.+)$',
        r'^Full\s*Name\s*[:\-]\s*(.+)$',
    ]
    for line in lines[:10]:  # Check first 10 lines
        line = line.strip()
        for pattern in name_patterns:
            match = re.match(pattern, line, re.IGNORECASE)
            if match:
                return match.group(1).strip()
    
    # Heuristic: first line that looks like a name
    for line in lines[:5]:  # Check first 5 lines
        line = line.strip()
        if not line:
            continue
            
        words = line.split()
        # Skip if too many words or contains numbers/special chars
        if len(words) > 4 or len(words) < 1:
            continue
        if any(char.isdigit() for char in line):
            continue
        # Skip common headers
        skip_words = ['resume', 'curriculum', 'vitae', 'cv', 'profile', 'summary', 
                      'objective', 'contact', 'address', 'phone', 'email']
        if any(word.lower() in skip_words for word in words):
            continue
        # Check if it looks like a name (capitalized words)
        if all(word[0].isupper() for word in words if word):
            return line
    
    return None


def extract_skills(text: str) -> List[str]:
    """Extract skills from resume text using keyword matching.
    
    Returns up to 15 most relevant skills found.
    """
    # Comprehensive skill list
    skill_keywords = [
        # Programming Languages
        "Python", "JavaScript", "TypeScript", "Java", "C++", "C#", "Go", "Rust", 
        "Ruby", "PHP", "Swift", "Kotlin", "Scala", "R", "MATLAB", "Perl", "Shell",
        "Bash", "PowerShell", "SQL", "HTML", "CSS", "Dart", "Objective-C",
        
        # Frontend Frameworks
        "React", "Angular", "Vue", "Vue.js", "Next.js", "Nuxt.js", "Svelte",
        "Redux", "MobX", "jQuery", "Bootstrap", "Tailwind", "Material UI", "Chakra UI",
        
        # Backend Frameworks
        "Node.js", "Express", "Express.js", "Django", "Flask", "FastAPI", "Spring",
        "Spring Boot", "Rails", "Ruby on Rails", "ASP.NET", ".NET", "Laravel", "Symfony",
        "NestJS", "Gin", "Echo", "Fiber",
        
        # Databases
        "PostgreSQL", "MySQL", "MongoDB", "Redis", "Elasticsearch", "SQLite",
        "Oracle", "SQL Server", "DynamoDB", "Cassandra", "Neo4j", "Firebase",
        "Supabase", "PlanetScale", "CockroachDB",
        
        # Cloud & DevOps
        "AWS", "Azure", "GCP", "Google Cloud", "Docker", "Kubernetes", "K8s",
        "Terraform", "Ansible", "Jenkins", "GitHub Actions", "GitLab CI", "CircleCI",
        "Travis CI", "ArgoCD", "Helm", "Pulumi", "CloudFormation",
        
        # Data & ML
        "Machine Learning", "Deep Learning", "NLP", "Computer Vision", "Data Science",
        "TensorFlow", "PyTorch", "Keras", "Scikit-learn", "Pandas", "NumPy",
        "Spark", "Hadoop", "Airflow", "Kafka", "Databricks", "MLflow",
        "OpenCV", "Hugging Face", "LangChain",
        
        # Mobile
        "React Native", "Flutter", "iOS", "Android", "SwiftUI", "Jetpack Compose",
        
        # APIs & Protocols
        "REST", "RESTful", "GraphQL", "gRPC", "WebSocket", "OAuth", "JWT",
        "OpenAPI", "Swagger",
        
        # Testing
        "Jest", "Pytest", "JUnit", "Mocha", "Cypress", "Selenium", "Playwright",
        "TestNG", "RSpec", "Enzyme", "Testing Library",
        
        # Other Tools
        "Git", "Linux", "Unix", "Nginx", "Apache", "RabbitMQ", "Celery",
        "Agile", "Scrum", "Jira", "Confluence", "Figma", "CI/CD", "DevOps",
        "Microservices", "System Design", "Data Structures", "Algorithms",
    ]
    
    found_skills = []
    text_lower = text.lower()
    
    for skill in skill_keywords:
        # Word boundary matching (case-insensitive)
        pattern = r'\b' + re.escape(skill.lower()) + r'\b'
        if re.search(pattern, text_lower):
            # Preserve original casing from keyword list
            found_skills.append(skill)
    
    # Remove duplicates while preserving order
    seen = set()
    unique_skills = []
    for skill in found_skills:
        if skill.lower() not in seen:
            seen.add(skill.lower())
            unique_skills.append(skill)
    
    return unique_skills[:15]


def extract_experience_years(text: str) -> Optional[str]:
    """Extract years of experience from resume text."""
    text_lower = text.lower()
    
    patterns = [
        r'(\d+)\+?\s*(?:years?|yrs?)(?:\s+of)?\s+(?:of\s+)?(?:work\s+)?experience',
        r'experience\s*[:\-]?\s*(\d+)\+?\s*(?:years?|yrs?)',
        r'(\d+)\+?\s*(?:years?|yrs?)\s+(?:of\s+)?(?:work|professional)',
        r'total\s+(?:work\s+)?experience\s*[:\-]?\s*(\d+)\+?\s*(?:years?|yrs?)',
        r'(\d+)\+?\s*(?:years?|yrs?)\s+in\s+(?:software|engineering|development|it|tech)',
        r'over\s+(\d+)\s*(?:years?|yrs?)',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, text_lower)
        if match:
            years = match.group(1)
            # Check if there's a + after the number
            full_match = match.group(0)
            if '+' in full_match:
                return f"{years}+"
            return years
    
    return None


def extract_current_position(text: str) -> Optional[str]:
    """Extract current/most recent job position from resume text.

    This function attempts to identify actual work positions, not aspirational
    statements or educational roles. It filters out lines that indicate the
    candidate is seeking a role or is a student/fresher.
    """
    lines = text.split('\n')

    # Look for patterns indicating current position
    current_patterns = [
        r'(?:current|present)\s*[:\-]?\s*(.+)',
        r'(.+?)\s*[-–|]\s*(?:present|current|till\s+date|now)',
        r'(.+?)\s*\(\s*(?:present|current|till\s+date)\s*\)',
    ]

    for line in lines:
        line = line.strip()
        for pattern in current_patterns:
            match = re.search(pattern, line, re.IGNORECASE)
            if match:
                position = match.group(1).strip()
                # Clean up and validate
                if len(position) > 5 and len(position) < 100:
                    # Remove dates if present at start
                    position = re.sub(r'^\d{4}\s*[-–|]\s*', '', position).strip()
                    # Skip if what remains is just a date or month/year
                    if re.match(r'^[\d\s\-–|/]+$', position):
                        continue
                    if re.match(r'^(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)', position.lower()):
                        continue
                    return position

    # Negative patterns - indicators this is NOT a current position
    # These indicate the person is seeking work, not currently employed
    negative_patterns = [
        r'\b(?:seeking|looking\s+for|aspiring|interested\s+in|applying\s+for)\b',
        r'\b(?:fresher|recent\s+graduate|graduate|student)\b',
        r'\b(?:entry[\s-]level|junior|trainee)\b',
        r'\b(?:objective|career\s+goal|summary)\s*:',
        r'\b(?:no\s+experience|no\s+work|zero\s+experience)\b',
    ]

    # Look for job title patterns near the top, but filter out false positives
    job_title_keywords = [
        'engineer', 'developer', 'manager', 'analyst', 'architect', 'lead',
        'director', 'consultant', 'specialist', 'designer', 'administrator',
        'scientist', 'associate', 'executive', 'coordinator'
    ]

    # Company/employment indicator keywords (strong signals of actual employment)
    employment_indicators = [
        'at ', 'with ', 'for ', '@ ', 'company', 'corporation', 'inc', 'ltd',
        'pvt', 'llc', 'technologies', 'systems', 'solutions'
    ]

    for line in lines[:30]:  # Check first 30 lines
        line_lower = line.lower().strip()

        # Skip if line contains negative patterns
        if any(re.search(pattern, line_lower) for pattern in negative_patterns):
            continue

        if any(keyword in line_lower for keyword in job_title_keywords):
            # Skip if too short or too long
            if len(line) < 10 or len(line) > 80:
                continue

            # Skip if contains year (likely education or date range)
            if re.search(r'\d{4}', line):
                continue

            # Skip lines with too many special chars (likely headers/formatting)
            if line.count('-') >= 3 or line.count('|') >= 2:
                continue

            # Prefer lines with employment indicators (company names, "at X", etc.)
            has_employment_indicator = any(ind in line_lower for ind in employment_indicators)

            # Only return if it has employment indicators OR doesn't contain "intern"
            # (intern alone might be aspirational unless tied to a company)
            if has_employment_indicator:
                return line.strip()
            elif 'intern' not in line_lower:
                # Additional check: must have job title keyword but not be too generic
                # Avoid lines like "Developer" alone - too vague
                if len(line.split()) >= 2:  # At least 2 words (e.g., "Software Engineer")
                    return line.strip()

    return None


def extract_education(text: str) -> List[Dict[str, Any]]:
    """Extract education information from resume text."""
    education_entries = []
    
    # Common degree patterns
    degree_patterns = [
        r"(B\.?Tech|B\.?E\.?|Bachelor(?:'s)?(?:\s+of)?\s+(?:Technology|Engineering|Science|Arts|Commerce))",
        r"(M\.?Tech|M\.?S\.?|M\.?E\.?|Master(?:'s)?(?:\s+of)?\s+(?:Technology|Engineering|Science|Arts|Business|Commerce))",
        r"(MBA|M\.?B\.?A\.?)",
        r"(Ph\.?D\.?|Doctorate)",
        r"(B\.?Sc\.?|Bachelor(?:'s)?\s+of\s+Science)",
        r"(M\.?Sc\.?|Master(?:'s)?\s+of\s+Science)",
        r"(B\.?A\.?|Bachelor(?:'s)?\s+of\s+Arts)",
        r"(M\.?A\.?|Master(?:'s)?\s+of\s+Arts)",
        r"(B\.?Com\.?|Bachelor(?:'s)?\s+of\s+Commerce)",
        r"(BCA|MCA)",
        r"(Diploma)",
    ]
    
    # Common institution keywords
    institution_keywords = [
        'university', 'institute', 'college', 'school', 'academy',
        'iit', 'nit', 'bits', 'iiit', 'vit', 'srm', 'mit', 'stanford',
        'harvard', 'berkeley', 'caltech', 'princeton', 'yale', 'columbia'
    ]
    
    # Field of study patterns
    field_patterns = [
        r"(?:in|of)\s+(Computer\s+Science|Information\s+Technology|Electronics|Electrical|Mechanical|Civil|Chemical|Software)",
        r"(?:in|of)\s+(Data\s+Science|Artificial\s+Intelligence|Machine\s+Learning)",
        r"(?:in|of)\s+(Business\s+Administration|Finance|Marketing|Economics)",
    ]
    
    lines = text.split('\n')
    current_entry = {}
    
    for i, line in enumerate(lines):
        line = line.strip()
        if not line:
            continue
            
        # Check for degree
        for pattern in degree_patterns:
            match = re.search(pattern, line, re.IGNORECASE)
            if match:
                if current_entry.get('degree'):
                    education_entries.append(current_entry)
                    current_entry = {}
                current_entry['degree'] = match.group(1)
                
                # Try to find field in same line
                for field_pattern in field_patterns:
                    field_match = re.search(field_pattern, line, re.IGNORECASE)
                    if field_match:
                        current_entry['field'] = field_match.group(1)
                        break
                break
        
        # Check for institution
        line_lower = line.lower()
        if any(keyword in line_lower for keyword in institution_keywords):
            if not current_entry.get('institution'):
                # Clean up the institution name
                inst_name = line
                # Remove common suffixes/prefixes
                inst_name = re.sub(r'\d{4}\s*[-–]\s*\d{4}', '', inst_name)
                inst_name = re.sub(r'\d{4}\s*[-–]\s*(?:present|current)', '', inst_name, flags=re.IGNORECASE)
                current_entry['institution'] = inst_name.strip()
        
        # Check for years
        year_match = re.search(r'(\d{4})\s*[-–]\s*(\d{4}|present|current)', line, re.IGNORECASE)
        if year_match:
            if not current_entry.get('years'):
                end_year = year_match.group(2)
                if end_year.lower() in ['present', 'current']:
                    current_entry['years'] = f"{year_match.group(1)}-Present"
                else:
                    current_entry['years'] = f"{year_match.group(1)}-{end_year}"
    
    # Don't forget last entry
    if current_entry.get('degree') or current_entry.get('institution'):
        education_entries.append(current_entry)
    
    return education_entries[:5]  # Limit to 5 entries


def extract_all_info_ocr(text: str) -> Dict[str, Any]:
    """Extract all available information from resume text using OCR/regex only.
    
    This function attempts to extract structured data WITHOUT LLM calls.
    Use this for quick extraction; LLM should only be used for complex analysis.
    
    Args:
        text: Resume text content
        
    Returns:
        Dict with all extracted fields
    """
    return {
        "name": extract_name(text),
        "email": extract_email(text),
        "phone": extract_phone(text),
        "skills": extract_skills(text),
        "experience_years": extract_experience_years(text),
        "current_position": extract_current_position(text),
        "education": extract_education(text),
    }


def extract_basic_info(text: str) -> dict:
    """Extract basic candidate info from resume text (legacy function).
    
    For backward compatibility. Use extract_all_info_ocr for full extraction.
    
    Args:
        text: Resume text content
        
    Returns:
        Dict with extracted info (name, email, phone)
    """
    return {
        "name": extract_name(text),
        "email": extract_email(text),
        "phone": extract_phone(text),
    }
