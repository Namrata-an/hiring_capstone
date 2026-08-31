"""Email service for sending interview notifications."""
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from datetime import datetime, timedelta
from typing import Optional
from urllib.parse import urlencode
import uuid

import config

logger = logging.getLogger(__name__)


def build_google_calendar_link(
    title: str,
    start_time: datetime,
    duration_minutes: int = 60,
    description: str = "",
    location: str = "",
) -> str:
    """Build an OAuth-free Google Calendar 'add event' deep link.

    Google's render endpoint accepts UTC datetimes formatted as
    YYYYMMDDTHHmmssZ joined by '/'. The user just needs to be signed
    into Google in their browser; clicking the link prefills the event
    creation form.
    """
    end_time = start_time + timedelta(minutes=duration_minutes)
    fmt = "%Y%m%dT%H%M%SZ"
    params = {
        "action": "TEMPLATE",
        "text": title,
        "dates": f"{start_time.strftime(fmt)}/{end_time.strftime(fmt)}",
        "details": description,
        "location": location,
    }
    return f"https://calendar.google.com/calendar/render?{urlencode(params)}"


def generate_ics_content(
    event_title: str,
    event_description: str,
    start_time: datetime,
    duration_minutes: int = 60,
    location: str = "Virtual Meeting",
    organizer_email: str = "",
    attendee_email: str = "",
) -> str:
    """Generate an ICS (iCalendar) file content for calendar import.
    
    Args:
        event_title: Title of the calendar event
        event_description: Description/notes for the event
        start_time: Start datetime of the event (should be timezone-aware or UTC)
        duration_minutes: Duration of the event in minutes
        location: Location of the event
        organizer_email: Email of the organizer
        attendee_email: Email of the attendee
        
    Returns:
        ICS file content as a string
    """
    end_time = start_time + timedelta(minutes=duration_minutes)
    
    # Format datetime for ICS (YYYYMMDDTHHmmssZ format)
    def format_dt(dt: datetime) -> str:
        return dt.strftime("%Y%m%dT%H%M%SZ")
    
    uid = str(uuid.uuid4())
    now = datetime.utcnow()
    
    # Format description - replace newlines with escaped version
    formatted_description = event_description.replace('\n', '\\n')
    
    ics_content = f"""BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Hiring Platform//Interview Scheduler//EN
CALSCALE:GREGORIAN
METHOD:REQUEST
BEGIN:VEVENT
UID:{uid}
DTSTAMP:{format_dt(now)}
DTSTART:{format_dt(start_time)}
DTEND:{format_dt(end_time)}
SUMMARY:{event_title}
DESCRIPTION:{formatted_description}
LOCATION:{location}
STATUS:TENTATIVE
ORGANIZER;CN=Hiring Platform:mailto:{organizer_email}
ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:{attendee_email}
BEGIN:VALARM
ACTION:DISPLAY
DESCRIPTION:Interview Reminder
TRIGGER:-PT30M
END:VALARM
END:VEVENT
END:VCALENDAR"""
    
    return ics_content


