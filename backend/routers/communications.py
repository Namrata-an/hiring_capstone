"""Communications API endpoints.

Handles email templates, sending/scheduling emails, communication history,
and automation triggers for the hiring platform.
"""
import re
import logging
from datetime import datetime
from typing import Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from database import get_db
from models import (
    User, Job, Candidate, EmailTemplate, CommunicationLog,
    ScheduledEmail, CandidateStatusHistory, InterviewSchedule,
    InterviewRound, generate_uuid
)
from schemas import (
    EmailTemplateCreate, EmailTemplateUpdate, EmailTemplateResponse,
    EmailTemplateListResponse, TemplatePreviewRequest, TemplatePreviewResponse,
    CommunicationLogResponse, CommunicationHistoryResponse,
    SendEmailRequest, SendEmailResponse, ScheduleEmailRequest,
    ScheduledEmailResponse, ScheduledEmailListResponse,
    BulkEmailRequest, BulkEmailResponse,
)
from services.auth_service import get_current_user, require_hr_admin
from services.email_service import email_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/communications", tags=["communications"])


# ----- Helper Functions -----

def render_template(
    text: str,
    candidate: Optional[Candidate] = None,
    job: Optional[Job] = None,
    interviewer: Optional[User] = None,
    extra_context: Optional[Dict[str, str]] = None,
) -> str:
    """Replace merge fields in template text with actual data.

    Supported merge fields:
      {{candidate_name}}, {{candidate_email}}, {{candidate_phone}},
      {{candidate_status}}, {{candidate_skills}}, {{candidate_experience}},
      {{candidate_position}}, {{job_title}}, {{job_description}},
      {{interviewer_name}}, {{interviewer_email}}, {{company_name}},
      {{current_date}}

    Any field that cannot be resolved is left as-is so the caller can see
    which fields were not populated.
    """
    replacements: Dict[str, str] = {}

    if candidate:
        replacements["candidate_name"] = candidate.name or ""
        replacements["candidate_email"] = candidate.email or ""
        replacements["candidate_phone"] = candidate.phone or ""
        replacements["candidate_status"] = (candidate.status.value if candidate.status else "")
        replacements["candidate_skills"] = (
            ", ".join(candidate.skills) if candidate.skills else ""
        )
        replacements["candidate_experience"] = candidate.experience_years or ""
        replacements["candidate_position"] = candidate.current_position or ""

    if job:
        replacements["job_title"] = job.title or ""
        replacements["job_description"] = job.description or ""

    if interviewer:
        replacements["interviewer_name"] = interviewer.name or ""
        replacements["interviewer_email"] = interviewer.email or ""

    replacements["company_name"] = "Hiring Platform"
    replacements["current_date"] = datetime.utcnow().strftime("%B %d, %Y")

    # Extra context overrides everything
    if extra_context:
        replacements.update(extra_context)

    # Perform substitution
    def _replacer(match: re.Match) -> str:
        key = match.group(1).strip()
        return replacements.get(key, match.group(0))

    return re.sub(r"\{\{(\s*\w+\s*)\}\}", _replacer, text)


def _extract_variables(text: str) -> list[str]:
    """Return list of merge field names found in text."""
    return list(set(re.findall(r"\{\{\s*(\w+)\s*\}\}", text)))


def template_to_response(t: EmailTemplate) -> EmailTemplateResponse:
    """Convert an EmailTemplate model to its response schema."""
    return EmailTemplateResponse(
        id=t.id,
        name=t.name,
        subject=t.subject,
        body_html=t.body_html,
        body_text=t.body_text,
        variables=t.variables,
        trigger_type=t.trigger_type,
        trigger_condition=t.trigger_condition,
        is_active=bool(t.is_active),
        created_at=t.created_at,
        updated_at=t.updated_at,
    )


def comm_log_to_response(log: CommunicationLog) -> CommunicationLogResponse:
    """Convert a CommunicationLog model to its response schema."""
    return CommunicationLogResponse(
        id=log.id,
        candidate_id=log.candidate_id,
        candidate_name=log.candidate.name if log.candidate else None,
        template_id=log.template_id,
        template_name=log.template.name if log.template else None,
        recipient_email=log.recipient_email,
        recipient_name=log.recipient_name,
        subject=log.subject,
        body_html=log.body_html,
        body_text=log.body_text,
        sent_at=log.sent_at,
        status=log.status,
        error_message=log.error_message,
        metadata=log.extra_data,
    )


def scheduled_email_to_response(se: ScheduledEmail) -> ScheduledEmailResponse:
    """Convert a ScheduledEmail model to its response schema."""
    return ScheduledEmailResponse(
        id=se.id,
        candidate_id=se.candidate_id,
        candidate_name=se.candidate.name if se.candidate else None,
        template_id=se.template_id,
        template_name=se.template.name if se.template else None,
        scheduled_for=se.scheduled_for,
        trigger_type=se.trigger_type,
        status=se.status,
        created_at=se.created_at,
        sent_at=se.sent_at,
        cancelled_at=se.cancelled_at,
    )


