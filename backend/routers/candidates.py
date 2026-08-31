"""Candidate management endpoints."""
import os
import uuid
import base64
from datetime import datetime
from typing import Optional, List
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Form, Body
from fastapi.responses import FileResponse, Response
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel

from database import get_db
from models import (
    Candidate, Job, User, CandidateStatus, CandidateAssignment, UserRole,
    CandidateInsights, CandidateStatusHistory, CommunicationLog, InterviewSchedule
)
from schemas import (
    CandidateCreate, CandidateUpdate, CandidateResponse,
    CandidateDetailResponse, CandidateListResponse, AssignmentCreate, AssignmentResponse,
    ResumeExtractRequest, ResumeExtractResponse, CandidateInsightsResponse,
    InsightScores, MindsetAnalysis, TechnicalAnalysis, ExperienceAnalysis, InsightsSummary, JobMatchAnalysis,
    CandidateTimelineResponse, TimelineEvent, TimelineActor, CandidateRankingStats
)
from services.auth_service import get_current_user, require_hr_admin
from services.resume_parser import extract_text_from_pdf, extract_basic_info, extract_all_info_ocr
from services.llm_extractor import extract_resume_info
from services.insights_generator import generate_insights, insights_to_db_format
from services.email_service import email_service
from services.uploadthing_service import download_pdf as ut_download_pdf
from services.timeline_builder import build_candidate_timeline
from config import UPLOAD_DIR, MAX_UPLOAD_SIZE_MB

router = APIRouter(prefix="/candidates", tags=["Candidates"])


def update_candidate_status_with_history(
    db: Session,
    candidate: Candidate,
    new_status: CandidateStatus,
    changed_by: Optional[str] = None,
    notes: Optional[str] = None
):
    """Update candidate status and create a status history record."""
    old_status = candidate.status
    if old_status == new_status:
        return  # No change needed

    candidate.status = new_status

    history = CandidateStatusHistory(
        candidate_id=candidate.id,
        old_status=old_status.value if hasattr(old_status, 'value') else str(old_status),
        new_status=new_status.value if hasattr(new_status, 'value') else str(new_status),
        changed_by=changed_by,
        notes=notes
    )
    db.add(history)
    db.commit()


def candidate_to_response(candidate: Candidate, db: Session = None) -> CandidateResponse:
    """Convert Candidate model to response schema."""
    # Check if insights exist and get score
    has_insights = False
    overall_score = None

    if candidate.insights is not None:
        has_insights = True
        overall_score = candidate.insights.overall_score

    return CandidateResponse(
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
        has_insights=has_insights,
        overall_score=overall_score
    )