class EmailService:
    """Handles sending emails for interview notifications."""
    
    def __init__(self):
        self.smtp_host = config.SMTP_HOST
        self.smtp_port = config.SMTP_PORT
        self.smtp_user = config.SMTP_USER
        self.smtp_password = config.SMTP_PASSWORD
        self.from_name = config.SMTP_FROM_NAME
        self.from_email = config.SMTP_FROM_EMAIL or config.SMTP_USER
        self.backend_url = config.BACKEND_URL
        self.frontend_url = config.FRONTEND_URL
    
    def is_configured(self) -> bool:
        """Check if email is properly configured."""
        return bool(self.smtp_user and self.smtp_password)
    
    def send_email(
        self,
        to_email: str,
        subject: str,
        html_body: str,
        text_body: Optional[str] = None,
        ics_content: Optional[str] = None,
        ics_filename: str = "interview.ics",
        pdf_path: Optional[str] = None,
        pdf_filename: Optional[str] = None
    ) -> bool:
        """Send an email with optional ICS calendar and PDF attachments.

        Args:
            to_email: Recipient email address
            subject: Email subject
            html_body: HTML content of the email
            text_body: Plain text fallback (optional)
            ics_content: ICS calendar file content (optional)
            ics_filename: Name for the ICS file attachment
            pdf_path: Path to PDF file to attach (optional)
            pdf_filename: Name for the PDF file attachment (optional)

        Returns:
            True if sent successfully, False otherwise
        """
        if not self.is_configured():
            logger.warning("Email not configured. Set SMTP_USER and SMTP_PASSWORD in .env")
            # In dev mode, log the email instead of sending
            logger.info(f"[DEV MODE] Would send email to {to_email}")
            logger.info(f"[DEV MODE] Subject: {subject}")
            logger.info(f"[DEV MODE] Body: {html_body[:500]}...")
            if ics_content:
                logger.info(f"[DEV MODE] ICS attachment: {ics_filename}")
            if pdf_path:
                logger.info(f"[DEV MODE] PDF attachment: {pdf_filename or pdf_path}")
            return True  # Return True in dev mode so flow continues
        
        try:
            # Use mixed for attachments, alternative for html/text parts
            msg = MIMEMultipart("mixed")
            msg["Subject"] = subject
            msg["From"] = f"{self.from_name} <{self.from_email}>"
            msg["To"] = to_email
            
            # Create alternative part for text/html
            alt_part = MIMEMultipart("alternative")
            
            # Add plain text part
            if text_body:
                text_part = MIMEText(text_body, "plain")
                alt_part.attach(text_part)
            
            # Add HTML part
            html_part = MIMEText(html_body, "html")
            alt_part.attach(html_part)
            
            msg.attach(alt_part)
            
            # Add ICS calendar attachment if provided
            if ics_content:
                ics_part = MIMEBase("text", "calendar", method="REQUEST")
                ics_part.set_payload(ics_content.encode("utf-8"))
                encoders.encode_base64(ics_part)
                ics_part.add_header(
                    "Content-Disposition",
                    f"attachment; filename={ics_filename}"
                )
                msg.attach(ics_part)

            # Add PDF attachment if provided
            if pdf_path:
                try:
                    with open(pdf_path, "rb") as pdf_file:
                        pdf_part = MIMEBase("application", "pdf")
                        pdf_part.set_payload(pdf_file.read())
                        encoders.encode_base64(pdf_part)
                        pdf_part.add_header(
                            "Content-Disposition",
                            f"attachment; filename={pdf_filename or 'document.pdf'}"
                        )
                        msg.attach(pdf_part)
                except Exception as e:
                    logger.error(f"Failed to attach PDF {pdf_path}: {str(e)}")
                    # Continue sending email without PDF attachment

            # Send email
            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_user, self.smtp_password)
                server.sendmail(self.from_email, to_email, msg.as_string())
            
            logger.info(f"Email sent successfully to {to_email}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {str(e)}")
            return False
    
    def send_interview_invite(
        self,
        interviewer_email: str,
        interviewer_name: str,
        candidate_name: str,
        job_title: str,
        round_name: str,
        confirmation_token: str,
        custom_message: Optional[str] = None,
        scheduled_at: Optional[datetime] = None
    ) -> bool:
        """Send interview invitation email with Yes/No confirmation links.
        
        Args:
            interviewer_email: Interviewer's email
            interviewer_name: Interviewer's name
            candidate_name: Candidate being interviewed
            job_title: Job title
            round_name: Interview round name
            confirmation_token: Token for confirmation link
            custom_message: Optional custom message from HR
            scheduled_at: Optional proposed interview datetime
            
        Returns:
            True if sent successfully
        """
        confirm_url = f"{self.backend_url}/api/v1/interviews/confirm/{confirmation_token}?action=confirm"
        decline_url = f"{self.backend_url}/api/v1/interviews/confirm/{confirmation_token}?action=decline"
        reschedule_url = f"{self.backend_url}/api/v1/interviews/confirm/{confirmation_token}?action=reschedule"

        # Format scheduled time + GCal link
        formatted_time = ""
        scheduled_time_text = ""
        gcal_url = ""
        if scheduled_at:
            formatted_time = scheduled_at.strftime("%A, %b %d, %Y · %I:%M %p UTC")
            scheduled_time_text = f"Proposed Time: {formatted_time}"
            gcal_url = build_google_calendar_link(
                title=f"Interview: {candidate_name} - {job_title}",
                start_time=scheduled_at,
                duration_minutes=60,
                description=(
                    f"Interview with {candidate_name} for {job_title} ({round_name})."
                    + (f"\n\nNotes: {custom_message}" if custom_message else "")
                ),
                location="Virtual Meeting (link TBD)",
            )

        subject = f"Interview request: {candidate_name} — {job_title} ({round_name})"

        # Build optional rows once so the main HTML stays readable.
        time_row_html = (
            f'''<tr>
                <td style="padding:14px 16px; color:#71717a; font-size:13px; border-top:1px solid #27272a;">Time</td>
                <td style="padding:14px 16px; color:#fafafa; font-size:14px; font-weight:500; text-align:right; border-top:1px solid #27272a;">{formatted_time}</td>
            </tr>'''
            if scheduled_at else ""
        )
        custom_message_html = (
            f'''<tr><td style="padding:0 28px 16px 28px;">
                <div style="background:rgba(249,115,22,0.10); border-left:3px solid #f97316; border-radius:6px; padding:12px 14px; color:#fdba74; font-size:13px; line-height:1.55;">
                    <strong style="color:#fed7aa;">Note from HR:</strong> {custom_message}
                </div>
            </td></tr>'''
            if custom_message else ""
        )
        gcal_row_html = (
            f'''<tr><td style="padding:8px 28px 0 28px; text-align:center;">
                <a href="{gcal_url}" style="color:#60a5fa; text-decoration:none; font-size:13px; font-weight:500;">📅 Add to Google Calendar</a>
                <div style="color:#52525b; font-size:11px; margin-top:6px;">A .ics calendar file is also attached.</div>
            </td></tr>'''
            if scheduled_at and gcal_url else ""
        )

        # All styling is inline because most email clients strip <style> blocks.
        # Layout uses tables for cross-client compatibility.
        html_body = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="dark" />
  <meta name="supported-color-schemes" content="dark" />
  <title>Interview Request</title>