# =====================================================================
# Email Template CRUD
# =====================================================================

@router.get("/templates", response_model=EmailTemplateListResponse)
async def list_templates(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all email templates."""
    templates = db.query(EmailTemplate).order_by(EmailTemplate.created_at.desc()).all()
    return EmailTemplateListResponse(
        templates=[template_to_response(t) for t in templates],
        total=len(templates),
    )


@router.post("/templates", response_model=EmailTemplateResponse, status_code=201)
async def create_template(
    data: EmailTemplateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hr_admin),
):
    """Create a new email template."""
    # Check for duplicate name
    existing = db.query(EmailTemplate).filter(EmailTemplate.name == data.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="A template with this name already exists")

    # Auto-detect variables if not provided
    variables = data.variables
    if variables is None:
        variables = _extract_variables(data.body_html + " " + data.subject)

    template = EmailTemplate(
        name=data.name,
        subject=data.subject,
        body_html=data.body_html,
        body_text=data.body_text,
        variables=variables,
        trigger_type=data.trigger_type,
        trigger_condition=data.trigger_condition,
        is_active=data.is_active,
    )
    db.add(template)
    db.commit()
    db.refresh(template)

    return template_to_response(template)


@router.put("/templates/{template_id}", response_model=EmailTemplateResponse)
async def update_template(
    template_id: str,
    data: EmailTemplateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hr_admin),
):
    """Update an existing email template."""
    template = db.query(EmailTemplate).filter(EmailTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    if data.name is not None:
        # Check uniqueness
        dup = (
            db.query(EmailTemplate)
            .filter(EmailTemplate.name == data.name, EmailTemplate.id != template_id)
            .first()
        )
        if dup:
            raise HTTPException(status_code=400, detail="A template with this name already exists")
        template.name = data.name

    if data.subject is not None:
        template.subject = data.subject
    if data.body_html is not None:
        template.body_html = data.body_html
    if data.body_text is not None:
        template.body_text = data.body_text
    if data.variables is not None:
        template.variables = data.variables
    if data.trigger_type is not None:
        template.trigger_type = data.trigger_type
    if data.trigger_condition is not None:
        template.trigger_condition = data.trigger_condition
    if data.is_active is not None:
        template.is_active = data.is_active

    db.commit()
    db.refresh(template)

    return template_to_response(template)


@router.delete("/templates/{template_id}")
async def delete_template(
    template_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hr_admin),
):
    """Delete an email template."""
    template = db.query(EmailTemplate).filter(EmailTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    db.delete(template)
    db.commit()

    return {"message": "Template deleted"}


@router.get("/templates/{template_id}/preview", response_model=TemplatePreviewResponse)
async def preview_template(
    template_id: str,
    candidate_id: Optional[str] = Query(None),
    job_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Preview a rendered template with real or sample data.

    If candidate_id / job_id are provided, real data is used to populate
    merge fields.  Otherwise placeholder sample data is used.
    """
    template = db.query(EmailTemplate).filter(EmailTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    candidate = None
    job = None

    if candidate_id:
        candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
        if candidate and not job_id:
            job = candidate.job
    if job_id:
        job = db.query(Job).filter(Job.id == job_id).first()

    # Fallback sample data when no real entities are available
    sample: Dict[str, str] = {}
    if not candidate:
        sample.update({
            "candidate_name": "Jane Doe",
            "candidate_email": "jane.doe@example.com",
            "candidate_phone": "+1 555-0100",
            "candidate_status": "applied",
            "candidate_skills": "Python, React, SQL",
            "candidate_experience": "5",
            "candidate_position": "Senior Engineer",
        })
    if not job:
        sample.update({
            "job_title": "Software Engineer",
            "job_description": "We are looking for a talented software engineer...",
        })
    sample.update({
        "interviewer_name": "John Smith",
        "interviewer_email": "john.smith@company.com",
    })

    rendered_subject = render_template(template.subject, candidate, job, extra_context=sample)
    rendered_html = render_template(template.body_html, candidate, job, extra_context=sample)
    rendered_text = (
        render_template(template.body_text, candidate, job, extra_context=sample)
        if template.body_text
        else None
    )

    variables_used = _extract_variables(template.body_html + " " + template.subject)

    return TemplatePreviewResponse(
        subject=rendered_subject,
        body_html=rendered_html,
        body_text=rendered_text,
        variables_used=variables_used,
    )


# =====================================================================
# Communication History
# =====================================================================

@router.get("/candidate/{candidate_id}/history", response_model=CommunicationHistoryResponse)
async def get_candidate_communication_history(
    candidate_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all communication history for a specific candidate."""
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    logs = (
        db.query(CommunicationLog)
        .filter(CommunicationLog.candidate_id == candidate_id)
        .order_by(CommunicationLog.sent_at.desc())
        .all()
    )

    return CommunicationHistoryResponse(
        candidate_id=candidate.id,
        candidate_name=candidate.name,
        communications=[comm_log_to_response(log) for log in logs],
        total=len(logs),
    )


@router.get("/history")
async def get_all_communication_history(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get communication history across all candidates (paginated)."""
    query = db.query(CommunicationLog).order_by(CommunicationLog.sent_at.desc())
    total = query.count()
    logs = query.offset((page - 1) * page_size).limit(page_size).all()

    return {
        "communications": [comm_log_to_response(log) for log in logs],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


# =====================================================================
# Send Email
# =====================================================================

@router.post("/send", response_model=SendEmailResponse)
async def send_email_endpoint(
    data: SendEmailRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hr_admin),
):
    """Send a manual email using a template to a candidate."""
    template = db.query(EmailTemplate).filter(EmailTemplate.id == data.template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    candidate = db.query(Candidate).filter(Candidate.id == data.candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    if not candidate.email:
        raise HTTPException(status_code=400, detail="Candidate does not have an email address")

    job = candidate.job

    # Render template
    subject = data.custom_subject or render_template(
        template.subject, candidate, job, extra_context=data.extra_context
    )
    body_html = data.custom_body or render_template(
        template.body_html, candidate, job, extra_context=data.extra_context
    )
    body_text = None
    if template.body_text:
        body_text = render_template(
            template.body_text, candidate, job, extra_context=data.extra_context
        )

    # Attempt to send
    success = email_service.send_email(
        to_email=candidate.email,
        subject=subject,
        html_body=body_html,
        text_body=body_text,
    )

    # Log the communication
    log = CommunicationLog(
        candidate_id=candidate.id,
        template_id=template.id,
        recipient_email=candidate.email,
        recipient_name=candidate.name,
        subject=subject,
        body_html=body_html,
        body_text=body_text,
        status="sent" if success else "failed",
        error_message=None if success else "Email delivery failed",
        extra_data={"job_id": job.id if job else None, "sent_by": current_user.id},
    )
    db.add(log)
    db.commit()
    db.refresh(log)

    if not success:
        return SendEmailResponse(
            success=False,
            message="Failed to send email. Check email configuration.",
            communication_log_id=log.id,
        )

    return SendEmailResponse(
        success=True,
        message=f"Email sent to {candidate.email}",
        communication_log_id=log.id,
    )


# =====================================================================
# Schedule Email
# =====================================================================

@router.post("/schedule", response_model=ScheduledEmailResponse, status_code=201)
async def schedule_email(
    data: ScheduleEmailRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hr_admin),
):
    """Schedule an email for future delivery."""
    template = db.query(EmailTemplate).filter(EmailTemplate.id == data.template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    candidate = db.query(Candidate).filter(Candidate.id == data.candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    scheduled = ScheduledEmail(
        candidate_id=candidate.id,
        template_id=template.id,
        scheduled_for=data.scheduled_for,
        trigger_type="manual",
        status="pending",
        context_data=data.context_data,
    )
    db.add(scheduled)
    db.commit()
    db.refresh(scheduled)

    return scheduled_email_to_response(scheduled)


@router.get("/scheduled", response_model=ScheduledEmailListResponse)
async def list_scheduled_emails(
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all scheduled emails, optionally filtered by status."""
    query = db.query(ScheduledEmail).order_by(ScheduledEmail.scheduled_for.asc())
    if status_filter:
        query = query.filter(ScheduledEmail.status == status_filter)

    items = query.all()

    return ScheduledEmailListResponse(
        scheduled_emails=[scheduled_email_to_response(se) for se in items],
        total=len(items),
    )


@router.delete("/scheduled/{scheduled_id}")
async def cancel_scheduled_email(
    scheduled_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hr_admin),
):
    """Cancel a scheduled email (sets status to cancelled)."""
    se = db.query(ScheduledEmail).filter(ScheduledEmail.id == scheduled_id).first()
    if not se:
        raise HTTPException(status_code=404, detail="Scheduled email not found")

    if se.status != "pending":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel a scheduled email with status '{se.status}'",
        )

    se.status = "cancelled"
    se.cancelled_at = datetime.utcnow()
    db.commit()

    return {"message": "Scheduled email cancelled"}


@router.post("/scheduled/{scheduled_id}/send-now", response_model=SendEmailResponse)
async def send_scheduled_now(
    scheduled_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hr_admin),
):
    """Immediately send a scheduled email instead of waiting."""
    se = db.query(ScheduledEmail).filter(ScheduledEmail.id == scheduled_id).first()
    if not se:
        raise HTTPException(status_code=404, detail="Scheduled email not found")

    if se.status != "pending":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot send a scheduled email with status '{se.status}'",
        )

    candidate = se.candidate
    template = se.template

    if not candidate or not candidate.email:
        raise HTTPException(status_code=400, detail="Candidate email not available")

    job = candidate.job

    # Render template with any stored context
    extra = se.context_data or {}
    subject = render_template(template.subject, candidate, job, extra_context=extra)
    body_html = render_template(template.body_html, candidate, job, extra_context=extra)
    body_text = (
        render_template(template.body_text, candidate, job, extra_context=extra)
        if template.body_text
        else None
    )

    success = email_service.send_email(
        to_email=candidate.email,
        subject=subject,
        html_body=body_html,
        text_body=body_text,
    )

    # Log
    log = CommunicationLog(
        candidate_id=candidate.id,
        template_id=template.id,
        recipient_email=candidate.email,
        recipient_name=candidate.name,
        subject=subject,
        body_html=body_html,
        body_text=body_text,
        status="sent" if success else "failed",
        error_message=None if success else "Email delivery failed",
        extra_data={"scheduled_email_id": se.id, "sent_by": current_user.id},
    )
    db.add(log)

    # Update scheduled email status
    se.status = "sent" if success else "failed"
    se.sent_at = datetime.utcnow()
    if not success:
        se.error_message = "Email delivery failed"

    db.commit()
    db.refresh(log)

    return SendEmailResponse(
        success=success,
        message=f"Email sent to {candidate.email}" if success else "Failed to send email",
        communication_log_id=log.id,
    )


# =====================================================================
# Automation Triggers (stub -- no model yet)
# =====================================================================

@router.get("/automations")
async def list_automations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all automation triggers.

    NOTE: The AutomationTrigger model has not been created yet.
    This returns an empty list as a placeholder.
    """
    return {"automations": [], "total": 0}


@router.post("/automations")
async def create_automation(
    data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hr_admin),
):
    """Create a new automation trigger (stub).

    Returns the submitted data with a generated id so the frontend
    can operate optimistically until the model is implemented.
    """
    automation = {
        "id": generate_uuid(),
        "name": data.get("name", ""),
        "trigger_event": data.get("trigger_event", ""),
        "template_id": data.get("template_id"),
        "conditions": data.get("conditions", {}),
        "delay_minutes": data.get("delay_minutes", 0),
        "is_enabled": data.get("is_enabled", True),
        "created_at": datetime.utcnow().isoformat(),
    }
    return automation


@router.put("/automations/{automation_id}")
async def update_automation(
    automation_id: str,
    data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hr_admin),
):
    """Update an automation trigger (stub)."""
    automation = {
        "id": automation_id,
        **data,
        "updated_at": datetime.utcnow().isoformat(),
    }
    return automation


@router.delete("/automations/{automation_id}")
async def delete_automation(
    automation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hr_admin),
):
    """Delete an automation trigger (stub)."""
    return {"message": "Automation deleted"}


@router.patch("/automations/{automation_id}/toggle")
async def toggle_automation(
    automation_id: str,
    data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hr_admin),
):
    """Toggle an automation trigger on/off (stub)."""
    is_enabled = data.get("is_enabled", True)
    return {
        "id": automation_id,
        "is_enabled": is_enabled,
        "message": f"Automation {'enabled' if is_enabled else 'disabled'}",
    }


# ----- AI Content Improvement -----

@router.post("/ai-improve")
async def ai_improve_content(
    data: Dict[str, Any],
    current_user: User = Depends(get_current_user),
):
    """Use AI to improve email/offer letter content based on user instructions.

    Accepts: { content: string, instruction: string }
    Returns: { improved_content: string }
    """
    content = data.get("content", "")
    instruction = data.get("instruction", "")

    if not content or not instruction:
        raise HTTPException(status_code=400, detail="Both content and instruction are required")

    try:
        import httpx
        import config

        api_key = config.OPENROUTER_API_KEY
        model = config.OPENROUTER_MODEL

        if not api_key:
            # Fallback: just return the content with a note
            return {"improved_content": content + f"\n\n[AI Note: {instruction}]"}

        prompt = f"""You are an HR communications expert. Modify the following email/letter content based on the user's instruction.

CURRENT CONTENT:
{content}

USER INSTRUCTION: {instruction}

Return ONLY the improved content, nothing else. No explanations, no markdown formatting - just the improved text."""

        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 2000,
                },
                timeout=30.0,
            )

            if response.status_code == 200:
                result = response.json()
                improved = result["choices"][0]["message"]["content"].strip()
                return {"improved_content": improved}
            else:
                logger.error(f"AI API error: {response.status_code} - {response.text}")
                return {"improved_content": content}

    except Exception as e:
        logger.error(f"AI improve error: {e}")
        return {"improved_content": content}
