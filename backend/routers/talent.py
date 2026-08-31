"""Talent Memory and Re-engagement Router.

Provides endpoints for:
- Searching the talent database
- Getting candidate history
- Managing re-engagement candidates
"""
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database import get_db
from models import (
    User, Candidate, Job, ReengagementCandidate, CandidateStatusHistory,
    UserRole, InterviewReview
)
from schemas import (
    TalentSearchFilters, TalentSearchResponse, TalentSearchResult,
    CandidateHistoryResponse, ReengagementCandidateCreate,
    ReengagementCandidateResponse, ReengagementStatusUpdate,
    CloseRejectCandidateResponse, PreviousReviewsResponse, ReviewContext
)
from services.auth_service import get_current_user, require_hr_admin
from services.talent_search import (
    search_candidates, get_candidate_history, find_close_rejected_candidates,
    get_previous_reviews_context
)

router = APIRouter(prefix="/talent", tags=["Talent Memory"])


@router.post("/search", response_model=TalentSearchResponse)
def search_talent(
    filters: TalentSearchFilters,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Search the talent database with various filters.
    
    Searches candidates by name, skills, job, date range, and interview scores.
    Returns paginated results sorted by relevance.
    """
    result = search_candidates(
        db=db,
        name=filters.name,
        skills=filters.skills,
        job_id=filters.job_id,
        min_experience_years=filters.min_experience_years,
        max_experience_years=filters.max_experience_years,
        status=[s for s in filters.status] if filters.status else None,
        min_overall_score=filters.min_overall_score,
        min_interview_rating=filters.min_interview_rating,
        date_from=filters.date_from,
        date_to=filters.date_to,
        has_insights=filters.has_insights,
        rounds_completed=filters.rounds_completed,
        page=page,
        page_size=page_size
    )
    
    return TalentSearchResponse(
        results=[TalentSearchResult(**r) for r in result["results"]],
        total=result["total"],
        page=result["page"],
        page_size=result["page_size"]
    )


@router.get("/candidate/{candidate_id}/history")
def get_full_candidate_history(
    candidate_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get complete history timeline for a candidate.
    
    Includes all interview rounds, reviews, status changes, and insights.
    """
    result = get_candidate_history(db, candidate_id)
    
    if not result:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    return result


@router.get("/candidate/{candidate_id}/previous-reviews", response_model=PreviousReviewsResponse)
def get_candidate_previous_reviews(
    candidate_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get previous reviews with extracted gold/grey areas.
    
    Used for baton passing between interview rounds.
    Returns structured review context with strengths and areas to probe.
    """
    result = get_previous_reviews_context(db, candidate_id)
    
    if not result:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    return PreviousReviewsResponse(
        candidate_id=result["candidate_id"],
        candidate_name=result["candidate_name"],
        total_reviews=result["total_reviews"],
        reviews=[ReviewContext(**r) for r in result["reviews"]],
        aggregated_gold_areas=result["aggregated_gold_areas"],
        aggregated_grey_areas=result["aggregated_grey_areas"]
    )


@router.get("/reengagement-candidates")
def list_reengagement_candidates(
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hr_admin)
):
    """List all candidates marked for re-engagement.
    
    HR Admin only.
    """
    query = db.query(ReengagementCandidate)
    
    if status:
        query = query.filter(ReengagementCandidate.status == status)
    
    reengagement_records = query.order_by(ReengagementCandidate.created_at.desc()).all()
    
    results = []
    for record in reengagement_records:
        candidate = db.query(Candidate).filter(Candidate.id == record.candidate_id).first()
        original_job = db.query(Job).filter(Job.id == record.original_job_id).first()
        new_job = db.query(Job).filter(Job.id == record.new_job_id).first() if record.new_job_id else None
        
        results.append({
            "id": record.id,
            "candidate_id": record.candidate_id,
            "candidate_name": candidate.name if candidate else "Unknown",
            "candidate_email": candidate.email if candidate else None,
            "original_job_id": record.original_job_id,
            "original_job_title": original_job.title if original_job else None,
            "new_job_id": record.new_job_id,
            "new_job_title": new_job.title if new_job else None,
            "reason": record.reason,
            "average_rating": record.average_rating,
            "contacted_date": record.contacted_date,
            "status": record.status,
            "created_at": record.created_at,
            "skills": candidate.skills if candidate else None
        })
    
    return results


@router.get("/close-rejected-candidates", response_model=List[CloseRejectCandidateResponse])
def get_close_rejected_candidates(
    min_avg_rating: float = Query(3.5, ge=1.0, le=5.0),
    min_highest_rating: int = Query(4, ge=1, le=5),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hr_admin)
):
    """Get rejected candidates who performed well - good for re-engagement.
    
    Returns candidates who were rejected but had high interview scores,
    making them good candidates to re-engage for new positions.
    
    HR Admin only.
    """
    candidates = find_close_rejected_candidates(
        db=db,
        min_avg_rating=min_avg_rating,
        min_highest_rating=min_highest_rating
    )
    
    return [CloseRejectCandidateResponse(**c) for c in candidates]


@router.post("/reengagement/{candidate_id}")
def mark_for_reengagement(
    candidate_id: str,
    request: ReengagementCandidateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hr_admin)
):
    """Mark a candidate for re-engagement.
    
    HR Admin only. Creates a re-engagement record for tracking.
    """
    # Verify candidate exists
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    # Check if already marked
    existing = db.query(ReengagementCandidate).filter(
        ReengagementCandidate.candidate_id == candidate_id,
        ReengagementCandidate.status.in_(["identified", "contacted", "responded"])
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Candidate already marked for re-engagement"
        )
    
    # Calculate average rating
    reviews = db.query(InterviewReview).filter(
        InterviewReview.candidate_id == candidate_id
    ).all()
    
    avg_rating = None
    if reviews:
        ratings = [r.overall_rating for r in reviews if r.overall_rating]
        if ratings:
            avg_rating = str(round(sum(ratings) / len(ratings), 2))
    
    # Verify new_job_id if provided
    if request.new_job_id:
        new_job = db.query(Job).filter(Job.id == request.new_job_id).first()
        if not new_job:
            raise HTTPException(status_code=404, detail="New job not found")
    
    reengagement = ReengagementCandidate(
        candidate_id=candidate_id,
        original_job_id=candidate.job_id,
        new_job_id=request.new_job_id,
        reason=request.reason,
        average_rating=avg_rating,
        status="identified"
    )
    
    db.add(reengagement)
    db.commit()
    db.refresh(reengagement)
    
    job = db.query(Job).filter(Job.id == candidate.job_id).first()
    new_job = db.query(Job).filter(Job.id == request.new_job_id).first() if request.new_job_id else None
    
    return {
        "id": reengagement.id,
        "candidate_id": reengagement.candidate_id,
        "candidate_name": candidate.name,
        "candidate_email": candidate.email,
        "original_job_id": reengagement.original_job_id,
        "original_job_title": job.title if job else None,
        "new_job_id": reengagement.new_job_id,
        "new_job_title": new_job.title if new_job else None,
        "reason": reengagement.reason,
        "average_rating": reengagement.average_rating,
        "status": reengagement.status,
        "created_at": reengagement.created_at
    }


@router.put("/reengagement/{reengagement_id}/status")
def update_reengagement_status(
    reengagement_id: str,
    request: ReengagementStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hr_admin)
):
    """Update the status of a re-engagement record.
    
    HR Admin only. Updates status and optionally sets contacted_date and new_job_id.
    """
    reengagement = db.query(ReengagementCandidate).filter(
        ReengagementCandidate.id == reengagement_id
    ).first()
    
    if not reengagement:
        raise HTTPException(status_code=404, detail="Re-engagement record not found")
    
    valid_statuses = ["identified", "contacted", "responded", "converted", "declined"]
    if request.status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}"
        )
    
    reengagement.status = request.status
    
    if request.contacted_date:
        reengagement.contacted_date = request.contacted_date
    elif request.status == "contacted" and not reengagement.contacted_date:
        reengagement.contacted_date = datetime.utcnow()
    
    if request.new_job_id:
        # Verify job exists
        new_job = db.query(Job).filter(Job.id == request.new_job_id).first()
        if not new_job:
            raise HTTPException(status_code=404, detail="New job not found")
        reengagement.new_job_id = request.new_job_id
    
    db.commit()
    db.refresh(reengagement)
    
    candidate = db.query(Candidate).filter(Candidate.id == reengagement.candidate_id).first()
    original_job = db.query(Job).filter(Job.id == reengagement.original_job_id).first()
    new_job = db.query(Job).filter(Job.id == reengagement.new_job_id).first() if reengagement.new_job_id else None
    
    return {
        "id": reengagement.id,
        "candidate_id": reengagement.candidate_id,
        "candidate_name": candidate.name if candidate else None,
        "status": reengagement.status,
        "contacted_date": reengagement.contacted_date,
        "new_job_id": reengagement.new_job_id,
        "new_job_title": new_job.title if new_job else None,
        "message": f"Status updated to {request.status}"
    }


@router.delete("/reengagement/{reengagement_id}")
def delete_reengagement_record(
    reengagement_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hr_admin)
):
    """Delete a re-engagement record.
    
    HR Admin only.
    """
    reengagement = db.query(ReengagementCandidate).filter(
        ReengagementCandidate.id == reengagement_id
    ).first()
    
    if not reengagement:
        raise HTTPException(status_code=404, detail="Re-engagement record not found")
    
    db.delete(reengagement)
    db.commit()
    
    return {"message": "Re-engagement record deleted", "id": reengagement_id}
