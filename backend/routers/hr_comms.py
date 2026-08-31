"""HR Communications API endpoints for hired and rejected candidates.

Handles offer letters, notice period tracking, follow-up scheduling,
and candidate onboarding/rejection workflows.
"""
import os
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, List
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from database import get_db
from models import (
    User, Candidate, CandidateStatus, OfferLetter, NoticePeriodTracking,
    FollowUpSchedule, EmailTemplate, generate_uuid
)
from schemas import (
    OfferLetterCreate, OfferLetterResponse,
    NoticePeriodCreate, NoticePeriodResponse,
    FollowUpResponse, CandidateStatusUpdate
)
from services.auth_service import get_current_user, require_hr_admin
from services.email_service import email_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/hr-comms", tags=["hr-communications"])

# File storage configuration
UPLOAD_DIR = Path("uploads/offer_letters")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


# =====================================================================
# Hired Candidates - Offer Letter Management
# =====================================================================

@router.get("/hired-candidates", response_model=List[dict])
async def get_hired_candidates(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hr_admin),
):
    """Get all candidates with hired or onboarded status."""
    candidates = (
        db.query(Candidate)
        .filter(Candidate.status.in_([CandidateStatus.HIRED, CandidateStatus.ONBOARDED]))
        .order_by(Candidate.updated_at.desc())
        .all()
    )

    result = []
    for candidate in candidates:
        offer_letter = db.query(OfferLetter).filter(
            OfferLetter.candidate_id == candidate.id
        ).first()
        notice_period = db.query(NoticePeriodTracking).filter(
            NoticePeriodTracking.candidate_id == candidate.id
        ).first()

        result.append({
            "id": candidate.id,
            "name": candidate.name,
            "email": candidate.email,
            "phone": candidate.phone,
            "job_title": candidate.job.title if candidate.job else None,
            "status": candidate.status.value,
            "has_offer_letter": offer_letter is not None,
            "offer_letter_status": offer_letter.status if offer_letter else None,
            "has_notice_period": notice_period is not None,
            "notice_period_end_date": notice_period.notice_period_end_date.isoformat() if notice_period else None,
            "updated_at": candidate.updated_at.isoformat(),
        })

    return result


@router.post("/offer-letter/create", response_model=OfferLetterResponse)
async def create_offer_letter(
    candidate_id: str = Form(...),
    subject: str = Form(...),
    body_html: str = Form(...),
    body_text: Optional[str] = Form(None),
    pdf_file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hr_admin),
):
    """Create or update offer letter for a candidate."""
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # Check if offer letter already exists
    offer_letter = db.query(OfferLetter).filter(
        OfferLetter.candidate_id == candidate_id
    ).first()

    pdf_path = None
    pdf_filename = None

    # Handle PDF upload
    if pdf_file:
        pdf_filename = f"{candidate_id}_{pdf_file.filename}"
        pdf_path = str(UPLOAD_DIR / pdf_filename)

        with open(pdf_path, "wb") as f:
            content = await pdf_file.read()
            f.write(content)

    if offer_letter:
        # Update existing
        offer_letter.subject = subject
        offer_letter.body_html = body_html
        offer_letter.body_text = body_text
        if pdf_path:
            offer_letter.pdf_path = pdf_path
            offer_letter.pdf_filename = pdf_filename
        offer_letter.status = "draft"
        offer_letter.updated_at = datetime.utcnow()
    else:
        # Create new
        offer_letter = OfferLetter(
            candidate_id=candidate_id,
            subject=subject,
            body_html=body_html,
            body_text=body_text,
            pdf_path=pdf_path,
            pdf_filename=pdf_filename,
            status="draft",
        )
        db.add(offer_letter)

    db.commit()
    db.refresh(offer_letter)

    return OfferLetterResponse(
        id=offer_letter.id,
        candidate_id=offer_letter.candidate_id,
        subject=offer_letter.subject,
        body_html=offer_letter.body_html,
        body_text=offer_letter.body_text,
        pdf_filename=offer_letter.pdf_filename,
        status=offer_letter.status,
        sent_at=offer_letter.sent_at.isoformat() if offer_letter.sent_at else None,
        created_at=offer_letter.created_at.isoformat(),
        updated_at=offer_letter.updated_at.isoformat(),
    )


