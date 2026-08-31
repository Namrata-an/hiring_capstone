"""Interview Pipeline API endpoints.

Handles interview round management, interviewer assignments, and confirmation workflow.
"""
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Form
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session, joinedload

from database import get_db
from models import (
    User, Job, Candidate, InterviewRound, InterviewSchedule,
    InterviewStatus, UserRole, CandidateStatus, CandidateStatusHistory,
    InterviewQuestionsSnapshot,
    generate_confirmation_token
)
from schemas import (
    InterviewRoundCreate, InterviewRoundUpdate, InterviewRoundResponse,
    InterviewScheduleResponse, PipelineResponse, InterviewerInfo,
    InterviewAssignCreate, InterviewConfirmationResponse, SendInviteRequest,
    ProcessRescheduleRequest,
    InterviewQuestionsSnapshotResponse,
)
from services.auth_service import get_current_user, require_hr_admin
from services.email_service import email_service

router = APIRouter(prefix="/api/v1", tags=["interviews"])


# ----- Helper Functions -----

def update_candidate_status(
    db: Session,
    candidate: Candidate,
    new_status: CandidateStatus,
    changed_by_id: str = None,
    notes: str = None
):
    """Update candidate status and create a CandidateStatusHistory record.

    Args:
        db: Database session
        candidate: The Candidate model instance
        new_status: The new CandidateStatus to set
        changed_by_id: ID of the user who triggered the change (optional)
        notes: Optional notes about why the status changed

    Returns:
        The updated candidate, or None if no change was needed
    """
    old_status = candidate.status
    if old_status == new_status:
        return candidate  # No change needed

    candidate.status = new_status

    history = CandidateStatusHistory(
        candidate_id=candidate.id,
        old_status=old_status.value if old_status else None,
        new_status=new_status.value,
        changed_by=changed_by_id,
        notes=notes
    )
    db.add(history)
    return candidate


def schedule_to_response(schedule: InterviewSchedule) -> InterviewScheduleResponse:
    """Convert InterviewSchedule model to response schema."""
    # Get review data if the interview is completed
    review_recommendation = None
    review_overall_rating = None
    if schedule.status == InterviewStatus.COMPLETED and schedule.review:
        review_recommendation = schedule.review.recommendation
        review_overall_rating = schedule.review.overall_rating

    round_obj = schedule.interview_round
    job = round_obj.job if round_obj else None

    return InterviewScheduleResponse(
        id=schedule.id,
        interview_round_id=schedule.interview_round_id,
        candidate_id=schedule.candidate_id,
        interviewer_id=schedule.interviewer_id,
        candidate_name=schedule.candidate.name if schedule.candidate else None,
        interviewer_name=schedule.interviewer.name if schedule.interviewer else None,
        interviewer_email=schedule.interviewer.email if schedule.interviewer else None,
        job_id=job.id if job else None,
        job_title=job.title if job else None,
        round_number=round_obj.round_number if round_obj else None,
        round_name=round_obj.round_name if round_obj else None,
        scheduled_at=schedule.scheduled_at,
        status=schedule.status,
        invite_sent_at=schedule.invite_sent_at,
        confirmed_at=schedule.confirmed_at,
        created_at=schedule.created_at,
        review_recommendation=review_recommendation,
        review_overall_rating=review_overall_rating,
        proposed_at=schedule.proposed_at,
        proposed_by=schedule.proposed_by,
        reschedule_reason=schedule.reschedule_reason,
        reschedule_count=schedule.reschedule_count or 0,
        reschedule_questions_used=schedule.reschedule_questions_used,
    )


def round_to_response(round: InterviewRound) -> InterviewRoundResponse:
    """Convert InterviewRound model to response schema."""
    return InterviewRoundResponse(
        id=round.id,
        job_id=round.job_id,
        round_number=round.round_number,
        round_name=round.round_name,
        description=round.description,
        schedules=[schedule_to_response(s) for s in round.schedules],
        created_at=round.created_at,
        updated_at=round.updated_at
    )


# ----- Interview Round CRUD -----