@router.post("", response_model=CandidateDetailResponse, status_code=status.HTTP_201_CREATED)
async def create_candidate(
    name: str = Form(...),
    job_id: str = Form(...),
    email: Optional[str] = Form(None),
    phone: Optional[str] = Form(None),
    skills: Optional[str] = Form(None),  # JSON array as string
    experience_years: Optional[str] = Form(None),
    current_position: Optional[str] = Form(None),
    education: Optional[str] = Form(None),  # JSON array as string
    resume: Optional[UploadFile] = File(None),
    resume_url: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hr_admin)
):
    """Create a new candidate with optional resume upload (HR Admin only).

    When a resume is uploaded, OCR extraction automatically fills in missing fields:
    - name (if provided as 'Unknown')
    - email
    - phone
    - skills
    - experience_years
    - current_position
    - education

    The extraction uses regex-based OCR (fast, no LLM calls).
    """
    import json

    # Verify job exists
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found"
        )

    resume_path = None
    resume_text = None
    skills_list = None
    education_list = None

    # Parse skills if provided
    if skills:
        try:
            skills_list = json.loads(skills)
        except json.JSONDecodeError:
            # If not valid JSON, try comma-separated
            skills_list = [s.strip() for s in skills.split(",") if s.strip()]

    # Parse education if provided
    if education:
        try:
            education_list = json.loads(education)
        except json.JSONDecodeError:
            education_list = None

    # Handle resume — preferred: resume_url from a prior UploadThing upload.
    # Fallback: legacy multipart file (still supported for tests / direct API use).
    if resume_url:
        resume_path = resume_url
        resume_text = extract_text_from_pdf(resume_url)
    elif resume:
        if not resume.filename.lower().endswith('.pdf'):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only PDF files are supported"
            )

        content = await resume.read()

        if len(content) > MAX_UPLOAD_SIZE_MB * 1024 * 1024:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File size exceeds {MAX_UPLOAD_SIZE_MB}MB limit"
            )

        # Legacy local-storage path (no UploadThing URL provided).
        UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        file_id = str(uuid.uuid4())
        filename = f"{file_id}.pdf"
        file_path = UPLOAD_DIR / filename

        with open(file_path, "wb") as f:
            f.write(content)

        resume_path = str(file_path)
        resume_text = extract_text_from_pdf(file_path)

    # Auto-fill missing fields using OCR extraction (no LLM calls)
    if resume_text:
        ocr_data = extract_all_info_ocr(resume_text)
        if not email and ocr_data.get("email"):
            email = ocr_data["email"]
        if not phone and ocr_data.get("phone"):
            phone = ocr_data["phone"]
        if (name == "Unknown" or not name) and ocr_data.get("name"):
            name = ocr_data["name"]
        if not skills_list and ocr_data.get("skills"):
            skills_list = ocr_data["skills"]
        if not experience_years and ocr_data.get("experience_years"):
            experience_years = ocr_data["experience_years"]
        if not current_position and ocr_data.get("current_position"):
            current_position = ocr_data["current_position"]
        if not education_list and ocr_data.get("education"):
            education_list = ocr_data["education"]

    # Create candidate
    candidate = Candidate(
        name=name or "Unknown",
        email=email,
        phone=phone,
        skills=skills_list,
        experience_years=experience_years,
        current_position=current_position,
        education=education_list,
        resume_path=resume_path,
        resume_text=resume_text,
        job_id=job_id,
        status=CandidateStatus.APPLIED
    )

    db.add(candidate)
    db.commit()
    db.refresh(candidate)

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
        job_title=job.title,
        has_insights=False
    )