@router.post("/offer-letter/{offer_letter_id}/send")
async def send_offer_letter(
    offer_letter_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hr_admin),
):
    """Send offer letter email to candidate."""
    offer_letter = db.query(OfferLetter).filter(OfferLetter.id == offer_letter_id).first()
    if not offer_letter:
        raise HTTPException(status_code=404, detail="Offer letter not found")

    candidate = offer_letter.candidate
    if not candidate or not candidate.email:
        raise HTTPException(status_code=400, detail="Candidate email not available")

    # Send email with PDF attachment
    success = email_service.send_email(
        to_email=candidate.email,
        subject=offer_letter.subject,
        html_body=offer_letter.body_html,
        text_body=offer_letter.body_text,
        pdf_path=offer_letter.pdf_path,
        pdf_filename=offer_letter.pdf_filename,
    )

    if success:
        offer_letter.status = "sent"
        offer_letter.sent_at = datetime.utcnow()
        offer_letter.sent_by = current_user.id
        db.commit()

        return {"success": True, "message": f"Offer letter sent to {candidate.email}"}
    else:
        raise HTTPException(status_code=500, detail="Failed to send offer letter")


@router.get("/offer-letter/candidate/{candidate_id}", response_model=OfferLetterResponse)
async def get_candidate_offer_letter(
    candidate_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get offer letter for a specific candidate."""
    offer_letter = db.query(OfferLetter).filter(
        OfferLetter.candidate_id == candidate_id
    ).first()

    if not offer_letter:
        raise HTTPException(status_code=404, detail="Offer letter not found")

    return OfferLetterResponse(
        id=offer_letter.id,
        candidate_id=offer_letter.candidate_id,
        subject=offer_letter.subject,
        body_html=offer_letter.body_html,
        body_text=offer_letter.body_text,
        pdf_filename=offer_letter.pdf_filename,
        status=offer_letter.status,
        sent_at=offer_letter.sent_at.isoformat() if offer_letter.sent_at else None,
        created_at=offer_letter.created_at.isoformat(),
        updated_at=offer_letter.updated_at.isoformat(),
    )


@router.get("/offer-letter/{offer_letter_id}/download")
async def download_offer_letter_pdf(
    offer_letter_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Download offer letter PDF."""
    offer_letter = db.query(OfferLetter).filter(OfferLetter.id == offer_letter_id).first()
    if not offer_letter or not offer_letter.pdf_path:
        raise HTTPException(status_code=404, detail="PDF not found")

    if not os.path.exists(offer_letter.pdf_path):
        raise HTTPException(status_code=404, detail="PDF file not found on server")

    return FileResponse(
        offer_letter.pdf_path,
        media_type="application/pdf",
        filename=offer_letter.pdf_filename or "offer_letter.pdf"
    )


# =====================================================================
# Notice Period Tracking
# =====================================================================

@router.post("/notice-period/create", response_model=NoticePeriodResponse)
async def create_notice_period_tracking(
    data: NoticePeriodCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hr_admin),
):
    """Create notice period tracking and generate follow-up schedule."""
    candidate = db.query(Candidate).filter(Candidate.id == data.candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # Check if notice period tracking already exists
    existing = db.query(NoticePeriodTracking).filter(
        NoticePeriodTracking.candidate_id == data.candidate_id
    ).first()

    if existing:
        # Update existing
        existing.notice_period_end_date = data.notice_period_end_date
        existing.last_working_day_current_company = data.last_working_day_current_company
        existing.notice_period_days = data.notice_period_days
        existing.follow_up_frequency_days = data.follow_up_frequency_days or 7
        existing.notes = data.notes
        existing.status = "active"
        existing.updated_at = datetime.utcnow()
        notice_period = existing

        # Delete old follow-ups
        db.query(FollowUpSchedule).filter(
            FollowUpSchedule.notice_period_id == existing.id,
            FollowUpSchedule.status == "pending"
        ).delete()
    else:
        # Create new
        notice_period = NoticePeriodTracking(
            candidate_id=data.candidate_id,
            notice_period_end_date=data.notice_period_end_date,
            last_working_day_current_company=data.last_working_day_current_company,
            notice_period_days=data.notice_period_days,
            follow_up_frequency_days=data.follow_up_frequency_days or 7,
            notes=data.notes,
            status="active",
            created_by=current_user.id,
        )
        db.add(notice_period)
        db.flush()

    # Generate follow-up schedule
    frequency_days = data.follow_up_frequency_days or 7
    # Make current_date timezone-aware to match notice_period_end_date
    current_date = datetime.now(timezone.utc)
    follow_up_number = 1

    # Make sure both dates are comparable (strip timezone for comparison)
    notice_end_naive = data.notice_period_end_date.replace(tzinfo=None) if data.notice_period_end_date.tzinfo else data.notice_period_end_date
    current_date_naive = current_date.replace(tzinfo=None)

    while current_date_naive < notice_end_naive:
        follow_up_date = current_date + timedelta(days=frequency_days * follow_up_number)
        follow_up_date_naive = follow_up_date.replace(tzinfo=None)

        if follow_up_date_naive >= notice_end_naive:
            break

        follow_up = FollowUpSchedule(
            notice_period_id=notice_period.id,
            candidate_id=data.candidate_id,
            scheduled_date=follow_up_date,
            follow_up_number=follow_up_number,
            status="pending",
        )
        db.add(follow_up)
        follow_up_number += 1

    # Set next follow-up date
    if follow_up_number > 1:  # Only set if we created at least one follow-up
        first_follow_up = current_date + timedelta(days=frequency_days)
        notice_period.next_follow_up_date = first_follow_up
    else:
        notice_period.next_follow_up_date = None

    db.commit()
    db.refresh(notice_period)

    # Get follow-ups
    follow_ups = db.query(FollowUpSchedule).filter(
        FollowUpSchedule.notice_period_id == notice_period.id
    ).order_by(FollowUpSchedule.scheduled_date).all()

    return NoticePeriodResponse(
        id=notice_period.id,
        candidate_id=notice_period.candidate_id,
        notice_period_end_date=notice_period.notice_period_end_date.isoformat(),
        last_working_day_current_company=notice_period.last_working_day_current_company.isoformat() if notice_period.last_working_day_current_company else None,
        notice_period_days=notice_period.notice_period_days,
        follow_up_frequency_days=notice_period.follow_up_frequency_days,
        next_follow_up_date=notice_period.next_follow_up_date.isoformat() if notice_period.next_follow_up_date else None,
        status=notice_period.status,
        notes=notice_period.notes,
        follow_ups=[
            FollowUpResponse(
                id=f.id,
                scheduled_date=f.scheduled_date.isoformat(),
                follow_up_number=f.follow_up_number,
                status=f.status,
                sent_at=f.sent_at.isoformat() if f.sent_at else None,
            )
            for f in follow_ups
        ],
        created_at=notice_period.created_at.isoformat(),
        updated_at=notice_period.updated_at.isoformat(),
    )


@router.get("/notice-period/candidate/{candidate_id}", response_model=NoticePeriodResponse)
async def get_notice_period_tracking(
    candidate_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get notice period tracking for a candidate."""
    notice_period = db.query(NoticePeriodTracking).filter(
        NoticePeriodTracking.candidate_id == candidate_id
    ).first()

    if not notice_period:
        raise HTTPException(status_code=404, detail="Notice period tracking not found")

    follow_ups = db.query(FollowUpSchedule).filter(
        FollowUpSchedule.notice_period_id == notice_period.id
    ).order_by(FollowUpSchedule.scheduled_date).all()

    return NoticePeriodResponse(
        id=notice_period.id,
        candidate_id=notice_period.candidate_id,
        notice_period_end_date=notice_period.notice_period_end_date.isoformat(),
        last_working_day_current_company=notice_period.last_working_day_current_company.isoformat() if notice_period.last_working_day_current_company else None,
        notice_period_days=notice_period.notice_period_days,
        follow_up_frequency_days=notice_period.follow_up_frequency_days,
        next_follow_up_date=notice_period.next_follow_up_date.isoformat() if notice_period.next_follow_up_date else None,
        status=notice_period.status,
        notes=notice_period.notes,
        follow_ups=[
            FollowUpResponse(
                id=f.id,
                scheduled_date=f.scheduled_date.isoformat(),
                follow_up_number=f.follow_up_number,
                status=f.status,
                sent_at=f.sent_at.isoformat() if f.sent_at else None,
            )
            for f in follow_ups
        ],
        created_at=notice_period.created_at.isoformat(),
        updated_at=notice_period.updated_at.isoformat(),
    )


@router.post("/follow-up/{follow_up_id}/send")
async def send_follow_up_email(
    follow_up_id: str,
    subject: str = Form(...),
    body_html: str = Form(...),
    body_text: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hr_admin),
):
    """Send follow-up email to candidate."""
    follow_up = db.query(FollowUpSchedule).filter(FollowUpSchedule.id == follow_up_id).first()
    if not follow_up:
        raise HTTPException(status_code=404, detail="Follow-up not found")

    candidate = follow_up.candidate
    if not candidate or not candidate.email:
        raise HTTPException(status_code=400, detail="Candidate email not available")

    # Send email
    success = email_service.send_email(
        to_email=candidate.email,
        subject=subject,
        html_body=body_html,
        text_body=body_text,
    )

    if success:
        follow_up.status = "sent"
        follow_up.sent_at = datetime.utcnow()
        follow_up.subject = subject
        follow_up.body_html = body_html
        follow_up.body_text = body_text
        db.commit()

        return {"success": True, "message": f"Follow-up email sent to {candidate.email}"}
    else:
        follow_up.status = "failed"
        follow_up.error_message = "Failed to send email"
        db.commit()
        raise HTTPException(status_code=500, detail="Failed to send follow-up email")


# =====================================================================
# Candidate Status Updates - Onboarded / Offer Rejected
# =====================================================================

@router.post("/candidate/{candidate_id}/mark-onboarded")
async def mark_candidate_onboarded(
    candidate_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hr_admin),
):
    """Mark a hired candidate as successfully onboarded."""
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    if candidate.status != CandidateStatus.HIRED:
        raise HTTPException(
            status_code=400,
            detail="Can only mark hired candidates as onboarded"
        )

    candidate.status = CandidateStatus.ONBOARDED
    candidate.updated_at = datetime.utcnow()

    # Mark notice period as completed
    notice_period = db.query(NoticePeriodTracking).filter(
        NoticePeriodTracking.candidate_id == candidate_id
    ).first()
    if notice_period:
        notice_period.status = "completed"

    db.commit()

    return {
        "success": True,
        "message": f"{candidate.name} has been marked as onboarded",
        "status": candidate.status.value,
    }


@router.post("/candidate/{candidate_id}/mark-offer-rejected")
async def mark_offer_rejected(
    candidate_id: str,
    reason: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hr_admin),
):
    """Mark a candidate as having rejected the offer."""
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    if candidate.status != CandidateStatus.HIRED:
        raise HTTPException(
            status_code=400,
            detail="Can only mark hired candidates as offer rejected"
        )

    candidate.status = CandidateStatus.OFFER_REJECTED
    candidate.updated_at = datetime.utcnow()

    # Cancel notice period tracking
    notice_period = db.query(NoticePeriodTracking).filter(
        NoticePeriodTracking.candidate_id == candidate_id
    ).first()
    if notice_period:
        notice_period.status = "cancelled"
        if reason:
            notice_period.notes = f"Offer rejected: {reason}"

    db.commit()

    return {
        "success": True,
        "message": f"{candidate.name} has been marked as offer rejected",
        "status": candidate.status.value,
    }


# =====================================================================
# Rejected Candidates
# =====================================================================

@router.get("/rejected-candidates", response_model=List[dict])
async def get_rejected_candidates(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hr_admin),
):
    """Get all candidates with rejected status."""
    candidates = (
        db.query(Candidate)
        .filter(Candidate.status == CandidateStatus.REJECTED)
        .order_by(Candidate.updated_at.desc())
        .all()
    )

    result = []
    for candidate in candidates:
        # Check if rejection email was sent
        from models import CommunicationLog
        rejection_email = db.query(CommunicationLog).filter(
            CommunicationLog.candidate_id == candidate.id,
            CommunicationLog.subject.contains("reject")  # Simple heuristic
        ).first()

        result.append({
            "id": candidate.id,
            "name": candidate.name,
            "email": candidate.email,
            "phone": candidate.phone,
            "job_title": candidate.job.title if candidate.job else None,
            "status": candidate.status.value,
            "rejection_email_sent": rejection_email is not None,
            "updated_at": candidate.updated_at.isoformat(),
        })

    return result


@router.post("/send-rejection-email")
async def send_rejection_email(
    candidate_id: str = Form(...),
    subject: str = Form(...),
    body_html: str = Form(...),
    body_text: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hr_admin),
):
    """Send rejection email to candidate."""
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    if not candidate.email:
        raise HTTPException(status_code=400, detail="Candidate email not available")

    # Send email
    success = email_service.send_email(
        to_email=candidate.email,
        subject=subject,
        html_body=body_html,
        text_body=body_text,
    )

    if success:
        # Log the communication
        from models import CommunicationLog
        log = CommunicationLog(
            candidate_id=candidate.id,
            recipient_email=candidate.email,
            recipient_name=candidate.name,
            subject=subject,
            body_html=body_html,
            body_text=body_text,
            status="sent",
            extra_data={"type": "rejection", "sent_by": current_user.id},
        )
        db.add(log)
        db.commit()

        return {
            "success": True,
            "message": f"Rejection email sent to {candidate.email}",
        }
    else:
        raise HTTPException(status_code=500, detail="Failed to send rejection email")
