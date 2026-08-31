"""Interviewer-specific endpoints."""
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy import or_, func
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.orm.attributes import flag_modified
from pydantic import BaseModel
import io

from database import get_db
from models import (
    User, Candidate, CandidateAssignment, Job, UserRole,
    CandidateInsights, InterviewSchedule, InterviewStatus, QuestionBank,
    InterviewReview, CandidateStatus, InterviewQuestionsSnapshot, InterviewRound
)
from schemas import (
    CandidateResponse, CandidateDetailResponse, CandidateListResponse,
    CandidateInsightsResponse, InsightScores, MindsetAnalysis,
    TechnicalAnalysis, ExperienceAnalysis, InsightsSummary, JobMatchAnalysis,
    QuestionBankResponse, QuestionCategory,
    TalentMemoryCandidateSummary, TalentMemoryListResponse,
    ReviewAssistantRequest, ReviewChatRequest,
)
from services.auth_service import get_current_user
from services.email_service import email_service
from services.insights_generator import generate_insights
from services.qb_generator import qb_generator
from services.review_assistant import review_assistant
import config

router = APIRouter(prefix="/interviewer", tags=["Interviewer"])


class InterviewerRescheduleRequest(BaseModel):
    """Interviewer-initiated reschedule request from the in-app dashboard."""
    proposed_at: Optional[datetime] = None
    reason: Optional[str] = None
    questions_used: Optional[List[Dict[str, Any]]] = None


# Pydantic models for review
class InterviewReviewCreate(BaseModel):
    technical_skills: Optional[int] = None
    communication: Optional[int] = None
    problem_solving: Optional[int] = None
    cultural_fit: Optional[int] = None
    overall_rating: Optional[int] = None
    strengths: Optional[str] = None
    areas_for_improvement: Optional[str] = None
    notes: Optional[str] = None
    recommendation: str  # 'strong_yes', 'yes', 'maybe', 'no', 'strong_no'
    llm_generated_feedback: Optional[Dict[str, Any]] = None  # Chatbot Q&A session data