@router.get("/ranking-stats/{job_id}", response_model=CandidateRankingStats)
def get_job_ranking_stats(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get ranking statistics for candidates in a specific job.

    Returns score distribution, averages, and top candidates to help HR
    understand the candidate pool quality at a glance.
    """
    # Verify job exists
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Get all candidates for this job
    total_candidates = db.query(Candidate).filter(Candidate.job_id == job_id).count()

    # Get candidates with insights and scores
    candidates_with_insights = db.query(
        Candidate, CandidateInsights
    ).join(
        CandidateInsights,
        Candidate.id == CandidateInsights.candidate_id
    ).filter(
        Candidate.job_id == job_id,
        CandidateInsights.overall_score.isnot(None)
    ).all()

    candidates_with_scores = len(candidates_with_insights)

    if candidates_with_scores == 0:
        return CandidateRankingStats(
            job_id=job_id,
            job_title=job.title,
            total_candidates=total_candidates,
            candidates_with_scores=0,
            score_distribution={},
            average_score=None,
            top_candidate_score=None,
            top_candidate_name=None,
            candidates_above_80=0,
            candidates_above_70=0,
            candidates_above_60=0
        )

    # Calculate statistics
    scores = [insights.overall_score for _, insights in candidates_with_insights]
    average_score = sum(scores) / len(scores)

    # Score distribution
    score_buckets = {
        "90-100": 0,
        "80-89": 0,
        "70-79": 0,
        "60-69": 0,
        "50-59": 0,
        "40-49": 0,
        "0-39": 0
    }

    for score in scores:
        if score >= 90:
            score_buckets["90-100"] += 1
        elif score >= 80:
            score_buckets["80-89"] += 1
        elif score >= 70:
            score_buckets["70-79"] += 1
        elif score >= 60:
            score_buckets["60-69"] += 1
        elif score >= 50:
            score_buckets["50-59"] += 1
        elif score >= 40:
            score_buckets["40-49"] += 1
        else:
            score_buckets["0-39"] += 1

    # Count candidates by threshold
    candidates_above_80 = sum(1 for s in scores if s >= 80)
    candidates_above_70 = sum(1 for s in scores if s >= 70)
    candidates_above_60 = sum(1 for s in scores if s >= 60)

    # Get top candidate
    top_pair = max(candidates_with_insights, key=lambda x: x[1].overall_score)
    top_candidate, top_insights = top_pair

    return CandidateRankingStats(
        job_id=job_id,
        job_title=job.title,
        total_candidates=total_candidates,
        candidates_with_scores=candidates_with_scores,
        score_distribution=score_buckets,
        average_score=round(average_score, 1),
        top_candidate_score=top_insights.overall_score,
        top_candidate_name=top_candidate.name,
        candidates_above_80=candidates_above_80,
        candidates_above_70=candidates_above_70,
        candidates_above_60=candidates_above_60
    )


@router.get("/ranked", response_model=CandidateListResponse)
def get_ranked_candidates(
    job_id: Optional[str] = Query(None, description="Filter by job ID (required for meaningful ranking)"),
    status: Optional[CandidateStatus] = Query(None, description="Filter by status"),
    min_score: Optional[int] = Query(None, ge=0, le=100, description="Minimum overall score"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get ranked candidates sorted by AI-generated overall score (highest first).

    This endpoint is optimized for HR to prioritize candidates for interviews.
    Only returns candidates who have insights generated.

    Rankings are job-specific when job_id is provided, ensuring candidates
    are scored against the actual job requirements.
    """
    # Base query: only candidates with insights
    query = db.query(Candidate).join(
        CandidateInsights,
        Candidate.id == CandidateInsights.candidate_id
    ).filter(
        CandidateInsights.overall_score.isnot(None)  # Must have a score
    )

    if job_id:
        query = query.filter(Candidate.job_id == job_id)
    if status:
        query = query.filter(Candidate.status == status)
    if min_score is not None:
        query = query.filter(CandidateInsights.overall_score >= min_score)

    total = query.count()

    # Order by score descending (highest first), then by date
    query = query.order_by(
        CandidateInsights.overall_score.desc(),
        Candidate.applied_at.desc()
    )

    candidates = query.offset(skip).limit(limit).all()

    return CandidateListResponse(
        candidates=[candidate_to_response(c, db) for c in candidates],
        total=total
    )


@router.get("", response_model=CandidateListResponse)
def list_candidates(
    job_id: Optional[str] = Query(None, description="Filter by job ID"),
    status: Optional[CandidateStatus] = Query(None, description="Filter by status"),
    sort_by: Optional[str] = Query("applied_at", description="Sort by: 'applied_at', 'score', 'name'"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List candidates with optional filters and sorting.

    Supports sorting by:
    - 'applied_at': Most recent applications first (default)
    - 'score': Highest scoring candidates first (requires insights)
    - 'name': Alphabetical order
    """
    query = db.query(Candidate)

    if job_id:
        query = query.filter(Candidate.job_id == job_id)
    if status:
        query = query.filter(Candidate.status == status)

    total = query.count()

    # Apply sorting
    if sort_by == "score":
        # Join with insights and sort by overall_score descending, nulls last
        query = query.outerjoin(CandidateInsights, Candidate.id == CandidateInsights.candidate_id)
        query = query.order_by(
            CandidateInsights.overall_score.desc().nullslast(),
            Candidate.applied_at.desc()  # Secondary sort by date
        )
    elif sort_by == "name":
        query = query.order_by(Candidate.name.asc())
    else:  # Default: applied_at
        query = query.order_by(Candidate.applied_at.desc())

    candidates = query.offset(skip).limit(limit).all()

    return CandidateListResponse(
        candidates=[candidate_to_response(c, db) for c in candidates],
        total=total
    )


@router.get("/{candidate_id}", response_model=CandidateDetailResponse)
def get_candidate(
    candidate_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get detailed candidate information including resume text."""
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()

    if not candidate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidate not found"
        )

    job = db.query(Job).filter(Job.id == candidate.job_id).first()

    # Check if insights exist
    has_insights = candidate.insights is not None

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


@router.get("/{candidate_id}/interview-timeline", response_model=CandidateTimelineResponse)
def get_candidate_interview_timeline(
    candidate_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Return one chronologically-ordered event stream for a candidate.

    Auth: any authenticated user. Talent memory is shared by design (per
    PHILOSOPHY.md "talent memory accessible to interviewers, not just HR"),
    matching the access model of /talent/candidate/{id}/history. Read-only —
    derived entirely from existing rows.
    """
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidate not found"
        )

    job = db.query(Job).filter(Job.id == candidate.job_id).first()
    raw_events = build_candidate_timeline(db, candidate)

    events = [
        TimelineEvent(
            kind=e["kind"],
            at=e["at"],
            actor=TimelineActor(**e["actor"]) if e.get("actor") else None,
            title=e["title"],
            body=e.get("body"),
            meta=e.get("meta") or {},
        )
        for e in raw_events
    ]

    return CandidateTimelineResponse(
        candidate_id=candidate.id,
        candidate_name=candidate.name,
        job_title=job.title if job else None,
        events=events,
    )


@router.put("/{candidate_id}", response_model=CandidateResponse)
def update_candidate(
    candidate_id: str,
    candidate_data: CandidateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hr_admin)
):
    """Update candidate information (HR Admin only)."""
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()

    if not candidate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidate not found"
        )

    if candidate_data.name is not None:
        candidate.name = candidate_data.name
    if candidate_data.email is not None:
        candidate.email = candidate_data.email
    if candidate_data.phone is not None:
        candidate.phone = candidate_data.phone
    if candidate_data.skills is not None:
        candidate.skills = candidate_data.skills
    if candidate_data.experience_years is not None:
        candidate.experience_years = candidate_data.experience_years
    if candidate_data.current_position is not None:
        candidate.current_position = candidate_data.current_position
    if candidate_data.education is not None:
        candidate.education = [e.dict() if hasattr(e, 'dict') else e for e in candidate_data.education]
    if candidate_data.status is not None:
        candidate.status = candidate_data.status

    db.commit()
    db.refresh(candidate)

    return candidate_to_response(candidate)


@router.put("/{candidate_id}/status", response_model=CandidateResponse)
def update_candidate_status_endpoint(
    candidate_id: str,
    new_status: CandidateStatus = Query(..., alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hr_admin)
):
    """Update candidate status (HR Admin only)."""
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()

    if not candidate:
        raise HTTPException(
            status_code=404,
            detail="Candidate not found"
        )

    update_candidate_status_with_history(
        db, candidate, new_status,
        changed_by=current_user.id,
        notes=f"Status manually updated to {new_status.value}"
    )
    db.refresh(candidate)

    return candidate_to_response(candidate)


@router.delete("/{candidate_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_candidate(
    candidate_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hr_admin)
):
    """Delete a candidate (HR Admin only)."""
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()

    if not candidate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidate not found"
        )

    # Delete resume file if exists
    if candidate.resume_path and os.path.exists(candidate.resume_path):
        os.remove(candidate.resume_path)

    # Delete assignments first
    db.query(CandidateAssignment).filter(CandidateAssignment.candidate_id == candidate_id).delete()

    db.delete(candidate)
    db.commit()


# ----- Assignment Endpoints -----
@router.post("/{candidate_id}/assign", response_model=AssignmentResponse)
def assign_candidate_to_interviewer(
    candidate_id: str,
    assignment: AssignmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hr_admin)
):
    """Assign a candidate to an interviewer (HR Admin only)."""
    # Verify candidate exists
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # Verify interviewer exists and is an interviewer
    interviewer = db.query(User).filter(User.id == assignment.interviewer_id).first()
    if not interviewer:
        raise HTTPException(status_code=404, detail="Interviewer not found")
    if interviewer.role != UserRole.INTERVIEWER:
        raise HTTPException(status_code=400, detail="User is not an interviewer")

    # Create assignment
    new_assignment = CandidateAssignment(
        candidate_id=candidate_id,
        interviewer_id=assignment.interviewer_id,
        round_number=assignment.round_number
    )

    db.add(new_assignment)
    db.commit()
    db.refresh(new_assignment)

    return AssignmentResponse(
        id=new_assignment.id,
        candidate_id=new_assignment.candidate_id,
        interviewer_id=new_assignment.interviewer_id,
        round_number=new_assignment.round_number,
        assigned_at=new_assignment.assigned_at,
        candidate=candidate_to_response(candidate)
    )


# ----- HR Candidate Status Actions (Accept / Hire / Reject) -----

@router.post("/{candidate_id}/accept", response_model=CandidateResponse)
def accept_candidate(
    candidate_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hr_admin)
):
    """Move candidate to 'offer' status (HR Admin only).

    Typically used after all interview rounds are completed with positive reviews.
    """
    from routers.interviews import update_candidate_status as _update_status

    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    if candidate.status == CandidateStatus.OFFER:
        return candidate_to_response(candidate)

    if candidate.status in (CandidateStatus.HIRED, CandidateStatus.REJECTED):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot move to 'offer' from current status '{candidate.status.value}'"
        )

    _update_status(
        db=db,
        candidate=candidate,
        new_status=CandidateStatus.OFFER,
        changed_by_id=current_user.id,
        notes="HR accepted candidate - moved to offer stage"
    )
    db.commit()
    db.refresh(candidate)

    return candidate_to_response(candidate)


@router.post("/{candidate_id}/hire", response_model=CandidateResponse)
def hire_candidate(
    candidate_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hr_admin)
):
    """Move candidate to 'hired' status (HR Admin only).

    Typically used after an offer has been extended and accepted.
    """
    from routers.interviews import update_candidate_status as _update_status

    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    if candidate.status == CandidateStatus.HIRED:
        return candidate_to_response(candidate)

    if candidate.status == CandidateStatus.REJECTED:
        raise HTTPException(
            status_code=400,
            detail="Cannot hire a rejected candidate"
        )

    _update_status(
        db=db,
        candidate=candidate,
        new_status=CandidateStatus.HIRED,
        changed_by_id=current_user.id,
        notes="HR hired candidate"
    )
    db.commit()
    db.refresh(candidate)

    return candidate_to_response(candidate)


@router.post("/{candidate_id}/reject", response_model=CandidateResponse)
def reject_candidate(
    candidate_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hr_admin)
):
    """Move candidate to 'rejected' status (HR Admin only).

    Can be used at any stage of the pipeline.
    """
    from routers.interviews import update_candidate_status as _update_status

    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    if candidate.status == CandidateStatus.REJECTED:
        return candidate_to_response(candidate)

    if candidate.status == CandidateStatus.HIRED:
        raise HTTPException(
            status_code=400,
            detail="Cannot reject an already hired candidate"
        )

    _update_status(
        db=db,
        candidate=candidate,
        new_status=CandidateStatus.REJECTED,
        changed_by_id=current_user.id,
        notes="HR rejected candidate"
    )
    db.commit()
    db.refresh(candidate)

    return candidate_to_response(candidate)


# ----- Resume Extraction Endpoints -----
@router.post("/extract", response_model=ResumeExtractResponse)
async def extract_resume_details(
    request: ResumeExtractRequest,
    current_user: User = Depends(require_hr_admin)
):
    """Extract candidate details from resume text using AI (HR Admin only)."""
    if not request.resume_text or len(request.resume_text.strip()) < 50:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Resume text is too short or empty"
        )

    extracted = await extract_resume_info(request.resume_text)

    return ResumeExtractResponse(
        name=extracted.get("name"),
        email=extracted.get("email"),
        phone=extracted.get("phone"),
        skills=extracted.get("skills", []),
        experience_years=extracted.get("experience_years"),
        current_position=extracted.get("current_position"),
        education=extracted.get("education", [])
    )


@router.get("/{candidate_id}/resume")
async def get_candidate_resume(
    candidate_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Download/view the candidate's resume PDF."""
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()

    if not candidate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidate not found"
        )

    if not candidate.resume_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No resume uploaded for this candidate"
        )

    safe_name = candidate.name.replace(' ', '_')
    filename = f"{safe_name}_resume.pdf"

    if candidate.resume_path.startswith(("http://", "https://")):
        try:
            content = await ut_download_pdf(candidate.resume_path)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Failed to fetch resume from CDN: {e}",
            )
        return Response(
            content=content,
            media_type="application/pdf",
            headers={"Content-Disposition": f'inline; filename="{filename}"'},
        )

    resume_path = Path(candidate.resume_path)
    if not resume_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume file not found"
        )
    return FileResponse(
        path=resume_path,
        media_type="application/pdf",
        filename=filename,
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


# ----- Insights Endpoints -----
def _insights_to_response(insights: CandidateInsights) -> CandidateInsightsResponse:
    """Convert CandidateInsights model to response schema."""
    scores_data = insights.scores_breakdown or {}
    mindset_data = insights.mindset_analysis or {}
    technical_data = insights.technical_analysis or {}
    experience_data = insights.experience_analysis or {}
    summary_data = insights.summary or {}

    return CandidateInsightsResponse(
        id=insights.id,
        candidate_id=insights.candidate_id,
        scores=InsightScores(
            overall_score=scores_data.get("overall_score"),
            technical_depth=scores_data.get("technical_depth"),
            experience_relevance=scores_data.get("experience_relevance"),
            education_quality=scores_data.get("education_quality"),
            startup_mindset=scores_data.get("startup_mindset"),
            communication_signals=scores_data.get("communication_signals"),
        ),
        mindset=MindsetAnalysis(
            startup_fit=mindset_data.get("startup_fit"),
            fit_level=mindset_data.get("fit_level"),
            positive_signals=mindset_data.get("positive_signals", []),
            concerns=mindset_data.get("concerns", []),
            culture_indicators=mindset_data.get("culture_indicators", []),
        ),
        technical=TechnicalAnalysis(
            primary_skills=technical_data.get("primary_skills", []),
            skill_depth=technical_data.get("skill_depth"),
            missing_skills=technical_data.get("missing_skills", []),
            tech_trajectory=technical_data.get("tech_trajectory"),
            standout_technical=technical_data.get("standout_technical"),
        ),
        experience=ExperienceAnalysis(
            total_years=experience_data.get("total_years"),
            highlights=experience_data.get("highlights", []),
            trajectory=experience_data.get("trajectory"),
            red_flags=experience_data.get("red_flags", []),
            company_types=experience_data.get("company_types", []),
            leadership_signals=experience_data.get("leadership_signals", []),
        ),
        summary=InsightsSummary(
            headline=summary_data.get("headline"),
            top_strengths=summary_data.get("top_strengths", []),
            key_concerns=summary_data.get("key_concerns", []),
            areas_to_probe=summary_data.get("areas_to_probe", []),
            quick_verdict=summary_data.get("quick_verdict"),
        ),
        job_match=JobMatchAnalysis(
            required_skills_match=(insights.job_match or {}).get("required_skills_match", []),
            required_skills_missing=(insights.job_match or {}).get("required_skills_missing", []),
            match_percentage=(insights.job_match or {}).get("match_percentage"),
            experience_gap=(insights.job_match or {}).get("experience_gap"),
            overall_fit_for_role=(insights.job_match or {}).get("overall_fit_for_role"),
        ) if insights.job_match else None,
        generated_at=insights.generated_at,
    )


@router.post("/{candidate_id}/insights", response_model=CandidateInsightsResponse)
async def generate_candidate_insights(
    candidate_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Generate deep insights for a candidate using AI analysis.

    This endpoint generates or regenerates detailed insights including:
    - Quantifiable scores (0-100) for ranking
    - Startup mindset analysis
    - Technical depth assessment
    - Experience highlights and red flags
    - Interview areas to probe
    """
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()

    if not candidate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidate not found"
        )

    if not candidate.resume_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Candidate has no resume text to analyze"
        )

    # Get job details for context
    job = db.query(Job).filter(Job.id == candidate.job_id).first()

    # Generate insights using LLM with full job context
    insights_data = await generate_insights(
        resume_text=candidate.resume_text,
        job_title=job.title if job else None,
        job_description=job.description if job else None,
        job_requirements=job.requirements if job else None
    )
    db_data = insights_to_db_format(insights_data)

    # Check if insights already exist
    existing = db.query(CandidateInsights).filter(
        CandidateInsights.candidate_id == candidate_id
    ).first()

    if existing:
        # Update existing insights
        for key, value in db_data.items():
            setattr(existing, key, value)
        db.commit()
        db.refresh(existing)
        return _insights_to_response(existing)
    else:
        # Create new insights
        new_insights = CandidateInsights(
            candidate_id=candidate_id,
            **db_data
        )
        db.add(new_insights)
        db.commit()
        db.refresh(new_insights)
        return _insights_to_response(new_insights)


@router.get("/{candidate_id}/insights", response_model=CandidateInsightsResponse)
def get_candidate_insights(
    candidate_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get existing insights for a candidate.

    Returns 404 if insights haven't been generated yet.
    Use POST to generate insights first.
    """
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()

    if not candidate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidate not found"
        )

    insights = db.query(CandidateInsights).filter(
        CandidateInsights.candidate_id == candidate_id
    ).first()

    if not insights:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Insights not generated yet. Use POST to generate insights."
        )

    return _insights_to_response(insights)