</head>
<body style="margin:0; padding:0; background-color:#0a0a0b; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#0a0a0b; padding:32px 12px;">
  <tr><td align="center">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px; background-color:#18181b; border:1px solid #3f3f46; border-radius:16px;">

      <!-- Brand row -->
      <tr><td style="padding:24px 28px 4px 28px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td width="40" style="background-color:#3a210d; border-radius:10px; text-align:center; vertical-align:middle; line-height:40px; font-size:18px;">📅</td>
            <td style="padding-left:12px;">
              <div style="color:#fafafa; font-size:15px; font-weight:700; line-height:1.1;">Hiring Co-Pilot</div>
              <div style="color:#f97316; font-size:11px; font-weight:500; margin-top:2px; letter-spacing:0.02em;">INTERVIEW REQUEST</div>
            </td>
          </tr>
        </table>
      </td></tr>

      <!-- Greeting + lede -->
      <tr><td style="padding:18px 28px 6px 28px;">
        <h1 style="color:#fafafa; font-size:22px; font-weight:700; margin:0 0 8px 0; letter-spacing:-0.01em;">Hi {interviewer_name},</h1>
        <p style="color:#a1a1aa; font-size:15px; line-height:1.55; margin:0;">
          You've been invited to interview a candidate. Pick the option below that works
          best — your response syncs back to HR automatically.
        </p>
      </td></tr>

      <!-- Details card -->
      <tr><td style="padding:20px 28px 4px 28px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#27272a; border:1px solid #3f3f46; border-radius:12px;">
          <tr>
            <td style="padding:14px 16px; color:#71717a; font-size:13px;">Candidate</td>
            <td style="padding:14px 16px; color:#fafafa; font-size:14px; font-weight:500; text-align:right;">{candidate_name}</td>
          </tr>
          <tr>
            <td style="padding:14px 16px; color:#71717a; font-size:13px; border-top:1px solid #27272a;">Position</td>
            <td style="padding:14px 16px; color:#fafafa; font-size:14px; font-weight:500; text-align:right; border-top:1px solid #27272a;">{job_title}</td>
          </tr>
          <tr>
            <td style="padding:14px 16px; color:#71717a; font-size:13px; border-top:1px solid #27272a;">Round</td>
            <td style="padding:14px 16px; color:#fafafa; font-size:14px; font-weight:500; text-align:right; border-top:1px solid #27272a;">{round_name}</td>
          </tr>
          {time_row_html}
        </table>
      </td></tr>

      {custom_message_html}

      <!-- Action buttons -->
      <tr><td style="padding:16px 28px 0 28px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr><td style="padding-bottom:10px;">
            <a href="{confirm_url}" style="display:block; background-color:#22c55e; color:#ffffff; font-size:15px; font-weight:600; padding:13px 18px; border-radius:10px; text-decoration:none; text-align:center; box-shadow:0 1px 0 rgba(0,0,0,0.2) inset;">
              ✓ &nbsp;Yes, I can take this
            </a>
          </td></tr>
          <tr><td style="padding-bottom:10px;">
            <a href="{reschedule_url}" style="display:block; background-color:#f97316; color:#ffffff; font-size:15px; font-weight:600; padding:13px 18px; border-radius:10px; text-decoration:none; text-align:center; box-shadow:0 1px 0 rgba(0,0,0,0.2) inset;">
              ⟳ &nbsp;Request a different time
            </a>
          </td></tr>
          <tr><td>
            <a href="{decline_url}" style="display:block; background-color:#27272a; color:#fca5a5; border:1px solid #7f1d1d; font-size:15px; font-weight:600; padding:12px 18px; border-radius:10px; text-decoration:none; text-align:center;">
              ✗ &nbsp;No, I'm unavailable
            </a>
          </td></tr>
        </table>
      </td></tr>

      {gcal_row_html}

      <!-- Footer -->
      <tr><td style="padding:24px 28px 24px 28px; border-top:1px solid #27272a; margin-top:8px;">
        <p style="color:#52525b; font-size:11px; line-height:1.55; margin:0; text-align:center;">
          Buttons not working? Paste a link into your browser:
        </p>
        <p style="color:#52525b; font-size:11px; line-height:1.7; margin:8px 0 0 0; text-align:center; word-break:break-all;">
          <a href="{confirm_url}" style="color:#71717a; text-decoration:none;">Confirm</a>
          &nbsp;·&nbsp;
          <a href="{reschedule_url}" style="color:#71717a; text-decoration:none;">Reschedule</a>
          &nbsp;·&nbsp;
          <a href="{decline_url}" style="color:#71717a; text-decoration:none;">Decline</a>
        </p>
        <p style="color:#3f3f46; font-size:10px; margin:14px 0 0 0; text-align:center;">
          Sent automatically by Hiring Co-Pilot.
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>"""

        text_body = f"""Hi {interviewer_name},