@router.get("/jobs/{job_id}/pipeline", response_model=PipelineResponse)
async def get_job_pipeline(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get full interview pipeline for a job.

    Returns all rounds with their assignments and list of available interviewers.
    """
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Get all rounds for this job, ordered by round number
    # Use eager loading to prevent N+1 query problem (fetch all related data in one query)
    rounds = db.query(InterviewRound).options(
        joinedload(InterviewRound.schedules)
            .joinedload(InterviewSchedule.candidate),
        joinedload(InterviewRound.schedules)
            .joinedload(InterviewSchedule.interviewer),
        joinedload(InterviewRound.schedules)
            .joinedload(InterviewSchedule.review)
    ).filter(
        InterviewRound.job_id == job_id
    ).order_by(InterviewRound.round_number).all()

    # Get all interviewers
    interviewers = db.query(User).filter(
        User.role == UserRole.INTERVIEWER
    ).all()

    return PipelineResponse(
        job_id=job.id,
        job_title=job.title,
        rounds=[round_to_response(r) for r in rounds],
        interviewers=[
            InterviewerInfo(
                id=i.id,
                name=i.name,
                email=i.email,
                role=i.role
            ) for i in interviewers
        ]
    )


@router.post("/jobs/{job_id}/rounds", response_model=InterviewRoundResponse)
async def create_interview_round(
    job_id: str,
    round_data: InterviewRoundCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hr_admin)
):
    """Create a new interview round for a job."""
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Check if round number already exists
    existing = db.query(InterviewRound).filter(
        InterviewRound.job_id == job_id,
        InterviewRound.round_number == round_data.round_number
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Round {round_data.round_number} already exists for this job"
        )

    # If marking this as final round, unmark others
    if round_data.is_final_round:
        db.query(InterviewRound).filter(
            InterviewRound.job_id == job_id
        ).update({"is_final_round": False})

    new_round = InterviewRound(
        job_id=job_id,
        round_number=round_data.round_number,
        round_name=round_data.round_name or f"Round {round_data.round_number}",
        description=round_data.description,
        is_final_round=round_data.is_final_round
    )
    db.add(new_round)
    db.commit()
    db.refresh(new_round)

    return round_to_response(new_round)


@router.put("/jobs/{job_id}/rounds/{round_id}", response_model=InterviewRoundResponse)
async def update_interview_round(
    job_id: str,
    round_id: str,
    round_data: InterviewRoundUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hr_admin)
):
    """Update an existing interview round."""
    round = db.query(InterviewRound).filter(
        InterviewRound.id == round_id,
        InterviewRound.job_id == job_id
    ).first()
    if not round:
        raise HTTPException(status_code=404, detail="Interview round not found")

    if round_data.round_number is not None:
        # Check for conflicts
        existing = db.query(InterviewRound).filter(
            InterviewRound.job_id == job_id,
            InterviewRound.round_number == round_data.round_number,
            InterviewRound.id != round_id
        ).first()
        if existing:
            raise HTTPException(
                status_code=400,
                detail=f"Round {round_data.round_number} already exists"
            )
        round.round_number = round_data.round_number

    if round_data.round_name is not None:
        round.round_name = round_data.round_name
    if round_data.description is not None:
        round.description = round_data.description
    if round_data.is_final_round is not None:
        # If marking this as final round, unmark others
        if round_data.is_final_round:
            db.query(InterviewRound).filter(
                InterviewRound.job_id == job_id,
                InterviewRound.id != round_id
            ).update({"is_final_round": False})
        round.is_final_round = round_data.is_final_round

    db.commit()
    db.refresh(round)

    return round_to_response(round)


@router.patch("/jobs/{job_id}/rounds/{round_id}/mark-final")
async def mark_round_as_final(
    job_id: str,
    round_id: str,
    is_final: bool = Query(True, description="Set to true to mark as final, false to unmark"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hr_admin)
):
    """Mark an interview round as the final round for baton passing logic.

    When a round is marked as final:
    - The system knows this is the last interview stage
    - After this round's review, candidate moves to final decision
    - HR is notified to make offer/rejection decision

    Only one round per job can be marked as final at a time.
    """
    round = db.query(InterviewRound).filter(
        InterviewRound.id == round_id,
        InterviewRound.job_id == job_id
    ).first()
    if not round:
        raise HTTPException(status_code=404, detail="Interview round not found")

    if is_final:
        # Unmark any other rounds as final for this job
        db.query(InterviewRound).filter(
            InterviewRound.job_id == job_id,
            InterviewRound.id != round_id
        ).update({"is_final_round": False})

    round.is_final_round = is_final
    db.commit()
    db.refresh(round)

    return {
        "success": True,
        "message": f"Round {round.round_number} ({'marked' if is_final else 'unmarked'}) as final round",
        "round": round_to_response(round)
    }


@router.delete("/jobs/{job_id}/rounds/{round_id}")
async def delete_interview_round(
    job_id: str,
    round_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hr_admin)
):
    """Delete an interview round and all its schedules."""
    round = db.query(InterviewRound).filter(
        InterviewRound.id == round_id,
        InterviewRound.job_id == job_id
    ).first()
    if not round:
        raise HTTPException(status_code=404, detail="Interview round not found")

    db.delete(round)
    db.commit()

    return {"message": "Interview round deleted"}


# ----- Interview Assignment -----

@router.post("/interviews/assign", response_model=InterviewScheduleResponse)
async def assign_interviewer(
    assignment: InterviewAssignCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hr_admin)
):
    """Assign an interviewer to a round for a specific candidate."""
    # Validate round exists
    round = db.query(InterviewRound).filter(
        InterviewRound.id == assignment.interview_round_id
    ).first()
    if not round:
        raise HTTPException(status_code=404, detail="Interview round not found")

    # Validate candidate exists
    candidate = db.query(Candidate).filter(
        Candidate.id == assignment.candidate_id
    ).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # Validate interviewer exists and is an interviewer
    interviewer = db.query(User).filter(
        User.id == assignment.interviewer_id,
        User.role == UserRole.INTERVIEWER
    ).first()
    if not interviewer:
        raise HTTPException(status_code=404, detail="Interviewer not found")

    # Check if this assignment already exists
    existing = db.query(InterviewSchedule).filter(
        InterviewSchedule.interview_round_id == assignment.interview_round_id,
        InterviewSchedule.candidate_id == assignment.candidate_id,
        InterviewSchedule.interviewer_id == assignment.interviewer_id
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail="This interviewer is already assigned to this round for this candidate"
        )

    schedule = InterviewSchedule(
        interview_round_id=assignment.interview_round_id,
        candidate_id=assignment.candidate_id,
        interviewer_id=assignment.interviewer_id,
        scheduled_at=assignment.scheduled_at,
        status=InterviewStatus.PENDING,
        confirmation_token=generate_confirmation_token()
    )
    db.add(schedule)

    # Auto-update candidate status: applied -> screening on first assignment
    if candidate.status == CandidateStatus.APPLIED:
        update_candidate_status(
            db=db,
            candidate=candidate,
            new_status=CandidateStatus.SCREENING,
            changed_by_id=current_user.id,
            notes=f"Interviewer assigned to round {round.round_number}"
        )

    db.commit()
    db.refresh(schedule)

    # Eager load related objects to avoid N+1 queries in schedule_to_response
    schedule = db.query(InterviewSchedule).options(
        joinedload(InterviewSchedule.candidate),
        joinedload(InterviewSchedule.interviewer),
        joinedload(InterviewSchedule.interview_round).joinedload(InterviewRound.job),
        joinedload(InterviewSchedule.review)
    ).filter(InterviewSchedule.id == schedule.id).first()

    return schedule_to_response(schedule)


@router.delete("/interviews/{schedule_id}")
async def remove_assignment(
    schedule_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hr_admin)
):
    """Remove an interviewer assignment."""
    schedule = db.query(InterviewSchedule).filter(
        InterviewSchedule.id == schedule_id
    ).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Interview schedule not found")

    db.delete(schedule)
    db.commit()

    return {"message": "Assignment removed"}


# ----- Email Invitation -----

@router.post("/interviews/{schedule_id}/send-invite")
async def send_interview_invite(
    schedule_id: str,
    request: SendInviteRequest = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hr_admin)
):
    """Send interview invitation email to the assigned interviewer.

    Optionally accepts a scheduled_at datetime to propose a specific time.
    If provided, an ICS calendar file will be attached to the email.
    """
    schedule = db.query(InterviewSchedule).filter(
        InterviewSchedule.id == schedule_id
    ).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Interview schedule not found")

    # Get related data
    interviewer = schedule.interviewer
    candidate = schedule.candidate
    round = schedule.interview_round
    job = round.job

    # Update scheduled_at if provided in request
    if request and request.scheduled_at:
        schedule.scheduled_at = request.scheduled_at

    # If interviewer had declined earlier, reopen this assignment for a fresh response.
    # This enables "reschedule and resend invite" without forcing reassignment.
    if schedule.status == InterviewStatus.DECLINED:
        schedule.status = InterviewStatus.PENDING
        schedule.confirmed_at = None
        schedule.confirmation_token = generate_confirmation_token()
    elif not schedule.confirmation_token:
        schedule.confirmation_token = generate_confirmation_token()

    db.commit()

    # Send email
    custom_message = request.custom_message if request else None
    scheduled_at = request.scheduled_at if request else schedule.scheduled_at

    success = email_service.send_interview_invite(
        interviewer_email=interviewer.email,
        interviewer_name=interviewer.name,
        candidate_name=candidate.name,
        job_title=job.title,
        round_name=round.round_name or f"Round {round.round_number}",
        confirmation_token=schedule.confirmation_token,
        custom_message=custom_message,
        scheduled_at=scheduled_at
    )

    if success:
        schedule.invite_sent_at = datetime.utcnow()
        db.commit()
        return {"message": "Invitation sent successfully", "sent_to": interviewer.email}
    else:
        raise HTTPException(
            status_code=500,
            detail="Failed to send email. Check email configuration."
        )


# ----- Confirmation Endpoint (Public - accessed via email link) -----

_PAGE_STYLES = """
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  background:
    radial-gradient(circle at top right, rgba(249, 115, 22, 0.10), transparent 50%),
    radial-gradient(circle at bottom left, rgba(34, 197, 94, 0.05), transparent 50%),
    #09090b;
  min-height: 100vh;
  color: #fafafa;
  padding: 24px 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  -webkit-font-smoothing: antialiased;
}
.card {
  background: rgba(24, 24, 27, 0.92);
  backdrop-filter: blur(14px);
  border: 1px solid rgba(63, 63, 70, 0.6);
  border-radius: 20px;
  padding: 36px 28px;
  max-width: 460px;
  width: 100%;
  box-shadow: 0 20px 60px rgba(0,0,0,0.5);
}
.brand-row {
  display: flex; align-items: center; gap: 12px; margin-bottom: 28px;
}
.brand-icon {
  width: 40px; height: 40px; border-radius: 12px;
  background: rgba(249, 115, 22, 0.15);
  display: flex; align-items: center; justify-content: center;
}
.brand-icon svg { width: 20px; height: 20px; stroke: #f97316; fill: none; stroke-width: 2.2; }
.brand-text { color: #fafafa; font-weight: 700; font-size: 15px; line-height: 1.1; }
.brand-sub { color: #f97316; font-size: 11px; font-weight: 500; }
.icon-circle {
  width: 72px; height: 72px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  margin: 0 auto 20px;
}
.icon-circle svg { width: 36px; height: 36px; stroke-width: 2.5; fill: none; }
.icon-circle.success { background: rgba(34, 197, 94, 0.16); }
.icon-circle.success svg { stroke: #22c55e; }
.icon-circle.error { background: rgba(239, 68, 68, 0.16); }
.icon-circle.error svg { stroke: #ef4444; }
.icon-circle.warn { background: rgba(249, 115, 22, 0.16); }
.icon-circle.warn svg { stroke: #f97316; }
h1 {
  font-size: 24px; font-weight: 700; text-align: center;
  letter-spacing: -0.01em; margin-bottom: 10px;
}
h1.success { color: #22c55e; }
h1.error { color: #ef4444; }
h1.warn { color: #f97316; }
p.lede {
  text-align: center; color: #a1a1aa; line-height: 1.55;
  font-size: 15px; margin-bottom: 24px;
}
.details {
  background: rgba(39, 39, 42, 0.55);
  border: 1px solid rgba(63, 63, 70, 0.5);
  border-radius: 12px;
  padding: 16px;
  margin: 0 0 8px 0;
  font-size: 14px;
}
.details .row { display: flex; justify-content: space-between; gap: 12px; padding: 6px 0; }
.details .row + .row { border-top: 1px solid rgba(63, 63, 70, 0.35); }
.details .label { color: #71717a; }
.details .value { color: #fafafa; font-weight: 500; text-align: right; }
.foot { color: #52525b; font-size: 12px; text-align: center; margin-top: 24px; }
label.field-label {
  display: block; margin-top: 18px;
  color: #d4d4d8; font-weight: 500; font-size: 13px;
}
input[type="datetime-local"], textarea, input[type="text"] {
  width: 100%; padding: 12px 14px;
  background: #0a0a0b; color: #fafafa;
  border: 1px solid rgba(63, 63, 70, 0.6);
  border-radius: 10px;
  font-family: inherit; font-size: 14px; margin-top: 6px;
  outline: none; transition: border-color .15s;
}
input:focus, textarea:focus { border-color: #f97316; }
textarea { resize: vertical; min-height: 88px; }
.btn-primary {
  background: #f97316; color: white; padding: 13px 20px;
  border: none; border-radius: 10px; font-weight: 600; font-size: 15px;
  cursor: pointer; width: 100%; margin-top: 24px;
  transition: background .15s;
}
.btn-primary:hover { background: #ea580c; }
"""


def _page(title: str, body_html: str, status_code: int = 200) -> HTMLResponse:
    """Wrap a body fragment in the shared dark page chrome used across the
    accept / decline / reschedule routes. Mobile-friendly by default."""
    return HTMLResponse(
        status_code=status_code,
        content=f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="theme-color" content="#0a0a0b" />
  <title>{title}</title>
  <style>{_PAGE_STYLES}</style>
</head>
<body>
  <div class="card">
    <div class="brand-row">
      <div class="brand-icon">
        <svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="16" rx="3" />
          <path d="M3 9h18 M9 4v3 M15 4v3" />
        </svg>
      </div>
      <div>
        <div class="brand-text">Hiring Co-Pilot</div>
        <div class="brand-sub">Interview Confirmation</div>
      </div>
    </div>
    {body_html}
  </div>
</body>
</html>""",
    )


@router.get("/interviews/confirm/{token}", response_class=HTMLResponse)
async def confirm_interview(
    token: str,
    action: str = Query(..., pattern="^(confirm|decline|reschedule)$"),
    db: Session = Depends(get_db)
):
    """Handle interview confirmation from email link.

    This endpoint is public (no auth required) as it's accessed via email links.
    The token provides security.

    Three actions:
      * confirm   — interviewer accepts the proposed time
      * decline   — interviewer rejects the assignment
      * reschedule — interviewer asks HR for a new time (renders an HTML form)
    """
    schedule = db.query(InterviewSchedule).filter(
        InterviewSchedule.confirmation_token == token
    ).first()

    if not schedule:
        return _page(
            "Invalid Link",
            """
            <div class="icon-circle error">
              <svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M15 9l-6 6 M9 9l6 6" />
              </svg>
            </div>
            <h1 class="error">Link no longer valid</h1>
            <p class="lede">This confirmation link has expired or has already been used.
               If you think this is a mistake, ask HR to send a fresh invite.</p>
            """,
            status_code=404,
        )

    # Check if already responded (terminal states only — reschedule_requested is
    # not terminal so allow re-submitting from a stale email link).
    terminal = (
        InterviewStatus.CONFIRMED,
        InterviewStatus.DECLINED,
        InterviewStatus.COMPLETED,
    )
    if schedule.status in terminal:
        status_text = (
            "confirmed" if schedule.status == InterviewStatus.CONFIRMED
            else "declined" if schedule.status == InterviewStatus.DECLINED
            else "completed"
        )
        return _page(
            "Already responded",
            f"""
            <div class="icon-circle warn">
              <svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4 M12 16h.01" />
              </svg>
            </div>
            <h1 class="warn">Already responded</h1>
            <p class="lede">You've already {status_text} this interview request.
               No further action is needed.</p>
            """,
        )

    # ----- reschedule path: render an HTML form -----
    if action == "reschedule":
        candidate_name = schedule.candidate.name if schedule.candidate else "Unknown"
        job_title = (
            schedule.interview_round.job.title
            if schedule.interview_round and schedule.interview_round.job
            else "Unknown"
        )
        current_time = (
            schedule.scheduled_at.strftime("%A, %b %d, %Y · %I:%M %p UTC")
            if schedule.scheduled_at else "Not yet set"
        )
        return _page(
            "Request Reschedule",
            f"""
            <div class="icon-circle warn">
              <svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 12a9 9 0 1 1-3.5-7.1" />
                <path d="M21 4v5h-5" />
              </svg>
            </div>
            <h1 class="warn">Request Reschedule</h1>
            <p class="lede">Tell HR what works better and they'll line up a new time.</p>
            <div class="details">
              <div class="row"><span class="label">Candidate</span><span class="value">{candidate_name}</span></div>
              <div class="row"><span class="label">Position</span><span class="value">{job_title}</span></div>
              <div class="row"><span class="label">Current time</span><span class="value">{current_time}</span></div>
            </div>
            <form method="POST" action="/api/v1/interviews/confirm/{token}/reschedule">
              <label class="field-label" for="proposed_at">Your preferred new time (optional)</label>
              <input type="datetime-local" id="proposed_at" name="proposed_at" />
              <label class="field-label" for="reason">Reason (optional)</label>
              <textarea id="reason" name="reason" rows="4"
                        placeholder="e.g. Conflict with another interview"></textarea>
              <button type="submit" class="btn-primary">Send Reschedule Request</button>
            </form>
            """,
        )

    # Update status based on action
    if action == "confirm":
        schedule.status = InterviewStatus.CONFIRMED
        schedule.confirmed_at = datetime.utcnow()

        # Auto-update candidate status based on which round was confirmed
        round_obj = schedule.interview_round
        candidate = schedule.candidate
        if round_obj and candidate:
            round_num = round_obj.round_number
            if round_num == 1 and candidate.status in (
                CandidateStatus.APPLIED, CandidateStatus.SCREENING
            ):
                update_candidate_status(
                    db=db,
                    candidate=candidate,
                    new_status=CandidateStatus.INTERVIEW_ROUND_1,
                    changed_by_id=None,
                    notes="Interview round 1 confirmed by interviewer"
                )
            elif round_num == 2 and candidate.status in (
                CandidateStatus.SCREENING, CandidateStatus.INTERVIEW_ROUND_1
            ):
                update_candidate_status(
                    db=db,
                    candidate=candidate,
                    new_status=CandidateStatus.INTERVIEW_ROUND_2,
                    changed_by_id=None,
                    notes="Interview round 2 confirmed by interviewer"
                )

        title = "Confirmed"
        tone = "success"
        icon_path = '<path d="M5 13l4 4L19 7" />'
        message = "Thank you for confirming. The HR team will send you more details soon."
    else:
        schedule.status = InterviewStatus.DECLINED
        schedule.confirmed_at = datetime.utcnow()
        title = "Declined"
        tone = "error"
        icon_path = '<path d="M6 6l12 12 M18 6L6 18" />'
        message = "You've declined this interview. The HR team has been notified."

    # Invalidate token after use
    schedule.confirmation_token = None
    db.commit()

    # Get details for display
    candidate_name = schedule.candidate.name if schedule.candidate else "Unknown"
    job_title = (
        schedule.interview_round.job.title
        if schedule.interview_round and schedule.interview_round.job
        else "Unknown"
    )
    when = (
        schedule.scheduled_at.strftime("%A, %b %d, %Y · %I:%M %p UTC")
        if schedule.scheduled_at else None
    )
    when_row = (
        f'<div class="row"><span class="label">Time</span>'
        f'<span class="value">{when}</span></div>'
        if when else ""
    )
    return _page(
        title,
        f"""
        <div class="icon-circle {tone}">
          <svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">{icon_path}</svg>
        </div>
        <h1 class="{tone}">{title}</h1>
        <p class="lede">{message}</p>
        <div class="details">
          <div class="row"><span class="label">Candidate</span><span class="value">{candidate_name}</span></div>
          <div class="row"><span class="label">Position</span><span class="value">{job_title}</span></div>
          {when_row}
        </div>
        <p class="foot">You can close this window now.</p>
        """,
    )


@router.post("/interviews/confirm/{token}/reschedule", response_class=HTMLResponse)
async def submit_reschedule_request(
    token: str,
    proposed_at: Optional[str] = Form(None),
    reason: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    """Process the HTML form a stranded interviewer submits from the email link.

    Marks the schedule as RESCHEDULE_REQUESTED, records what they proposed,
    and notifies HR via email.
    """
    schedule = db.query(InterviewSchedule).filter(
        InterviewSchedule.confirmation_token == token
    ).first()

    if not schedule:
        return _page(
            "Invalid Link",
            """
            <div class="icon-circle error">
              <svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M15 9l-6 6 M9 9l6 6" />
              </svg>
            </div>
            <h1 class="error">Link no longer valid</h1>
            <p class="lede">This reschedule link has expired. Please ask HR for a fresh invite.</p>
            """,
            status_code=404,
        )

    if schedule.status in (
        InterviewStatus.CONFIRMED, InterviewStatus.DECLINED, InterviewStatus.COMPLETED
    ):
        return _page(
            "Already responded",
            """
            <div class="icon-circle warn">
              <svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4 M12 16h.01" />
              </svg>
            </div>
            <h1 class="warn">Already responded</h1>
            <p class="lede">This interview has already been responded to. No further action is needed.</p>
            """,
            status_code=409,
        )

    parsed_proposed = None
    if proposed_at:
        try:
            # datetime-local inputs come without timezone, e.g. 2026-05-01T15:30
            parsed_proposed = datetime.fromisoformat(proposed_at)
        except ValueError:
            parsed_proposed = None

    schedule.status = InterviewStatus.RESCHEDULE_REQUESTED
    schedule.proposed_at = parsed_proposed
    schedule.proposed_by = schedule.interviewer_id  # the interviewer is requesting
    schedule.reschedule_reason = (reason or None)
    schedule.reschedule_count = (schedule.reschedule_count or 0) + 1
    schedule.confirmed_at = datetime.utcnow()
    # Keep the token alive — HR may need to re-link the interviewer to this row
    db.commit()

    # Notify HR (best-effort — never block the user-facing form on email failure)
    try:
        email_service.send_reschedule_notification_to_hr(schedule=schedule)
    except Exception as exc:  # noqa: BLE001
        # Email isn't load-bearing here; log and continue.
        import logging
        logging.getLogger(__name__).exception(
            "Failed to send HR reschedule notification: %s", exc
        )

    candidate_name = schedule.candidate.name if schedule.candidate else "Unknown"
    job_title = (
        schedule.interview_round.job.title
        if schedule.interview_round and schedule.interview_round.job
        else "Unknown"
    )
    proposed_str = (
        parsed_proposed.strftime("%A, %b %d, %Y · %I:%M %p")
        if parsed_proposed else "(no preference given)"
    )
    return _page(
        "Reschedule Requested",
        f"""
        <div class="icon-circle warn">
          <svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 2L11 13" />
            <path d="M22 2l-7 20-4-9-9-4 20-7z" />
          </svg>
        </div>
        <h1 class="warn">Request sent</h1>
        <p class="lede">HR has been notified about your reschedule request.
           They'll line up a new time and email you a fresh invite shortly.</p>
        <div class="details">
          <div class="row"><span class="label">Candidate</span><span class="value">{candidate_name}</span></div>
          <div class="row"><span class="label">Position</span><span class="value">{job_title}</span></div>
          <div class="row"><span class="label">Your suggestion</span><span class="value">{proposed_str}</span></div>
        </div>
        <p class="foot">You can close this window now.</p>
        """,
    )


@router.post(
    "/interviews/{schedule_id}/process-reschedule",
    response_model=InterviewScheduleResponse,
)
async def process_reschedule(
    schedule_id: str,
    request: ProcessRescheduleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hr_admin),
):
    """HR finalizes a reschedule by setting a new time and re-inviting the interviewer.

    Resets the schedule back to PENDING with a fresh confirmation token, sets
    the new scheduled_at, and (optionally) re-sends the invite email. The
    reschedule_count stays as-is so we keep the running tally of attempts.
    """
    schedule = db.query(InterviewSchedule).filter(
        InterviewSchedule.id == schedule_id
    ).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Interview schedule not found")

    schedule.scheduled_at = request.new_scheduled_at
    schedule.status = InterviewStatus.PENDING
    schedule.confirmation_token = generate_confirmation_token()
    schedule.confirmed_at = None
    schedule.proposed_at = None
    schedule.proposed_by = None
    # Leave reschedule_reason / reschedule_count in place for audit history.
    db.commit()
    db.refresh(schedule)

    if request.notify_interviewer:
        interviewer = schedule.interviewer
        candidate = schedule.candidate
        round_obj = schedule.interview_round
        job = round_obj.job if round_obj else None
        success = email_service.send_interview_invite(
            interviewer_email=interviewer.email,
            interviewer_name=interviewer.name,
            candidate_name=candidate.name if candidate else "Candidate",
            job_title=job.title if job else "Interview",
            round_name=round_obj.round_name or f"Round {round_obj.round_number}" if round_obj else "Interview",
            confirmation_token=schedule.confirmation_token,
            custom_message=request.custom_message,
            scheduled_at=schedule.scheduled_at,
        )
        if success:
            schedule.invite_sent_at = datetime.utcnow()
            db.commit()

    return schedule_to_response(schedule)


@router.get(
    "/interviews/{schedule_id}/questions-asked",
    response_model=InterviewQuestionsSnapshotResponse,
)
def get_interview_questions_asked(
    schedule_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the immutable snapshot of the question bank that was attached
    to a given interview when it was marked conducted (Phase 7.8). Available
    to any authenticated user — talent memory is shared."""
    snapshot = db.query(InterviewQuestionsSnapshot).filter(
        InterviewQuestionsSnapshot.schedule_id == schedule_id
    ).first()
    if not snapshot:
        raise HTTPException(
            status_code=404,
            detail="No question-bank snapshot for this interview — it may not have been marked conducted yet.",
        )

    schedule = db.query(InterviewSchedule).filter(InterviewSchedule.id == schedule_id).first()
    interviewer = db.query(User).filter(User.id == snapshot.interviewer_id).first()
    candidate = db.query(Candidate).filter(Candidate.id == snapshot.candidate_id).first()
    round_obj = schedule.interview_round if schedule else None
    job = round_obj.job if round_obj else None
    round_label = (
        round_obj.round_name or (f"Round {round_obj.round_number}" if round_obj else None)
        if round_obj else None
    )

    return InterviewQuestionsSnapshotResponse(
        id=snapshot.id,
        schedule_id=snapshot.schedule_id,
        interviewer_id=snapshot.interviewer_id,
        interviewer_name=interviewer.name if interviewer else None,
        candidate_id=snapshot.candidate_id,
        candidate_name=candidate.name if candidate else None,
        job_title=job.title if job else None,
        round_label=round_label,
        jd_based_questions=snapshot.jd_based_questions or [],
        fundamental_questions=snapshot.fundamental_questions or [],
        resume_questions=snapshot.resume_questions or [],
        behavioral_questions=snapshot.behavioral_questions or [],
        insights_based_questions=snapshot.insights_based_questions or [],
        red_flag_probes=snapshot.red_flag_probes or [],
        leetcode_questions=snapshot.leetcode_questions or [],
        follow_up_topics=snapshot.follow_up_topics or [],
        modified_by_interviewer=bool(snapshot.modified_by_interviewer),
        chat_history=snapshot.chat_history or [],
        created_at=snapshot.created_at,
    )


# ----- Interviewer's Schedule View -----

@router.get("/interviewer/schedule", response_model=List[InterviewScheduleResponse])
async def get_interviewer_schedule(
    status_filter: Optional[InterviewStatus] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all interview assignments for the current interviewer."""
    query = db.query(InterviewSchedule).filter(
        InterviewSchedule.interviewer_id == current_user.id
    )

    if status_filter:
        query = query.filter(InterviewSchedule.status == status_filter)

    schedules = query.order_by(InterviewSchedule.created_at.desc()).all()

    return [schedule_to_response(s) for s in schedules]
