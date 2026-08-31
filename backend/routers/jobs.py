"""Job management endpoints."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db
from models import Job, User, Candidate, JobStatus
from schemas import JobCreate, JobUpdate, JobResponse, JobListResponse
from services.auth_service import get_current_user, require_hr_admin

router = APIRouter(prefix="/jobs", tags=["Jobs"])


def job_to_response(job: Job, candidate_count: int = 0) -> JobResponse:
    """Convert Job model to response schema."""
    return JobResponse(
        id=job.id,
        title=job.title,
        description=job.description,
        requirements=job.requirements,
        status=job.status,
        created_by=job.created_by,
        created_at=job.created_at,
        updated_at=job.updated_at,
        candidate_count=candidate_count
    )


@router.post("", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
def create_job(
    job_data: JobCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hr_admin)
):
    """Create a new job posting (HR Admin only)."""
    job = Job(
        title=job_data.title,
        description=job_data.description,
        requirements=job_data.requirements.model_dump() if job_data.requirements else None,
        status=job_data.status,
        created_by=current_user.id
    )
    
    db.add(job)
    db.commit()
    db.refresh(job)
    
    return job_to_response(job)


@router.get("", response_model=JobListResponse)
def list_jobs(
    status: Optional[JobStatus] = Query(None, description="Filter by job status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all jobs with optional status filter."""
    query = db.query(Job)
    
    if status:
        query = query.filter(Job.status == status)
    
    total = query.count()
    jobs = query.order_by(Job.created_at.desc()).offset(skip).limit(limit).all()
    
    # Get candidate counts for each job
    job_responses = []
    for job in jobs:
        candidate_count = db.query(func.count(Candidate.id)).filter(Candidate.job_id == job.id).scalar()
        job_responses.append(job_to_response(job, candidate_count))
    
    return JobListResponse(jobs=job_responses, total=total)


@router.get("/{job_id}", response_model=JobResponse)
def get_job(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific job by ID."""
    job = db.query(Job).filter(Job.id == job_id).first()
    
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found"
        )
    
    candidate_count = db.query(func.count(Candidate.id)).filter(Candidate.job_id == job.id).scalar()
    return job_to_response(job, candidate_count)


@router.put("/{job_id}", response_model=JobResponse)
def update_job(
    job_id: str,
    job_data: JobUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hr_admin)
):
    """Update a job posting (HR Admin only)."""
    job = db.query(Job).filter(Job.id == job_id).first()
    
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found"
        )
    
    # Update only provided fields
    if job_data.title is not None:
        job.title = job_data.title
    if job_data.description is not None:
        job.description = job_data.description
    if job_data.requirements is not None:
        job.requirements = job_data.requirements.model_dump()
    if job_data.status is not None:
        job.status = job_data.status
    
    db.commit()
    db.refresh(job)
    
    candidate_count = db.query(func.count(Candidate.id)).filter(Candidate.job_id == job.id).scalar()
    return job_to_response(job, candidate_count)


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_job(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hr_admin)
):
    """Delete a job posting (HR Admin only)."""
    job = db.query(Job).filter(Job.id == job_id).first()
    
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found"
        )
    
    # Check if job has candidates
    candidate_count = db.query(func.count(Candidate.id)).filter(Candidate.job_id == job.id).scalar()
    if candidate_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete job with {candidate_count} candidates. Remove candidates first."
        )
    
    db.delete(job)
    db.commit()