You've been invited to interview a candidate.

  Candidate : {candidate_name}
  Position  : {job_title}
  Round     : {round_name}
  {scheduled_time_text}

{f'Note from HR: {custom_message}' if custom_message else ''}

Pick one of the links below to respond:

  YES, I can take this:
  {confirm_url}

  REQUEST A DIFFERENT TIME:
  {reschedule_url}

  NO, I'm unavailable:
  {decline_url}

{f'Add to Google Calendar: {gcal_url}' if gcal_url else ''}

— Hiring Co-Pilot"""
        
        # Generate ICS calendar invite if scheduled time is provided
        ics_content = None
        if scheduled_at:
            event_description = f"Interview with {candidate_name} for {job_title} position ({round_name})"
            if custom_message:
                event_description += f"\\n\\nNotes: {custom_message}"
            
            ics_content = generate_ics_content(
                event_title=f"Interview: {candidate_name} - {job_title}",
                event_description=event_description,
                start_time=scheduled_at,
                duration_minutes=60,
                location="Virtual Meeting (link TBD)",
                organizer_email=self.from_email,
                attendee_email=interviewer_email,
            )
        
        return self.send_email(
            to_email=interviewer_email, 
            subject=subject, 
            html_body=html_body, 
            text_body=text_body,
            ics_content=ics_content,
            ics_filename=f"interview_{candidate_name.replace(' ', '_')}.ics"
        )


    def send_reschedule_notification_to_hr(self, schedule) -> bool:
        """Notify HR that an interviewer has requested to reschedule.

        Filled in by Phase 6.3 with a real HTML body. For now we just route
        the notification to a configured HR email if one exists; otherwise
        we log it (dev mode).
        """
        hr_email = (
            getattr(config, "HR_NOTIFICATION_EMAIL", None)
            or self.from_email
        )
        if not hr_email:
            logger.warning(
                "No HR notification address configured — skipping reschedule alert."
            )
            return False

        candidate = getattr(schedule, "candidate", None)
        interviewer = getattr(schedule, "interviewer", None)
        round_obj = getattr(schedule, "interview_round", None)
        job = getattr(round_obj, "job", None) if round_obj else None

        proposed = (
            schedule.proposed_at.strftime("%A, %b %d, %Y · %I:%M %p UTC")
            if schedule.proposed_at else "(no preference given)"
        )
        original = (
            schedule.scheduled_at.strftime("%A, %b %d, %Y · %I:%M %p UTC")
            if schedule.scheduled_at else "Not set"
        )
        reason = schedule.reschedule_reason or "(none provided)"
        round_label = (
            round_obj.round_name if round_obj
            else (f"Round {round_obj.round_number}" if round_obj else "Unknown")
        )
        interviewer_name = interviewer.name if interviewer else "Unknown"
        interviewer_email = interviewer.email if interviewer else "unknown"
        candidate_name = candidate.name if candidate else "Unknown"
        job_title = job.title if job else "Unknown"
        subject = f"Reschedule request: {interviewer_name} — {candidate_name}"

        body = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="dark" />
  <title>Reschedule request</title>
</head>
<body style="margin:0; padding:0; background-color:#0a0a0b; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#0a0a0b; padding:32px 12px;">
  <tr><td align="center">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px; background-color:#18181b; border:1px solid #3f3f46; border-radius:16px;">
      <tr><td style="padding:24px 28px 4px 28px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td width="40" style="background-color:#3a210d; border-radius:10px; text-align:center; vertical-align:middle; line-height:40px; font-size:18px;">⟳</td>
            <td style="padding-left:12px;">
              <div style="color:#fafafa; font-size:15px; font-weight:700; line-height:1.1;">Hiring Co-Pilot</div>
              <div style="color:#f97316; font-size:11px; font-weight:500; margin-top:2px; letter-spacing:0.02em;">RESCHEDULE REQUEST</div>
            </td>
          </tr>
        </table>
      </td></tr>

      <tr><td style="padding:18px 28px 6px 28px;">
        <h1 style="color:#fafafa; font-size:22px; font-weight:700; margin:0 0 8px 0; letter-spacing:-0.01em;">An interviewer asked to reschedule</h1>
        <p style="color:#a1a1aa; font-size:14px; line-height:1.55; margin:0;">
          {interviewer_name} would like a different time for the interview with {candidate_name}.
          Open the HR pipeline view to pick a new time and re-send the invite.
        </p>
      </td></tr>

      <tr><td style="padding:20px 28px 4px 28px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#27272a; border:1px solid #3f3f46; border-radius:12px;">
          <tr>
            <td style="padding:14px 16px; color:#71717a; font-size:13px;">Interviewer</td>
            <td style="padding:14px 16px; color:#fafafa; font-size:14px; font-weight:500; text-align:right;">{interviewer_name} &lt;{interviewer_email}&gt;</td>
          </tr>
          <tr>
            <td style="padding:14px 16px; color:#71717a; font-size:13px; border-top:1px solid #3f3f46;">Candidate</td>
            <td style="padding:14px 16px; color:#fafafa; font-size:14px; font-weight:500; text-align:right; border-top:1px solid #3f3f46;">{candidate_name}</td>
          </tr>
          <tr>
            <td style="padding:14px 16px; color:#71717a; font-size:13px; border-top:1px solid #3f3f46;">Position · Round</td>
            <td style="padding:14px 16px; color:#fafafa; font-size:14px; font-weight:500; text-align:right; border-top:1px solid #3f3f46;">{job_title} · {round_label}</td>
          </tr>
          <tr>
            <td style="padding:14px 16px; color:#71717a; font-size:13px; border-top:1px solid #3f3f46;">Original time</td>
            <td style="padding:14px 16px; color:#fafafa; font-size:14px; font-weight:500; text-align:right; border-top:1px solid #3f3f46;">{original}</td>
          </tr>
          <tr>
            <td style="padding:14px 16px; color:#71717a; font-size:13px; border-top:1px solid #3f3f46;">Their preferred time</td>
            <td style="padding:14px 16px; color:#fdba74; font-size:14px; font-weight:600; text-align:right; border-top:1px solid #3f3f46;">{proposed}</td>
          </tr>
          <tr>
            <td style="padding:14px 16px; color:#71717a; font-size:13px; border-top:1px solid #3f3f46;">Attempts so far</td>
            <td style="padding:14px 16px; color:#fafafa; font-size:14px; font-weight:500; text-align:right; border-top:1px solid #3f3f46;">{schedule.reschedule_count or 1}</td>
          </tr>
        </table>
      </td></tr>

      <tr><td style="padding:0 28px 16px 28px;">
        <div style="background:rgba(249,115,22,0.10); border-left:3px solid #f97316; border-radius:6px; padding:12px 14px; color:#fdba74; font-size:13px; line-height:1.55;">
          <strong style="color:#fed7aa;">Reason:</strong> {reason}
        </div>
      </td></tr>

      <tr><td style="padding:0 28px 24px 28px;">
        <a href="{self.frontend_url}" style="display:block; background-color:#f97316; color:#ffffff; font-size:15px; font-weight:600; padding:13px 18px; border-radius:10px; text-decoration:none; text-align:center;">
          Open HR pipeline →
        </a>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>"""
        return self.send_email(to_email=hr_email, subject=subject, html_body=body)


# Singleton instance
email_service = EmailService()