@router.get("/candidates", response_model=CandidateListResponse)
def get_assigned_candidates(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get candidates assigned to the current interviewer."""
    if current_user.role != UserRole.INTERVIEWER:
        raise HTTPException(
            status_code=403,
            detail="Only interviewers can access this endpoint"
        )
    
    # Get assignments for this interviewer
    assignments = db.query(CandidateAssignment).filter(
        CandidateAssignment.interviewer_id == current_user.id
    ).offset(skip).limit(limit).all()
    
    total = db.query(CandidateAssignment).filter(
        CandidateAssignment.interviewer_id == current_user.id
    ).count()
    
    # Get candidate details
    candidates = []
    for assignment in assignments:
        candidate = db.query(Candidate).filter(Candidate.id == assignment.candidate_id).first()
        if candidate:
            has_insights = db.query(CandidateInsights).filter(
                CandidateInsights.candidate_id == candidate.id
            ).first() is not None
            
            candidates.append(CandidateResponse(
                id=candidate.id,
                name=candidate.name,
                email=candidate.email,
                phone=candidate.phone,
                skills=candidate.skills,
                experience_years=candidate.experience_years,
                current_position=candidate.current_position,
                education=candidate.education,
                resume_path=candidate.resume_path,
                job_id=candidate.job_id,
                status=candidate.status,
                applied_at=candidate.applied_at,
                created_at=candidate.created_at,
                updated_at=candidate.updated_at,
                has_insights=has_insights
            ))
    
    return CandidateListResponse(candidates=candidates, total=total)


@router.get("/candidates/{candidate_id}", response_model=CandidateDetailResponse)
def get_assigned_candidate_detail(
    candidate_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get detailed info for an assigned candidate."""
    if current_user.role != UserRole.INTERVIEWER:
        raise HTTPException(
            status_code=403,
            detail="Only interviewers can access this endpoint"
        )
    
    # Verify candidate is assigned to this interviewer (via assignment or schedule)
    assignment = db.query(CandidateAssignment).filter(
        CandidateAssignment.candidate_id == candidate_id,
        CandidateAssignment.interviewer_id == current_user.id
    ).first()
    
    schedule = db.query(InterviewSchedule).filter(
        InterviewSchedule.candidate_id == candidate_id,
        InterviewSchedule.interviewer_id == current_user.id
    ).first()
    
    if not assignment and not schedule:
        raise HTTPException(
            status_code=404,
            detail="Candidate not found or not assigned to you"
        )
    
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    job = db.query(Job).filter(Job.id == candidate.job_id).first()
    
    has_insights = db.query(CandidateInsights).filter(
        CandidateInsights.candidate_id == candidate.id
    ).first() is not None
    
    return CandidateDetailResponse(
        id=candidate.id,
        name=candidate.name,
        email=candidate.email,
        phone=candidate.phone,
        skills=candidate.skills,
        experience_years=candidate.experience_years,
        current_position=candidate.current_position,
        education=candidate.education,
        resume_path=candidate.resume_path,
        resume_text=candidate.resume_text,
        job_id=candidate.job_id,
        status=candidate.status,
        applied_at=candidate.applied_at,
        created_at=candidate.created_at,
        updated_at=candidate.updated_at,
        job_title=job.title if job else None,
        has_insights=has_insights
    )


@router.get("/candidates/{candidate_id}/resume")
async def get_candidate_resume(
    candidate_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Download the resume PDF for an assigned candidate."""
    import httpx

    if current_user.role != UserRole.INTERVIEWER:
        raise HTTPException(
            status_code=403,
            detail="Only interviewers can access this endpoint"
        )

    # Verify candidate is assigned to this interviewer
    assignment = db.query(CandidateAssignment).filter(
        CandidateAssignment.candidate_id == candidate_id,
        CandidateAssignment.interviewer_id == current_user.id
    ).first()

    schedule = db.query(InterviewSchedule).filter(
        InterviewSchedule.candidate_id == candidate_id,
        InterviewSchedule.interviewer_id == current_user.id
    ).first()

    if not assignment and not schedule:
        raise HTTPException(
            status_code=404,
            detail="Candidate not found or not assigned to you"
        )

    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate or not candidate.resume_path:
        raise HTTPException(status_code=404, detail="Resume not found")

    # Check if resume_path is a URL (UploadThing) or local file
    if candidate.resume_path.startswith('http://') or candidate.resume_path.startswith('https://'):
        # Proxy the UploadThing URL
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(candidate.resume_path, timeout=30.0)
                response.raise_for_status()

                return StreamingResponse(
                    io.BytesIO(response.content),
                    media_type="application/pdf",
                    headers={
                        "Content-Disposition": f'inline; filename="{candidate.name.replace(" ", "_")}_resume.pdf"'
                    }
                )
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"Failed to fetch resume from storage: {str(e)}")
    else:
        # Local file path
        resume_file = config.BASE_DIR / candidate.resume_path
        if not resume_file.exists():
            raise HTTPException(status_code=404, detail="Resume file not found")

        return FileResponse(
            path=str(resume_file),
            filename=f"{candidate.name.replace(' ', '_')}_resume.pdf",
            media_type="application/pdf"
        )


@router.get("/candidates/{candidate_id}/previous-reviews")
def get_previous_interview_reviews(
    candidate_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get previous round reviews for a candidate.

    Used for baton passing - shows gold areas (strengths) and grey areas (weaknesses)
    from previous interview rounds to help prepare for the next round.

    Visibility rules:
    - HR sees all reviews
    - Round N interviewer sees reviews from Round 1 to N-1 (not their own or future rounds)
    """
    if current_user.role != UserRole.INTERVIEWER and current_user.role != UserRole.HR_ADMIN:
        raise HTTPException(
            status_code=403,
            detail="Only interviewers and HR can access this endpoint"
        )

    # Verify candidate is assigned to this interviewer (or user is HR)
    schedule = db.query(InterviewSchedule).filter(
        InterviewSchedule.candidate_id == candidate_id,
        InterviewSchedule.interviewer_id == current_user.id
    ).first()

    assignment = db.query(CandidateAssignment).filter(
        CandidateAssignment.candidate_id == candidate_id,
        CandidateAssignment.interviewer_id == current_user.id
    ).first()

    if not assignment and not schedule and current_user.role != UserRole.HR_ADMIN:
        raise HTTPException(
            status_code=404,
            detail="Candidate not found or not assigned to you"
        )

    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # Determine current interviewer's round number
    current_round_number = None
    if schedule:
        round_info = db.query(InterviewRound).filter(
            InterviewRound.id == schedule.interview_round_id
        ).first()
        if round_info:
            current_round_number = round_info.round_number

    # Get all reviews with round information
    reviews_with_rounds = db.query(InterviewReview, InterviewSchedule, InterviewRound).join(
        InterviewSchedule, InterviewReview.schedule_id == InterviewSchedule.id
    ).join(
        InterviewRound, InterviewSchedule.interview_round_id == InterviewRound.id
    ).filter(
        InterviewReview.candidate_id == candidate_id
    ).order_by(InterviewRound.round_number.asc()).all()

    # Filter based on visibility rules
    visible_reviews = []
    if current_user.role == UserRole.HR_ADMIN:
        # HR sees all reviews
        visible_reviews = reviews_with_rounds
    elif current_round_number is not None:
        # Interviewer sees only reviews from previous rounds
        visible_reviews = [
            (review, sched, round_info)
            for review, sched, round_info in reviews_with_rounds
            if round_info.round_number < current_round_number
        ]
    else:
        # Fallback: show all reviews (for legacy assignments without rounds)
        visible_reviews = reviews_with_rounds

    review_contexts = []
    aggregated_gold = []
    aggregated_grey = []

    for review, sched, round_info in visible_reviews:
        interviewer = db.query(User).filter(User.id == review.interviewer_id).first()

        gold_areas = []
        grey_areas = []

        # Extract gold/grey areas from ratings
        rating_fields = [
            ("Technical Skills", review.technical_skills),
            ("Communication", review.communication),
            ("Problem Solving", review.problem_solving),
            ("Cultural Fit", review.cultural_fit)
        ]

        for field_name, rating in rating_fields:
            if rating is not None:
                if rating >= 4:
                    gold_areas.append(f"{field_name}: {rating}/5")
                elif rating <= 3:
                    grey_areas.append(f"{field_name}: {rating}/5")

        # Add strengths text
        if review.strengths:
            strength_items = [s.strip() for s in review.strengths.replace('\n', ',').split(',') if s.strip()]
            gold_areas.extend(strength_items[:3])

        # Add areas for improvement
        if review.areas_for_improvement:
            improvement_items = [s.strip() for s in review.areas_for_improvement.replace('\n', ',').split(',') if s.strip()]
            grey_areas.extend(improvement_items[:3])

        aggregated_gold.extend(gold_areas)
        aggregated_grey.extend(grey_areas)

        review_contexts.append({
            "round_number": round_info.round_number,
            "round_name": round_info.round_name,
            "interviewer_name": interviewer.name if interviewer else None,
            "overall_rating": review.overall_rating,
            "gold_areas": gold_areas,
            "grey_areas": grey_areas,
            "recommendation": review.recommendation,
            "technical_skills": review.technical_skills,
            "communication": review.communication,
            "problem_solving": review.problem_solving,
            "cultural_fit": review.cultural_fit,
            "strengths": review.strengths,
            "areas_for_improvement": review.areas_for_improvement,
            "notes": review.notes,
            "llm_generated_feedback": review.llm_generated_feedback,  # Include chatbot Q&A
            "created_at": review.created_at.isoformat() if review.created_at else None
        })

    # Deduplicate
    aggregated_gold = list(dict.fromkeys(aggregated_gold))
    aggregated_grey = list(dict.fromkeys(aggregated_grey))

    return {
        "candidate_id": candidate.id,
        "candidate_name": candidate.name,
        "current_round_number": current_round_number,
        "total_visible_reviews": len(visible_reviews),
        "reviews": review_contexts,
        "aggregated_gold_areas": aggregated_gold,
        "aggregated_grey_areas": aggregated_grey
    }


@router.get("/candidates/{candidate_id}/insights", response_model=CandidateInsightsResponse)
def get_candidate_insights(
    candidate_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get AI-generated insights for an assigned candidate."""
    if current_user.role != UserRole.INTERVIEWER:
        raise HTTPException(
            status_code=403,
            detail="Only interviewers can access this endpoint"
        )
    
    # Verify candidate is assigned to this interviewer
    assignment = db.query(CandidateAssignment).filter(
        CandidateAssignment.candidate_id == candidate_id,
        CandidateAssignment.interviewer_id == current_user.id
    ).first()
    
    schedule = db.query(InterviewSchedule).filter(
        InterviewSchedule.candidate_id == candidate_id,
        InterviewSchedule.interviewer_id == current_user.id
    ).first()
    
    if not assignment and not schedule:
        raise HTTPException(
            status_code=404,
            detail="Candidate not found or not assigned to you"
        )
    
    insights = db.query(CandidateInsights).filter(
        CandidateInsights.candidate_id == candidate_id
    ).first()
    
    if not insights:
        raise HTTPException(
            status_code=404,
            detail="Insights not yet generated for this candidate. Use the regenerate endpoint."
        )
    
    # Build response from stored data
    return _build_insights_response(insights)


@router.post("/candidates/{candidate_id}/insights/regenerate", response_model=CandidateInsightsResponse)
async def regenerate_candidate_insights(
    candidate_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Regenerate AI insights for a candidate (interviewer can trigger)."""
    if current_user.role != UserRole.INTERVIEWER:
        raise HTTPException(
            status_code=403,
            detail="Only interviewers can access this endpoint"
        )
    
    # Verify candidate is assigned
    assignment = db.query(CandidateAssignment).filter(
        CandidateAssignment.candidate_id == candidate_id,
        CandidateAssignment.interviewer_id == current_user.id
    ).first()
    
    schedule = db.query(InterviewSchedule).filter(
        InterviewSchedule.candidate_id == candidate_id,
        InterviewSchedule.interviewer_id == current_user.id
    ).first()
    
    if not assignment and not schedule:
        raise HTTPException(
            status_code=404,
            detail="Candidate not found or not assigned to you"
        )
    
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    job = db.query(Job).filter(Job.id == candidate.job_id).first()
    
    # Generate new insights
    insights_data = await generate_insights(
        resume_text=candidate.resume_text or "",
        job_description=job.description if job else "",
        job_requirements=job.requirements if job else None
    )
    
    # Update or create insights record
    existing = db.query(CandidateInsights).filter(
        CandidateInsights.candidate_id == candidate_id
    ).first()
    
    if existing:
        # Update existing
        for key, value in insights_data.items():
            if hasattr(existing, key):
                setattr(existing, key, value)
        existing.updated_at = datetime.now(timezone.utc)
    else:
        # Create new
        new_insights = CandidateInsights(
            candidate_id=candidate_id,
            **insights_data
        )
        db.add(new_insights)
    
    db.commit()
    
    # Re-fetch and return
    insights = db.query(CandidateInsights).filter(
        CandidateInsights.candidate_id == candidate_id
    ).first()
    
    return _build_insights_response(insights)


def _get_previous_reviews_for_candidate(db: Session, candidate_id: str) -> List[Dict[str, Any]]:
    """Get all previous interview reviews for a candidate."""
    reviews = db.query(InterviewReview).filter(
        InterviewReview.candidate_id == candidate_id
    ).order_by(InterviewReview.created_at.asc()).all()
    
    result = []
    for i, review in enumerate(reviews):
        result.append({
            "round_number": i + 1,
            "technical_skills": review.technical_skills,
            "communication": review.communication,
            "problem_solving": review.problem_solving,
            "cultural_fit": review.cultural_fit,
            "overall_rating": review.overall_rating,
            "strengths": review.strengths,
            "areas_for_improvement": review.areas_for_improvement,
            "notes": review.notes,
            "recommendation": review.recommendation
        })
    
    return result


def _get_insights_dict(db: Session, candidate_id: str) -> Optional[Dict[str, Any]]:
    """Get candidate insights as a dictionary for QB generation."""
    insights = db.query(CandidateInsights).filter(
        CandidateInsights.candidate_id == candidate_id
    ).first()
    
    if not insights:
        return None
    
    return {
        "scores": {
            "overall_score": insights.overall_score,
            "technical_depth": insights.technical_depth_score,
            "experience_relevance": insights.experience_relevance_score,
            "education_quality": insights.education_score,
            "startup_mindset": insights.startup_mindset_score,
            "communication_signals": insights.communication_score,
        },
        "summary": insights.summary or {},
        "mindset_analysis": insights.mindset_analysis or {},
        "technical_analysis": insights.technical_analysis or {},
        "experience_analysis": insights.experience_analysis or {},
        "job_match": insights.job_match or {}
    }


@router.post("/candidates/{candidate_id}/question-bank")
async def generate_question_bank(
    candidate_id: str,
    focus_areas: Optional[List[str]] = Query(None),
    round_number: int = Query(1, ge=1, le=10),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Generate a question bank for an assigned candidate based on JD + resume + insights.
    
    For Round 2+, includes analysis of previous round reviews to focus on grey areas.
    """
    if current_user.role != UserRole.INTERVIEWER:
        raise HTTPException(
            status_code=403,
            detail="Only interviewers can access this endpoint"
        )
    
    # Verify candidate is assigned
    schedule = db.query(InterviewSchedule).filter(
        InterviewSchedule.candidate_id == candidate_id,
        InterviewSchedule.interviewer_id == current_user.id
    ).first()
    
    assignment = db.query(CandidateAssignment).filter(
        CandidateAssignment.candidate_id == candidate_id,
        CandidateAssignment.interviewer_id == current_user.id
    ).first()
    
    if not assignment and not schedule:
        raise HTTPException(
            status_code=404,
            detail="Candidate not found or not assigned to you"
        )
    
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    job = db.query(Job).filter(Job.id == candidate.job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Get candidate insights
    insights = _get_insights_dict(db, candidate_id)
    
    # Get previous reviews for later rounds
    previous_reviews = None
    if round_number > 1:
        previous_reviews = _get_previous_reviews_for_candidate(db, candidate_id)
    
    # Generate question bank with enhanced context
    qb_data = await qb_generator.generate_question_bank(
        resume_text=candidate.resume_text or "",
        job_description=job.description or "",
        job_requirements=job.requirements,
        candidate_skills=candidate.skills,
        focus_areas=focus_areas,
        insights=insights,
        previous_reviews=previous_reviews,
        round_number=round_number
    )
    
    # Check if QB already exists for this candidate+job
    existing_qb = db.query(QuestionBank).filter(
        QuestionBank.candidate_id == candidate_id,
        QuestionBank.job_id == job.id
    ).first()
    
    if existing_qb:
        # Update existing
        existing_qb.jd_based_questions = qb_data.get("jd_based_questions", [])
        existing_qb.fundamental_questions = qb_data.get("fundamental_questions", [])
        existing_qb.resume_questions = qb_data.get("resume_questions", [])
        existing_qb.behavioral_questions = qb_data.get("behavioral_questions", [])
        existing_qb.insights_based_questions = qb_data.get("insights_based_questions", [])
        existing_qb.follow_up_topics = qb_data.get("follow_up_topics", [])
        existing_qb.red_flag_probes = qb_data.get("red_flag_probes", [])
        existing_qb.leetcode_questions = qb_data.get("leetcode_questions", [])
        existing_qb.round_number = round_number
        existing_qb.previous_review_context = previous_reviews
        existing_qb.auto_generated = bool(qb_data.get("generated"))
        existing_qb.modified_by_interviewer = False
        existing_qb.chat_history = []  # Reset chat history on regeneration
        existing_qb.updated_at = datetime.now(timezone.utc)
        qb = existing_qb
    else:
        # Create new
        qb = QuestionBank(
            candidate_id=candidate_id,
            job_id=job.id,
            jd_based_questions=qb_data.get("jd_based_questions", []),
            fundamental_questions=qb_data.get("fundamental_questions", []),
            resume_questions=qb_data.get("resume_questions", []),
            behavioral_questions=qb_data.get("behavioral_questions", []),
            insights_based_questions=qb_data.get("insights_based_questions", []),
            follow_up_topics=qb_data.get("follow_up_topics", []),
            red_flag_probes=qb_data.get("red_flag_probes", []),
            leetcode_questions=qb_data.get("leetcode_questions", []),
            round_number=round_number,
            previous_review_context=previous_reviews,
            auto_generated=bool(qb_data.get("generated")),
            chat_history=[]
        )
        db.add(qb)
    
    db.commit()
    db.refresh(qb)
    
    return {
        "id": qb.id,
        "candidate_id": qb.candidate_id,
        "job_id": qb.job_id,
        "jd_based_questions": qb.jd_based_questions or [],
        "fundamental_questions": qb.fundamental_questions or [],
        "resume_questions": qb.resume_questions or [],
        "behavioral_questions": qb.behavioral_questions or [],
        "insights_based_questions": qb.insights_based_questions or [],
        "follow_up_topics": qb.follow_up_topics or [],
        "red_flag_probes": qb.red_flag_probes or [],
        "leetcode_questions": qb.leetcode_questions or [],
        "round_number": qb.round_number,
        "previous_review_context": qb.previous_review_context,
        "auto_generated": bool(qb.auto_generated),
        "modified_by_interviewer": bool(qb.modified_by_interviewer),
        "chat_history": qb.chat_history or [],
        "created_at": qb.created_at.isoformat(),
        "updated_at": qb.updated_at.isoformat() if qb.updated_at else None
    }


@router.get("/candidates/{candidate_id}/question-bank")
def get_question_bank(
    candidate_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get existing question bank for a candidate."""
    if current_user.role != UserRole.INTERVIEWER:
        raise HTTPException(
            status_code=403,
            detail="Only interviewers can access this endpoint"
        )
    
    # Verify candidate is assigned
    schedule = db.query(InterviewSchedule).filter(
        InterviewSchedule.candidate_id == candidate_id,
        InterviewSchedule.interviewer_id == current_user.id
    ).first()
    
    assignment = db.query(CandidateAssignment).filter(
        CandidateAssignment.candidate_id == candidate_id,
        CandidateAssignment.interviewer_id == current_user.id
    ).first()
    
    if not assignment and not schedule:
        raise HTTPException(
            status_code=404,
            detail="Candidate not found or not assigned to you"
        )
    
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    qb = db.query(QuestionBank).filter(
        QuestionBank.candidate_id == candidate_id
    ).first()
    
    if not qb:
        raise HTTPException(
            status_code=404,
            detail="No question bank generated yet. Use POST to generate one."
        )
    
    return {
        "id": qb.id,
        "candidate_id": qb.candidate_id,
        "job_id": qb.job_id,
        "jd_based_questions": qb.jd_based_questions or [],
        "fundamental_questions": qb.fundamental_questions or [],
        "resume_questions": qb.resume_questions or [],
        "behavioral_questions": qb.behavioral_questions or [],
        "insights_based_questions": qb.insights_based_questions or [],
        "follow_up_topics": qb.follow_up_topics or [],
        "red_flag_probes": qb.red_flag_probes or [],
        "leetcode_questions": qb.leetcode_questions or [],
        "round_number": qb.round_number or 1,
        "previous_review_context": qb.previous_review_context,
        "auto_generated": bool(qb.auto_generated),
        "modified_by_interviewer": bool(qb.modified_by_interviewer),
        "chat_history": qb.chat_history or [],
        "created_at": qb.created_at.isoformat(),
        "updated_at": qb.updated_at.isoformat() if qb.updated_at else None
    }


# Pydantic models for QB CRUD
class QuestionItem(BaseModel):
    question: str
    suggested_answer: str


class QuestionBankUpdate(BaseModel):
    category: str  # 'jd_based', 'fundamental', 'resume', 'behavioral', 'insights_based', 'red_flag_probes'
    questions: List[QuestionItem]


class QuestionChatRequest(BaseModel):
    message: str


class SingleQuestionAdd(BaseModel):
    category: str
    question: str
    suggested_answer: str


class SingleQuestionUpdate(BaseModel):
    category: str
    index: int
    question: str
    suggested_answer: str


class SingleQuestionDelete(BaseModel):
    category: str
    index: int


@router.post("/candidates/{candidate_id}/question-bank/chat")
async def chat_modify_question_bank(
    candidate_id: str,
    request: QuestionChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Chat interface to modify question bank using AI.
    
    Examples:
    - "Add more system design questions"
    - "Remove questions about React"
    - "Add a question about their AWS experience"
    - "Make the behavioral questions more startup-focused"
    """
    if current_user.role != UserRole.INTERVIEWER:
        raise HTTPException(status_code=403, detail="Only interviewers can access this endpoint")
    
    # Verify access
    schedule = db.query(InterviewSchedule).filter(
        InterviewSchedule.candidate_id == candidate_id,
        InterviewSchedule.interviewer_id == current_user.id
    ).first()
    
    assignment = db.query(CandidateAssignment).filter(
        CandidateAssignment.candidate_id == candidate_id,
        CandidateAssignment.interviewer_id == current_user.id
    ).first()
    
    if not assignment and not schedule:
        raise HTTPException(status_code=404, detail="Candidate not found or not assigned to you")
    
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    qb = db.query(QuestionBank).filter(QuestionBank.candidate_id == candidate_id).first()
    if not qb:
        raise HTTPException(status_code=404, detail="No question bank found. Generate one first.")
    
    # Build current questions dict
    current_questions = {
        "jd_based_questions": qb.jd_based_questions or [],
        "fundamental_questions": qb.fundamental_questions or [],
        "resume_questions": qb.resume_questions or [],
        "behavioral_questions": qb.behavioral_questions or [],
        "insights_based_questions": qb.insights_based_questions or [],
        "follow_up_topics": qb.follow_up_topics or [],
        "red_flag_probes": qb.red_flag_probes or [],
        "leetcode_questions": qb.leetcode_questions or [],
    }

    # Get chat history for session-based memory
    chat_history = qb.chat_history or []

    # Call LLM to modify with full conversation history
    candidate_context = f"Candidate: {candidate.name}, Skills: {', '.join(candidate.skills or [])}"
    result = await qb_generator.chat_modify_questions(
        current_questions,
        request.message,
        candidate_context,
        chat_history  # Pass history for context continuity
    )
    
    if result["success"]:
        # Update database — assign new list refs and flag_modified so SQLAlchemy
        # actually persists the change on Postgres JSON columns.
        modified = result["questions"]
        for col in (
            "jd_based_questions", "fundamental_questions", "resume_questions",
            "behavioral_questions", "insights_based_questions",
            "follow_up_topics", "red_flag_probes",
        ):
            new_value = modified.get(col, getattr(qb, col))
            if new_value is not None:
                new_value = list(new_value)
            setattr(qb, col, new_value)
            flag_modified(qb, col)
        qb.modified_by_interviewer = True
        qb.updated_at = datetime.now(timezone.utc)

        # Add to chat history (also a JSON column — same gotcha)
        chat_history = list(qb.chat_history or [])
        chat_history.append({
            "role": "user",
            "content": request.message,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        chat_history.append({
            "role": "assistant",
            "content": result["message"],
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        qb.chat_history = chat_history
        flag_modified(qb, "chat_history")

        db.commit()
        db.refresh(qb)
    
    return {
        "success": result["success"],
        "message": result["message"],
        "question_bank": {
            "id": qb.id,
            "jd_based_questions": qb.jd_based_questions or [],
            "fundamental_questions": qb.fundamental_questions or [],
            "resume_questions": qb.resume_questions or [],
            "behavioral_questions": qb.behavioral_questions or [],
            "insights_based_questions": qb.insights_based_questions or [],
            "follow_up_topics": qb.follow_up_topics or [],
            "red_flag_probes": qb.red_flag_probes or [],
            "leetcode_questions": qb.leetcode_questions or [],
            "chat_history": qb.chat_history or [],
            "modified_by_interviewer": True,
            "updated_at": qb.updated_at.isoformat() if qb.updated_at else None
        }
    }


@router.post("/candidates/{candidate_id}/question-bank/add")
def add_question(
    candidate_id: str,
    request: SingleQuestionAdd,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Manually add a single question to a specific category."""
    if current_user.role != UserRole.INTERVIEWER:
        raise HTTPException(status_code=403, detail="Only interviewers can access this endpoint")
    
    qb = db.query(QuestionBank).filter(QuestionBank.candidate_id == candidate_id).first()
    if not qb:
        raise HTTPException(status_code=404, detail="No question bank found")
    
    category_map = {
        "jd_based": "jd_based_questions",
        "fundamental": "fundamental_questions",
        "resume": "resume_questions",
        "behavioral": "behavioral_questions",
        "insights_based": "insights_based_questions",
        "red_flag_probes": "red_flag_probes"
    }
    
    column_name = category_map.get(request.category)
    if not column_name:
        raise HTTPException(status_code=400, detail=f"Invalid category: {request.category}")
    
    # New list reference so SQLAlchemy registers the JSON column as dirty.
    questions = list(getattr(qb, column_name) or [])
    questions.append({
        "question": request.question,
        "suggested_answer": request.suggested_answer
    })
    setattr(qb, column_name, questions)
    flag_modified(qb, column_name)
    qb.modified_by_interviewer = True
    qb.updated_at = datetime.now(timezone.utc)

    db.commit()

    return {"success": True, "message": "Question added", "questions": questions}


@router.put("/candidates/{candidate_id}/question-bank/update")
def update_question(
    candidate_id: str,
    request: SingleQuestionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a single question at a specific index in a category."""
    if current_user.role != UserRole.INTERVIEWER:
        raise HTTPException(status_code=403, detail="Only interviewers can access this endpoint")
    
    qb = db.query(QuestionBank).filter(QuestionBank.candidate_id == candidate_id).first()
    if not qb:
        raise HTTPException(status_code=404, detail="No question bank found")
    
    category_map = {
        "jd_based": "jd_based_questions",
        "fundamental": "fundamental_questions",
        "resume": "resume_questions",
        "behavioral": "behavioral_questions",
        "insights_based": "insights_based_questions",
        "red_flag_probes": "red_flag_probes"
    }
    
    column_name = category_map.get(request.category)
    if not column_name:
        raise HTTPException(status_code=400, detail=f"Invalid category: {request.category}")
    
    questions = list(getattr(qb, column_name) or [])
    if request.index < 0 or request.index >= len(questions):
        raise HTTPException(status_code=400, detail="Invalid question index")

    questions[request.index] = {
        "question": request.question,
        "suggested_answer": request.suggested_answer
    }
    setattr(qb, column_name, questions)
    flag_modified(qb, column_name)
    qb.modified_by_interviewer = True
    qb.updated_at = datetime.now(timezone.utc)
    
    db.commit()
    
    return {"success": True, "message": "Question updated", "questions": questions}


@router.delete("/candidates/{candidate_id}/question-bank/delete")
def delete_question(
    candidate_id: str,
    category: str = Query(...),
    index: int = Query(..., ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a single question at a specific index from a category."""
    if current_user.role != UserRole.INTERVIEWER:
        raise HTTPException(status_code=403, detail="Only interviewers can access this endpoint")
    
    qb = db.query(QuestionBank).filter(QuestionBank.candidate_id == candidate_id).first()
    if not qb:
        raise HTTPException(status_code=404, detail="No question bank found")
    
    category_map = {
        "jd_based": "jd_based_questions",
        "fundamental": "fundamental_questions",
        "resume": "resume_questions",
        "behavioral": "behavioral_questions",
        "insights_based": "insights_based_questions",
        "red_flag_probes": "red_flag_probes"
    }
    
    column_name = category_map.get(category)
    if not column_name:
        raise HTTPException(status_code=400, detail=f"Invalid category: {category}")
    
    questions = list(getattr(qb, column_name) or [])
    if index < 0 or index >= len(questions):
        raise HTTPException(status_code=400, detail="Invalid question index")

    removed = questions.pop(index)
    setattr(qb, column_name, questions)
    flag_modified(qb, column_name)
    qb.modified_by_interviewer = True
    qb.updated_at = datetime.now(timezone.utc)
    
    db.commit()
    
    return {"success": True, "message": "Question deleted", "removed": removed, "questions": questions}


@router.put("/candidates/{candidate_id}/question-bank/bulk")
def bulk_update_questions(
    candidate_id: str,
    request: QuestionBankUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Bulk update all questions in a specific category."""
    if current_user.role != UserRole.INTERVIEWER:
        raise HTTPException(status_code=403, detail="Only interviewers can access this endpoint")
    
    qb = db.query(QuestionBank).filter(QuestionBank.candidate_id == candidate_id).first()
    if not qb:
        raise HTTPException(status_code=404, detail="No question bank found")
    
    category_map = {
        "jd_based": "jd_based_questions",
        "fundamental": "fundamental_questions",
        "resume": "resume_questions",
        "behavioral": "behavioral_questions",
        "insights_based": "insights_based_questions",
        "red_flag_probes": "red_flag_probes"
    }
    
    column_name = category_map.get(request.category)
    if not column_name:
        raise HTTPException(status_code=400, detail=f"Invalid category: {request.category}")
    
    questions = [{"question": q.question, "suggested_answer": q.suggested_answer} for q in request.questions]
    setattr(qb, column_name, questions)
    flag_modified(qb, column_name)
    qb.modified_by_interviewer = True
    qb.updated_at = datetime.now(timezone.utc)
    
    db.commit()
    
    return {"success": True, "message": f"Updated {len(questions)} questions in {request.category}"}


@router.post("/schedule/{schedule_id}/respond")
def respond_to_interview(
    schedule_id: str,
    action: str = Query(..., pattern="^(accept|reject)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Accept or reject an interview assignment from the dashboard.
    
    This allows interviewers to respond without clicking email links.
    """
    if current_user.role != UserRole.INTERVIEWER:
        raise HTTPException(
            status_code=403,
            detail="Only interviewers can access this endpoint"
        )
    
    schedule = db.query(InterviewSchedule).filter(
        InterviewSchedule.id == schedule_id,
        InterviewSchedule.interviewer_id == current_user.id
    ).first()
    
    if not schedule:
        raise HTTPException(
            status_code=404,
            detail="Interview schedule not found or not assigned to you"
        )
    
    # Check if already responded
    if schedule.status in [InterviewStatus.CONFIRMED, InterviewStatus.DECLINED]:
        return {
            "message": f"Already responded: {schedule.status.value}",
            "status": schedule.status.value,
            "confirmed_at": schedule.confirmed_at.isoformat() if schedule.confirmed_at else None
        }
    
    # Update status
    if action == "accept":
        schedule.status = InterviewStatus.CONFIRMED
    else:
        schedule.status = InterviewStatus.DECLINED
    
    schedule.confirmed_at = datetime.now(timezone.utc)
    schedule.confirmation_token = None  # Invalidate token
    
    db.commit()
    
    return {
        "message": f"Interview {action}ed successfully",
        "status": schedule.status.value,
        "confirmed_at": schedule.confirmed_at.isoformat()
    }


@router.post("/schedule/{schedule_id}/reschedule")
def request_reschedule(
    schedule_id: str,
    request: InterviewerRescheduleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Interviewer asks HR to reschedule an interview from the dashboard.

    Sets the schedule status to RESCHEDULE_REQUESTED, records the proposed
    time/reason, and notifies HR via email. HR finalizes via
    POST /api/v1/interviews/{id}/process-reschedule.
    """
    if current_user.role != UserRole.INTERVIEWER:
        raise HTTPException(
            status_code=403,
            detail="Only interviewers can access this endpoint"
        )

    schedule = db.query(InterviewSchedule).filter(
        InterviewSchedule.id == schedule_id,
        InterviewSchedule.interviewer_id == current_user.id
    ).first()

    if not schedule:
        raise HTTPException(
            status_code=404,
            detail="Interview schedule not found or not assigned to you"
        )

    if schedule.status == InterviewStatus.COMPLETED:
        raise HTTPException(
            status_code=400,
            detail="This interview has already been completed and cannot be rescheduled"
        )

    schedule.status = InterviewStatus.RESCHEDULE_REQUESTED
    schedule.proposed_at = request.proposed_at
    schedule.proposed_by = current_user.id
    schedule.reschedule_reason = request.reason
    schedule.reschedule_count = (schedule.reschedule_count or 0) + 1
    schedule.reschedule_questions_used = request.questions_used
    schedule.confirmed_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(schedule)

    # Best-effort HR notification.
    try:
        email_service.send_reschedule_notification_to_hr(schedule=schedule)
    except Exception as exc:  # noqa: BLE001
        import logging
        logging.getLogger(__name__).exception(
            "Failed to send HR reschedule notification: %s", exc
        )

    return {
        "message": "Reschedule request sent to HR",
        "status": schedule.status.value,
        "proposed_at": schedule.proposed_at.isoformat() if schedule.proposed_at else None,
        "reschedule_count": schedule.reschedule_count,
    }


@router.get("/memory/candidates", response_model=TalentMemoryListResponse)
def list_memory_candidates(
    scope: str = Query("all", pattern="^(mine|all)$"),
    status_filter: Optional[CandidateStatus] = Query(None, alias="status"),
    job_id: Optional[str] = None,
    q: Optional[str] = Query(None, description="Name / email search"),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Interviewer's Talent Memory list — every candidate they've interviewed
    (`scope=mine`) or every candidate in the system (`scope=all`).

    Per-row, returns the current user's relationship to the candidate
    (`my_role`: interviewed / assigned / none) plus a summary of rounds
    completed and the most recent timeline event so the UI can surface
    "what happened most recently". Available to any authenticated user;
    HR uses it through the same shape.
    """
    query = db.query(Candidate)

    if scope == "mine":
        # Interviewed = has at least one InterviewReview by current_user
        # OR has an InterviewSchedule with status COMPLETED for current_user.
        # We use review presence as the strict "I interviewed them" signal,
        # since a completed schedule without a review still implies they ran
        # the meeting.
        my_review_candidate_ids = {
            row[0]
            for row in db.query(InterviewReview.candidate_id)
            .filter(InterviewReview.interviewer_id == current_user.id)
            .all()
        }
        my_completed_candidate_ids = {
            row[0]
            for row in db.query(InterviewSchedule.candidate_id)
            .filter(
                InterviewSchedule.interviewer_id == current_user.id,
                InterviewSchedule.status == InterviewStatus.COMPLETED,
            )
            .all()
        }
        mine = my_review_candidate_ids | my_completed_candidate_ids
        if not mine:
            return TalentMemoryListResponse(candidates=[], total=0, scope=scope)
        query = query.filter(Candidate.id.in_(mine))

    if status_filter is not None:
        query = query.filter(Candidate.status == status_filter)
    if job_id:
        query = query.filter(Candidate.job_id == job_id)
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(or_(Candidate.name.ilike(like), Candidate.email.ilike(like)))

    total = query.count()
    candidates = query.order_by(Candidate.applied_at.desc()).limit(limit).all()
    if not candidates:
        return TalentMemoryListResponse(candidates=[], total=total, scope=scope)

    cand_ids = [c.id for c in candidates]
    job_ids = list({c.job_id for c in candidates if c.job_id})

    # Bulk-load supporting data so we don't N+1.
    jobs_by_id = {j.id: j for j in db.query(Job).filter(Job.id.in_(job_ids)).all()} if job_ids else {}
    schedules = (
        db.query(InterviewSchedule)
        .filter(InterviewSchedule.candidate_id.in_(cand_ids))
        .all()
    )
    reviews = (
        db.query(InterviewReview)
        .filter(InterviewReview.candidate_id.in_(cand_ids))
        .all()
    )

    schedules_by_candidate: Dict[str, List[InterviewSchedule]] = {}
    for s in schedules:
        schedules_by_candidate.setdefault(s.candidate_id, []).append(s)
    reviews_by_candidate: Dict[str, List[InterviewReview]] = {}
    for r in reviews:
        reviews_by_candidate.setdefault(r.candidate_id, []).append(r)

    summaries: List[TalentMemoryCandidateSummary] = []
    for c in candidates:
        c_schedules = schedules_by_candidate.get(c.id, [])
        c_reviews = reviews_by_candidate.get(c.id, [])
        rounds_total = len(c_schedules)
        rounds_completed = sum(
            1 for s in c_schedules if s.status == InterviewStatus.COMPLETED
        )

        my_review = next(
            (r for r in c_reviews if r.interviewer_id == current_user.id), None
        )
        my_schedule = next(
            (s for s in c_schedules if s.interviewer_id == current_user.id), None
        )
        if my_review or (my_schedule and my_schedule.status == InterviewStatus.COMPLETED):
            my_role = "interviewed"
        elif my_schedule:
            my_role = "assigned"
        else:
            my_role = "none"

        # Latest event: most recent of (any schedule update, any review create,
        # candidate.applied_at). Cheap heuristic — full timeline is one call away.
        candidates_for_latest: List[tuple] = [("applied", c.applied_at)]
        for s in c_schedules:
            ts = s.confirmed_at or s.invite_sent_at or s.updated_at or s.created_at
            label = (
                "interview_completed" if s.status == InterviewStatus.COMPLETED
                else "interview_confirmed" if s.status == InterviewStatus.CONFIRMED
                else "interview_declined" if s.status == InterviewStatus.DECLINED
                else "reschedule_requested" if s.status == InterviewStatus.RESCHEDULE_REQUESTED
                else "invite_sent" if s.invite_sent_at
                else "interview_assigned"
            )
            candidates_for_latest.append((label, ts))
        for r in c_reviews:
            candidates_for_latest.append(("review_submitted", r.created_at))

        latest = max(
            (item for item in candidates_for_latest if item[1] is not None),
            key=lambda item: item[1],
            default=None,
        )

        job = jobs_by_id.get(c.job_id) if c.job_id else None
        summaries.append(TalentMemoryCandidateSummary(
            candidate_id=c.id,
            name=c.name,
            email=c.email,
            skills=c.skills,
            experience_years=c.experience_years,
            current_position=c.current_position,
            job_id=c.job_id,
            job_title=job.title if job else None,
            status=c.status.value if hasattr(c.status, "value") else str(c.status),
            applied_at=c.applied_at,
            rounds_total=rounds_total,
            rounds_completed=rounds_completed,
            my_role=my_role,
            my_review_id=my_review.id if my_review else None,
            latest_event_kind=latest[0] if latest else None,
            latest_event_at=latest[1] if latest else None,
        ))

    return TalentMemoryListResponse(candidates=summaries, total=total, scope=scope)


@router.get("/users", response_model=list)
def list_interviewers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all interviewers (for HR to assign candidates)."""
    from models import UserRole
    
    interviewers = db.query(User).filter(User.role == UserRole.INTERVIEWER).all()
    
    return [
        {
            "id": u.id,
            "email": u.email,
            "name": u.name,
            "role": u.role.value
        }
        for u in interviewers
    ]


def _build_insights_response(insights: CandidateInsights) -> CandidateInsightsResponse:
    """Build insights response from database model."""
    def safe_int(val):
        if val is None:
            return None
        try:
            return int(val)
        except (ValueError, TypeError):
            return None
    
    scores = InsightScores(
        overall_score=safe_int(insights.overall_score),
        technical_depth=safe_int(insights.technical_depth_score),
        experience_relevance=safe_int(insights.experience_relevance_score),
        education_quality=safe_int(insights.education_score),
        startup_mindset=safe_int(insights.startup_mindset_score),
        communication_signals=safe_int(insights.communication_score)
    )
    
    mindset_data = insights.mindset_analysis or {}
    mindset = MindsetAnalysis(
        startup_fit=mindset_data.get("startup_fit"),
        fit_level=mindset_data.get("fit_level"),
        positive_signals=mindset_data.get("positive_signals", []),
        concerns=mindset_data.get("concerns", []),
        culture_indicators=mindset_data.get("culture_indicators", [])
    )
    
    tech_data = insights.technical_analysis or {}
    technical = TechnicalAnalysis(
        primary_skills=tech_data.get("primary_skills", []),
        skill_depth=tech_data.get("skill_depth"),
        missing_skills=tech_data.get("missing_skills", []),
        tech_trajectory=tech_data.get("tech_trajectory"),
        standout_technical=tech_data.get("standout_technical")
    )
    
    exp_data = insights.experience_analysis or {}
    experience = ExperienceAnalysis(
        total_years=exp_data.get("total_years"),
        highlights=exp_data.get("highlights", []),
        trajectory=exp_data.get("trajectory"),
        red_flags=exp_data.get("red_flags", []),
        company_types=exp_data.get("company_types", []),
        leadership_signals=exp_data.get("leadership_signals", [])
    )
    
    summary_data = insights.summary or {}
    summary = InsightsSummary(
        headline=summary_data.get("headline"),
        top_strengths=summary_data.get("top_strengths", []),
        key_concerns=summary_data.get("key_concerns", []),
        areas_to_probe=summary_data.get("areas_to_probe", []),
        quick_verdict=summary_data.get("quick_verdict")
    )
    
    job_match = None
    if insights.job_match:
        jm_data = insights.job_match
        job_match = JobMatchAnalysis(
            required_skills_match=jm_data.get("required_skills_match", []),
            required_skills_missing=jm_data.get("required_skills_missing", []),
            match_percentage=jm_data.get("match_percentage"),
            experience_gap=jm_data.get("experience_gap"),
            overall_fit_for_role=jm_data.get("overall_fit_for_role")
        )
    
    return CandidateInsightsResponse(
        id=insights.id,
        candidate_id=insights.candidate_id,
        scores=scores,
        mindset=mindset,
        technical=technical,
        experience=experience,
        summary=summary,
        job_match=job_match,
        generated_at=insights.generated_at
    )


@router.post("/schedule/{schedule_id}/complete")
def complete_interview_with_review(
    schedule_id: str,
    review_data: InterviewReviewCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Mark interview as completed and submit review/feedback.
    
    This endpoint allows interviewers to:
    1. Submit their interview review with ratings and feedback
    2. Provide a recommendation (strong_yes, yes, maybe, no, strong_no)
    3. Mark the interview as completed
    """
    if current_user.role != UserRole.INTERVIEWER:
        raise HTTPException(
            status_code=403,
            detail="Only interviewers can access this endpoint"
        )
    
    schedule = db.query(InterviewSchedule).filter(
        InterviewSchedule.id == schedule_id,
        InterviewSchedule.interviewer_id == current_user.id
    ).first()
    
    if not schedule:
        raise HTTPException(
            status_code=404,
            detail="Interview schedule not found or not assigned to you"
        )
    
    # Check if already reviewed
    existing_review = db.query(InterviewReview).filter(
        InterviewReview.schedule_id == schedule_id
    ).first()
    
    if existing_review:
        raise HTTPException(
            status_code=400,
            detail="Review already submitted for this interview"
        )
    
    # Fetch previous reviews context for baton passing
    previous_reviews_snapshot = []
    round_info = db.query(InterviewRound).filter(
        InterviewRound.id == schedule.interview_round_id
    ).first()

    if round_info and round_info.round_number > 1:
        # Get reviews from previous rounds
        previous_reviews_query = db.query(InterviewReview, InterviewSchedule, InterviewRound).join(
            InterviewSchedule, InterviewReview.schedule_id == InterviewSchedule.id
        ).join(
            InterviewRound, InterviewSchedule.interview_round_id == InterviewRound.id
        ).filter(
            InterviewReview.candidate_id == schedule.candidate_id,
            InterviewRound.round_number < round_info.round_number
        ).order_by(InterviewRound.round_number.asc()).all()

        for prev_review, prev_sched, prev_round in previous_reviews_query:
            prev_interviewer = db.query(User).filter(User.id == prev_review.interviewer_id).first()
            previous_reviews_snapshot.append({
                "round_number": prev_round.round_number,
                "round_name": prev_round.round_name,
                "interviewer_name": prev_interviewer.name if prev_interviewer else None,
                "overall_rating": prev_review.overall_rating,
                "technical_skills": prev_review.technical_skills,
                "communication": prev_review.communication,
                "problem_solving": prev_review.problem_solving,
                "cultural_fit": prev_review.cultural_fit,
                "strengths": prev_review.strengths,
                "areas_for_improvement": prev_review.areas_for_improvement,
                "recommendation": prev_review.recommendation,
                "created_at": prev_review.created_at.isoformat() if prev_review.created_at else None
            })

    # Create the review with baton passing fields
    review = InterviewReview(
        schedule_id=schedule_id,
        interviewer_id=current_user.id,
        candidate_id=schedule.candidate_id,
        technical_skills=review_data.technical_skills,
        communication=review_data.communication,
        problem_solving=review_data.problem_solving,
        cultural_fit=review_data.cultural_fit,
        overall_rating=review_data.overall_rating,
        strengths=review_data.strengths,
        areas_for_improvement=review_data.areas_for_improvement,
        notes=review_data.notes,
        recommendation=review_data.recommendation,
        llm_generated_feedback=review_data.llm_generated_feedback,  # Chatbot Q&A
        previous_reviews_context=previous_reviews_snapshot if previous_reviews_snapshot else None
    )
    db.add(review)

    # Snapshot whatever questions were prepared for *this* interviewer at the
    # moment they marked it conducted. The mutable QuestionBank gets re-used
    # across rounds; this row is the immutable record of what was asked.
    snapshot_id: Optional[str] = None
    qb = db.query(QuestionBank).filter(
        QuestionBank.candidate_id == schedule.candidate_id
    ).first()
    if qb:
        existing_snapshot = db.query(InterviewQuestionsSnapshot).filter(
            InterviewQuestionsSnapshot.schedule_id == schedule_id
        ).first()
        if not existing_snapshot:
            snapshot = InterviewQuestionsSnapshot(
                schedule_id=schedule_id,
                interviewer_id=current_user.id,
                candidate_id=schedule.candidate_id,
                jd_based_questions=qb.jd_based_questions,
                fundamental_questions=qb.fundamental_questions,
                resume_questions=qb.resume_questions,
                behavioral_questions=qb.behavioral_questions,
                insights_based_questions=qb.insights_based_questions,
                red_flag_probes=qb.red_flag_probes,
                leetcode_questions=qb.leetcode_questions,
                follow_up_topics=qb.follow_up_topics,
                modified_by_interviewer=bool(qb.modified_by_interviewer),
                chat_history=qb.chat_history,
            )
            db.add(snapshot)
            db.flush()
            snapshot_id = snapshot.id
        else:
            snapshot_id = existing_snapshot.id

    # Update schedule status to completed
    schedule.status = InterviewStatus.COMPLETED
    schedule.confirmed_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(review)

    # Phase 6: Baton Passing - Check if this is the final round
    is_final_round = False
    final_round_message = None

    if round_info and round_info.is_final_round:
        is_final_round = True
        final_round_message = "This was the final interview round. HR will be notified to make a hiring decision."

        # Update candidate status based on recommendation
        candidate = db.query(Candidate).filter(Candidate.id == schedule.candidate_id).first()
        if candidate:
            # Map recommendation to candidate status
            if review.recommendation in ['strong_yes', 'yes']:
                # Strong positive recommendation → move to offer consideration
                # HR will review and decide
                logger.info(f"Final round positive for candidate {candidate.id}: {review.recommendation}")
                # Could update status to a "pending_offer" state if you have one
                # candidate.status = CandidateStatus.OFFER
            elif review.recommendation == 'maybe':
                # Borderline case → HR needs to review
                logger.info(f"Final round borderline for candidate {candidate.id}")
            else:
                # Negative recommendation → likely rejection
                logger.info(f"Final round negative for candidate {candidate.id}: {review.recommendation}")
                # candidate.status = CandidateStatus.REJECTED

            # TODO Phase 6: Send notification email to HR
            # email_service.send_final_round_notification(
            #     candidate=candidate,
            #     review=review,
            #     all_reviews=previous_reviews_snapshot
            # )

            db.commit()

    return {
        "message": "Interview review submitted successfully",
        "review_id": review.id,
        "recommendation": review.recommendation,
        "schedule_status": schedule.status.value,
        "questions_snapshot_id": snapshot_id,
        "is_final_round": is_final_round,
        "final_round_message": final_round_message,
    }


@router.get("/schedule/{schedule_id}/review")
def get_interview_review(
    schedule_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get the review for a specific interview."""
    if current_user.role != UserRole.INTERVIEWER:
        raise HTTPException(
            status_code=403,
            detail="Only interviewers can access this endpoint"
        )
    
    schedule = db.query(InterviewSchedule).filter(
        InterviewSchedule.id == schedule_id,
        InterviewSchedule.interviewer_id == current_user.id
    ).first()
    
    if not schedule:
        raise HTTPException(
            status_code=404,
            detail="Interview schedule not found or not assigned to you"
        )
    
    review = db.query(InterviewReview).filter(
        InterviewReview.schedule_id == schedule_id
    ).first()
    
    if not review:
        return {"has_review": False}
    
    return {
        "has_review": True,
        "review": {
            "id": review.id,
            "technical_skills": review.technical_skills,
            "communication": review.communication,
            "problem_solving": review.problem_solving,
            "cultural_fit": review.cultural_fit,
            "overall_rating": review.overall_rating,
            "strengths": review.strengths,
            "areas_for_improvement": review.areas_for_improvement,
            "notes": review.notes,
            "recommendation": review.recommendation,
            "created_at": review.created_at.isoformat()
        }
    }


# Review Assistant Endpoints (Phase 3)


class ReviewAssistantRequest(BaseModel):
    """Request for AI-guided review questions."""
    schedule_id: str
    basic_metrics: Dict[str, Any]  # technical_skills, communication, etc.


class ReviewChatRequest(BaseModel):
    """Request for review chat refinement."""
    message: str
    conversation_history: Optional[List[Dict[str, Any]]] = None


@router.post("/schedule/{schedule_id}/review-assistant")
async def get_review_guidance(
    schedule_id: str,
    request: ReviewAssistantRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get AI-guided review questions based on QB snapshot and metrics.

    Analyzes the question bank used and basic ratings to generate
    targeted questions that help the interviewer write a comprehensive review.
    """
    if current_user.role != UserRole.INTERVIEWER:
        raise HTTPException(status_code=403, detail="Only interviewers can access this endpoint")

    # Verify access
    schedule = db.query(InterviewSchedule).filter(
        InterviewSchedule.id == schedule_id,
        InterviewSchedule.interviewer_id == current_user.id
    ).first()

    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found or not assigned to you")

    candidate = db.query(Candidate).filter(Candidate.id == schedule.candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # Get QB snapshot if it exists
    qb_snapshot_data = {}
    snapshot = db.query(InterviewQuestionsSnapshot).filter(
        InterviewQuestionsSnapshot.schedule_id == schedule_id
    ).first()

    if snapshot:
        qb_snapshot_data = {
            "jd_based_questions": snapshot.jd_based_questions or [],
            "fundamental_questions": snapshot.fundamental_questions or [],
            "resume_questions": snapshot.resume_questions or [],
            "behavioral_questions": snapshot.behavioral_questions or [],
            "insights_based_questions": snapshot.insights_based_questions or [],
            "red_flag_probes": snapshot.red_flag_probes or [],
        }
    else:
        # Fall back to current QB if no snapshot yet
        qb = db.query(QuestionBank).filter(QuestionBank.candidate_id == candidate.id).first()
        if qb:
            qb_snapshot_data = {
                "jd_based_questions": qb.jd_based_questions or [],
                "fundamental_questions": qb.fundamental_questions or [],
                "resume_questions": qb.resume_questions or [],
                "behavioral_questions": qb.behavioral_questions or [],
                "insights_based_questions": qb.insights_based_questions or [],
                "red_flag_probes": qb.red_flag_probes or [],
            }

    # Get previous reviews
    round_info = db.query(InterviewRound).filter(
        InterviewRound.id == schedule.interview_round_id
    ).first()

    previous_reviews = []
    if round_info and round_info.round_number > 1:
        prev_reviews_query = db.query(InterviewReview, InterviewSchedule, InterviewRound).join(
            InterviewSchedule, InterviewReview.schedule_id == InterviewSchedule.id
        ).join(
            InterviewRound, InterviewSchedule.interview_round_id == InterviewRound.id
        ).filter(
            InterviewReview.candidate_id == candidate.id,
            InterviewRound.round_number < round_info.round_number
        ).order_by(InterviewRound.round_number.asc()).all()

        for prev_review, prev_sched, prev_round in prev_reviews_query:
            previous_reviews.append({
                "round_number": prev_round.round_number,
                "overall_rating": prev_review.overall_rating,
                "recommendation": prev_review.recommendation,
                "strengths": prev_review.strengths,
                "areas_for_improvement": prev_review.areas_for_improvement,
            })

    # Generate review guidance
    result = await review_assistant.generate_review_questions(
        qb_snapshot=qb_snapshot_data,
        basic_metrics=request.basic_metrics,
        previous_reviews=previous_reviews if previous_reviews else None,
        candidate_name=candidate.name,
        round_number=round_info.round_number if round_info else 1,
    )

    return result


@router.post("/schedule/{schedule_id}/review-chat")
async def review_chat(
    schedule_id: str,
    request: ReviewChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Chat with AI assistant for review refinement.

    Provides session-based conversation to help refine review responses.
    """
    if current_user.role != UserRole.INTERVIEWER:
        raise HTTPException(status_code=403, detail="Only interviewers can access this endpoint")

    # Verify access
    schedule = db.query(InterviewSchedule).filter(
        InterviewSchedule.id == schedule_id,
        InterviewSchedule.interviewer_id == current_user.id
    ).first()

    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found or not assigned to you")

    # Optional: include context (QB, metrics) in chat
    context = {
        "candidate_id": schedule.candidate_id,
        "schedule_id": schedule_id,
    }

    result = await review_assistant.chat_review_refinement(
        conversation_history=request.conversation_history or [],
        user_message=request.message,
        context=context,
    )

    return result
