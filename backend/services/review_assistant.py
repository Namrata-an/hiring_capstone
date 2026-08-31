"""Review Assistant Service.

AI-powered assistant that analyzes question banks and metrics to generate
guided review questions for interviewers. Provides session-based chatbot
for refining reviews.
"""
import logging
import json
import json5
import httpx
import re
from typing import Optional, Dict, List, Any

import config

logger = logging.getLogger(__name__)


class ReviewAssistantService:
    """AI assistant for interview reviews."""

    def __init__(self):
        self.api_key = config.OPENROUTER_API_KEY
        self.model = config.OPENROUTER_INSIGHTS_MODEL
        self.api_url = "https://openrouter.ai/api/v1/chat/completions"

    def is_configured(self) -> bool:
        """Check if the service is properly configured."""
        return bool(self.api_key)

    async def generate_review_questions(
        self,
        qb_snapshot: Dict[str, Any],
        basic_metrics: Dict[str, Any],
        previous_reviews: Optional[List[Dict[str, Any]]] = None,
        candidate_name: str = "",
        round_number: int = 1,
    ) -> Dict[str, Any]:
        """Generate guided review questions based on QB and metrics.

        Args:
            qb_snapshot: Snapshot of question bank used in interview
            basic_metrics: Basic ratings (technical_skills, communication, etc.)
            previous_reviews: Reviews from previous rounds
            candidate_name: Name of candidate
            round_number: Current round number

        Returns:
            Dictionary with guided questions and analysis
        """
        if not self.is_configured():
            logger.warning("Review Assistant not configured - API key missing")
            return self._get_fallback_questions()

        # Build the analysis prompt
        prompt = self._build_analysis_prompt(
            qb_snapshot, basic_metrics, previous_reviews, candidate_name, round_number
        )

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    self.api_url,
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                        "HTTP-Referer": "http://localhost:8000",
                        "X-Title": "Hiring Platform Review Assistant",
                    },
                    json={
                        "model": self.model,
                        "messages": [
                            {
                                "role": "system",
                                "content": self._get_system_prompt(),
                            },
                            {"role": "user", "content": prompt},
                        ],
                        "temperature": 0.3,
                        "max_tokens": 4000,
                        "response_format": {"type": "json_object"},
                    },
                )

                response.raise_for_status()
                data = response.json()
                content = data["choices"][0]["message"]["content"]

                # Parse the response
                result = await self._parse_json_with_fallback(content)

                if result:
                    return {
                        "success": True,
                        "questions": result.get("questions", []),
                        "analysis": result.get("analysis", ""),
                        "key_areas": result.get("key_areas", []),
                        "suggestions": result.get("suggestions", []),
                    }
                else:
                    return self._get_fallback_questions()

        except httpx.HTTPError as e:
            logger.error(f"HTTP error generating review questions: {str(e)}")
            return self._get_fallback_questions()
        except Exception as e:
            logger.error(f"Error generating review questions: {str(e)}")
            return self._get_fallback_questions()

    async def chat_review_refinement(
        self,
        conversation_history: List[Dict[str, Any]],
        user_message: str,
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Chat-based review refinement with session memory.

        Args:
            conversation_history: Previous chat messages
            user_message: Current user message
            context: Optional context (QB snapshot, metrics, etc.)

        Returns:
            AI response with refined guidance
        """
        if not self.is_configured():
            return {
                "success": False,
                "message": "AI assistant not configured",
            }

        # Build conversation with history
        messages = [
            {
                "role": "system",
                "content": "You are a helpful interview review assistant. Help interviewers write comprehensive, fair reviews. Ask clarifying questions, suggest improvements, and ensure reviews are actionable. Keep responses under 200 words.",
            }
        ]

        # Add context if provided
        if context:
            context_msg = f"Context: {json.dumps(context, indent=2)[:1000]}"
            messages.append({"role": "system", "content": context_msg})

        # Add conversation history (last 10 messages)
        for entry in conversation_history[-10:]:
            role = entry.get("role", "user")
            content = entry.get("content", "")
            if role in ["user", "assistant"]:
                messages.append({"role": role, "content": content})

        # Add current message
        messages.append({"role": "user", "content": user_message})

        try:
            # Retry logic (2 attempts)
            for attempt in range(2):
                async with httpx.AsyncClient(timeout=60.0) as client:
                    response = await client.post(
                        self.api_url,
                        headers={
                            "Authorization": f"Bearer {self.api_key}",
                            "Content-Type": "application/json",
                            "HTTP-Referer": "http://localhost:8000",
                            "X-Title": "Hiring Platform Review Chat",
                        },
                        json={
                            "model": self.model,
                            "messages": messages,
                            "temperature": 0.3,
                            "max_tokens": 1000,
                        },
                    )

                    response.raise_for_status()
                    data = response.json()
                    content = data["choices"][0]["message"]["content"]

                    return {
                        "success": True,
                        "message": content,
                    }

        except Exception as e:
            logger.error(f"Error in review chat: {str(e)}")
            return {
                "success": False,
                "message": f"Error: {str(e)}",
            }

    def _get_system_prompt(self) -> str:
        """Get the system prompt for review question generation."""
        return """You are an expert interview review assistant. Your job is to analyze:
1. The question bank used in the interview
2. Basic ratings provided by the interviewer
3. Previous round reviews (if any)

Generate 5-7 guided questions that help the interviewer write a comprehensive review.
Focus on:
- Specific examples from the interview
- Strengths to highlight
- Areas for improvement to probe
- Comparisons to previous rounds (if applicable)
- Actionable feedback

Return ONLY valid JSON."""

    def _build_analysis_prompt(
        self,
        qb_snapshot: Dict[str, Any],
        basic_metrics: Dict[str, Any],
        previous_reviews: Optional[List[Dict[str, Any]]],
        candidate_name: str,
        round_number: int,
    ) -> str:
        """Build the analysis prompt."""

        # Summarize QB (don't send full questions, just categories and counts)
        qb_summary = {}
        for category, questions in qb_snapshot.items():
            if isinstance(questions, list):
                qb_summary[category] = f"{len(questions)} questions"

        # Summarize previous reviews
        prev_summary = ""
        if previous_reviews:
            prev_summary = "\n\n## Previous Round Context:\n"
            for review in previous_reviews:
                prev_summary += f"- Round {review.get('round_number')}: "
                prev_summary += f"Overall {review.get('overall_rating', 'N/A')}/5, "
                prev_summary += f"Recommendation: {review.get('recommendation', 'N/A')}\n"
                if review.get("strengths"):
                    prev_summary += f"  Strengths: {review['strengths'][:100]}...\n"
                if review.get("areas_for_improvement"):
                    prev_summary += f"  Areas to improve: {review['areas_for_improvement'][:100]}...\n"

        return f"""Analyze this interview and generate guided review questions.

## Candidate: {candidate_name}
## Round: {round_number}

## Question Bank Used:
{json.dumps(qb_summary, indent=2)}

## Interviewer's Basic Ratings:
- Technical Skills: {basic_metrics.get('technical_skills', 'N/A')}/5
- Communication: {basic_metrics.get('communication', 'N/A')}/5
- Problem Solving: {basic_metrics.get('problem_solving', 'N/A')}/5
- Cultural Fit: {basic_metrics.get('cultural_fit', 'N/A')}/5
- Overall: {basic_metrics.get('overall_rating', 'N/A')}/5
{prev_summary}

Generate 5-7 guided questions to help the interviewer write a comprehensive review.

Return this exact JSON structure:
{{
    "analysis": "Brief 2-3 sentence analysis of the ratings and context",
    "key_areas": ["Area 1 to focus on", "Area 2 to focus on", "Area 3"],
    "questions": [
        {{
            "question": "Can you describe a specific moment when the candidate demonstrated strong technical skills?",
            "purpose": "Gather concrete examples for strengths section"
        }},
        {{
            "question": "What specific areas should the candidate work on before the next role?",
            "purpose": "Ensure actionable feedback"
        }}
    ],
    "suggestions": [
        "Consider mentioning specific questions from the interview",
        "Compare performance to previous rounds if applicable"
    ]
}}"""

    async def _parse_json_with_fallback(self, content: str) -> Optional[Dict[str, Any]]:
        """Parse JSON with fallback strategies."""
        # Clean markdown
        content = content.strip()
        if content.startswith("```json"):
            content = content[7:]
        elif content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()

        # Try standard JSON
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            pass

        # Try json5
        try:
            return json5.loads(content)
        except Exception:
            pass

        # Extract and try again
        json_match = re.search(r"\{[\s\S]*\}", content)
        if json_match:
            try:
                return json5.loads(json_match.group(0))
            except Exception:
                pass

        logger.error(f"Failed to parse review assistant response: {content[:200]}")
        return None

    def _get_fallback_questions(self) -> Dict[str, Any]:
        """Return fallback questions when AI is unavailable."""
        return {
            "success": True,
            "questions": [
                {
                    "question": "Can you describe specific examples of the candidate's technical strengths?",
                    "purpose": "Gather concrete evidence for strengths",
                },
                {
                    "question": "What areas should the candidate improve before taking on this role?",
                    "purpose": "Provide actionable feedback",
                },
                {
                    "question": "How did the candidate approach problem-solving during the interview?",
                    "purpose": "Assess analytical thinking",
                },
                {
                    "question": "Did the candidate demonstrate good communication and collaboration skills?",
                    "purpose": "Evaluate soft skills",
                },
                {
                    "question": "Would you want this candidate on your team? Why or why not?",
                    "purpose": "Get overall recommendation context",
                },
            ],
            "analysis": "Based on your ratings, the candidate shows promise in several areas. Focus on providing specific examples and actionable feedback.",
            "key_areas": [
                "Technical competency",
                "Communication skills",
                "Problem-solving approach",
                "Cultural fit",
            ],
            "suggestions": [
                "Reference specific questions or scenarios from the interview",
                "Provide concrete examples rather than general statements",
                "Include both strengths and areas for growth",
            ],
            "fallback": True,
        }


# Singleton instance
review_assistant = ReviewAssistantService()