# ----- OCR Extraction Endpoint -----
@router.post("/extract-ocr", response_model=ResumeExtractResponse)
async def extract_resume_ocr(
    request: ResumeExtractRequest,
    current_user: User = Depends(require_hr_admin)
):
    """Extract candidate details from resume text using OCR/regex only (no LLM).

    This is faster and cheaper than the /extract endpoint which uses LLM.
    Use this for basic field extraction (name, email, phone, skills).
    """
    if not request.resume_text or len(request.resume_text.strip()) < 50:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Resume text is too short or empty"
        )

    extracted = extract_all_info_ocr(request.resume_text)

    return ResumeExtractResponse(
        name=extracted.get("name"),
        email=extracted.get("email"),
        phone=extracted.get("phone"),
        skills=extracted.get("skills", []),
        experience_years=extracted.get("experience_years"),
        current_position=extracted.get("current_position"),
        education=extracted.get("education", [])
    )


# ----- Offer Letter Endpoint -----

class OfferLetterRequest(BaseModel):
    subject: str
    body_html: str
    body_text: Optional[str] = None
    attachment_base64: Optional[str] = None
    attachment_filename: Optional[str] = None


@router.post("/{candidate_id}/offer-letter")
def send_offer_letter(
    candidate_id: str,
    request: OfferLetterRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hr_admin)
):
    """Send an offer letter to a candidate (HR Admin only)."""
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    if not candidate.email:
        raise HTTPException(status_code=400, detail="Candidate has no email address")

    job = db.query(Job).filter(Job.id == candidate.job_id).first()

    # Send email
    success = email_service.send_email(
        to_email=candidate.email,
        subject=request.subject,
        html_body=request.body_html,
        text_body=request.body_text or request.body_html
    )

    # Log the communication
    comm_log = CommunicationLog(
        candidate_id=candidate.id,
        recipient_email=candidate.email,
        recipient_name=candidate.name,
        subject=request.subject,
        body_html=request.body_html,
        body_text=request.body_text,
        status="sent" if success else "failed",
        extra_data={"type": "offer_letter", "job_id": candidate.job_id, "job_title": job.title if job else None}
    )
    db.add(comm_log)
    db.commit()
    db.refresh(comm_log)

    if success:
        return {"message": "Offer letter sent successfully", "communication_log_id": comm_log.id}
    else:
        return {"message": "Offer letter logged (email delivery may be pending in dev mode)", "communication_log_id": comm_log.id}
