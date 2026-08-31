"""SQLAlchemy models for the hiring platform."""
import uuid
import secrets
from datetime import datetime, timezone
from enum import Enum as PyEnum

from sqlalchemy import Boolean, Column, String, Text, DateTime, ForeignKey, Enum, JSON, Integer
from sqlalchemy.orm import relationship

from database import Base


def _utcnow():
    return datetime.now(timezone.utc)


def generate_uuid():
    return str(uuid.uuid4())


def generate_confirmation_token():
    """Generate a secure token for email confirmation links."""
    return secrets.token_urlsafe(32)


class UserRole(str, PyEnum):
    HR_ADMIN = "hr_admin"
    INTERVIEWER = "interviewer"
    ADMIN = "admin"


class JobStatus(str, PyEnum):
    DRAFT = "draft"
    ACTIVE = "active"
    CLOSED = "closed"


class CandidateStatus(str, PyEnum):
    APPLIED = "applied"
    SCREENING = "screening"
    INTERVIEW_ROUND_1 = "interview_round_1"
    INTERVIEW_ROUND_2 = "interview_round_2"
    OFFER = "offer"
    HIRED = "hired"
    REJECTED = "rejected"
    OFFER_REJECTED = "offer_rejected"  # Candidate rejected the offer
    ONBOARDED = "onboarded"  # Successfully onboarded after notice period


class InterviewStatus(str, PyEnum):
    """Status for interview schedule confirmations."""
    PENDING = "pending"      # Email not yet sent or awaiting response
    CONFIRMED = "confirmed"  # Interviewer confirmed availability
    DECLINED = "declined"    # Interviewer declined
    COMPLETED = "completed"  # Interview has been conducted
    RESCHEDULE_REQUESTED = "reschedule_requested"  # Interviewer asked HR to pick a new time


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    email = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.INTERVIEWER)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    # Relationships
    jobs_created = relationship("Job", back_populates="creator", foreign_keys="Job.created_by")
    assigned_candidates = relationship("CandidateAssignment", back_populates="interviewer")
    interview_schedules = relationship(
        "InterviewSchedule",
        back_populates="interviewer",
        foreign_keys="InterviewSchedule.interviewer_id",
    )
    interview_reviews = relationship("InterviewReview", back_populates="interviewer")


class Job(Base):
    __tablename__ = "jobs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    requirements = Column(JSON, nullable=True)  # {"skills": [], "experience_years": 3, ...}
    status = Column(Enum(JobStatus), nullable=False, default=JobStatus.DRAFT)
    created_by = Column(String(36), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    # Relationships
    creator = relationship("User", back_populates="jobs_created", foreign_keys=[created_by])
    candidates = relationship("Candidate", back_populates="job")
    interview_rounds = relationship("InterviewRound", back_populates="job", cascade="all, delete-orphan")
    question_banks = relationship("QuestionBank", back_populates="job")


class Candidate(Base):
    __tablename__ = "candidates"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=True, index=True)
    phone = Column(String(50), nullable=True)
    skills = Column(JSON, nullable=True)  # List of skills extracted from resume
    experience_years = Column(String(50), nullable=True)  # Years of experience (e.g., "3" or "3-5")
    current_position = Column(String(255), nullable=True)  # Current job title
    education = Column(JSON, nullable=True)  # [{degree, institution, field, years}]
    resume_path = Column(String(500), nullable=True)
    resume_text = Column(Text, nullable=True)
    job_id = Column(String(36), ForeignKey("jobs.id"), nullable=False)
    status = Column(Enum(CandidateStatus), nullable=False, default=CandidateStatus.APPLIED)
    applied_at = Column(DateTime, default=_utcnow)
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    # Relationships
    job = relationship("Job", back_populates="candidates")
    assignments = relationship("CandidateAssignment", back_populates="candidate")
    insights = relationship("CandidateInsights", back_populates="candidate", uselist=False)
    interview_schedules = relationship("InterviewSchedule", back_populates="candidate")
    question_banks = relationship("QuestionBank", back_populates="candidate")
    interview_reviews = relationship("InterviewReview", back_populates="candidate")
    communication_logs = relationship("CommunicationLog", back_populates="candidate")
    scheduled_emails = relationship("ScheduledEmail", back_populates="candidate")
    status_history = relationship("CandidateStatusHistory", back_populates="candidate", order_by="CandidateStatusHistory.changed_at.desc()")
    reengagement_records = relationship("ReengagementCandidate", back_populates="candidate")
    offer_letter = relationship("OfferLetter", back_populates="candidate", uselist=False)
    notice_period = relationship("NoticePeriodTracking", back_populates="candidate", uselist=False)
    follow_up_schedules = relationship("FollowUpSchedule", back_populates="candidate")


class CandidateAssignment(Base):
    """Links candidates to interviewers for specific rounds."""
    __tablename__ = "candidate_assignments"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    candidate_id = Column(String(36), ForeignKey("candidates.id"), nullable=False)
    interviewer_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    round_number = Column(String(50), nullable=True)  # e.g., "round_1", "round_2"
    assigned_at = Column(DateTime, default=_utcnow)

    # Relationships
    candidate = relationship("Candidate", back_populates="assignments")
    interviewer = relationship("User", back_populates="assigned_candidates")


class CandidateInsights(Base):
    """Stores AI-generated deep insights for candidates.
    
    These insights are generated via LLM analysis and include quantifiable
    scores that can be used for ranking candidates.
    """
    __tablename__ = "candidate_insights"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    candidate_id = Column(String(36), ForeignKey("candidates.id"), nullable=False, unique=True)
    
    # Quantifiable scores (0-100)
    overall_score = Column(Integer, nullable=True)
    technical_depth_score = Column(Integer, nullable=True)
    experience_relevance_score = Column(Integer, nullable=True)
    education_score = Column(Integer, nullable=True)
    startup_mindset_score = Column(Integer, nullable=True)
    communication_score = Column(Integer, nullable=True)
    
    # Structured analysis (JSON)
    scores_breakdown = Column(JSON, nullable=True)  # Detailed score breakdown
    mindset_analysis = Column(JSON, nullable=True)  # Startup fit, signals, concerns
    technical_analysis = Column(JSON, nullable=True)  # Skills depth, trajectory
    experience_analysis = Column(JSON, nullable=True)  # Highlights, trajectory, flags
    summary = Column(JSON, nullable=True)  # Headline, strengths, areas to probe
    job_match = Column(JSON, nullable=True)  # Job-specific matching analysis
    
    # Raw LLM response for debugging
    raw_response = Column(Text, nullable=True)
    
    generated_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)
    
    # Relationships
    candidate = relationship("Candidate", back_populates="insights")


class InterviewRound(Base):
    """Defines interview rounds for a job.

    Each job can have multiple rounds (e.g., Round 1: Technical, Round 2: Culture Fit).
    Interviewers are assigned to specific rounds via InterviewSchedule.
    """
    __tablename__ = "interview_rounds"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    job_id = Column(String(36), ForeignKey("jobs.id"), nullable=False)
    round_number = Column(Integer, nullable=False)  # 1, 2, 3, etc.
    round_name = Column(String(255), nullable=True)  # e.g., "Technical", "Culture Fit"
    description = Column(Text, nullable=True)  # Optional description of what this round covers
    is_final_round = Column(Boolean, default=False, nullable=False)  # HR marks this as the last round
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    # Relationships
    job = relationship("Job", back_populates="interview_rounds")
    schedules = relationship("InterviewSchedule", back_populates="interview_round", cascade="all, delete-orphan")


class InterviewSchedule(Base):
    """Tracks interview assignments and confirmation status.
    
    Links an interviewer to a specific round for a candidate.
    Handles email confirmation workflow (pending → confirmed/declined).
    """
    __tablename__ = "interview_schedules"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    interview_round_id = Column(String(36), ForeignKey("interview_rounds.id"), nullable=False)
    candidate_id = Column(String(36), ForeignKey("candidates.id"), nullable=False)
    interviewer_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    
    # Scheduling details
    scheduled_at = Column(DateTime, nullable=True)  # When the interview is scheduled (for future use)
    
    # Confirmation workflow
    status = Column(Enum(InterviewStatus), nullable=False, default=InterviewStatus.PENDING)
    confirmation_token = Column(String(64), nullable=True, default=generate_confirmation_token)
    invite_sent_at = Column(DateTime, nullable=True)  # When email was sent
    confirmed_at = Column(DateTime, nullable=True)  # When interviewer responded

    # Reschedule workflow (Phase 6)
    proposed_at = Column(DateTime, nullable=True)  # New time the interviewer proposed
    proposed_by = Column(String(36), ForeignKey("users.id"), nullable=True)  # Who proposed it
    reschedule_reason = Column(Text, nullable=True)  # Why the interviewer wants to reschedule
    reschedule_count = Column(Integer, nullable=False, default=0)  # How many times rescheduled
    reschedule_questions_used = Column(JSON, nullable=True)  # HR clarifying Q&As (free-form)

    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    # Relationships
    interview_round = relationship("InterviewRound", back_populates="schedules")
    candidate = relationship("Candidate", back_populates="interview_schedules")
    interviewer = relationship("User", back_populates="interview_schedules", foreign_keys=[interviewer_id])
    proposer = relationship("User", foreign_keys=[proposed_by])
    review = relationship("InterviewReview", back_populates="schedule", uselist=False)


class QuestionBank(Base):
    """Stores generated question banks for interviews.
    
    Question banks are generated based on JD + resume analysis and can be
    edited by interviewers before the interview.
    """
    __tablename__ = "question_banks"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    candidate_id = Column(String(36), ForeignKey("candidates.id"), nullable=False)
    job_id = Column(String(36), ForeignKey("jobs.id"), nullable=False)
    
    # Categorized questions (stored as JSON)
    jd_based_questions = Column(JSON, nullable=True)  # Questions from job requirements
    fundamental_questions = Column(JSON, nullable=True)  # Core technical questions
    resume_questions = Column(JSON, nullable=True)  # Resume-specific questions
    behavioral_questions = Column(JSON, nullable=True)  # Startup mindset questions
    insights_based_questions = Column(JSON, nullable=True)  # Questions based on AI insights
    follow_up_topics = Column(JSON, nullable=True)  # Topics to probe deeper
    red_flag_probes = Column(JSON, nullable=True)  # Questions about concerns
    leetcode_questions = Column(JSON, nullable=True)  # LeetCode questions with links
    
    # Chat history for QB modifications
    chat_history = Column(JSON, nullable=True)  # List of {role, content, timestamp}
    
    # Round context
    round_number = Column(Integer, default=1)  # Which interview round this QB is for
    previous_review_context = Column(JSON, nullable=True)  # Summary of previous round reviews
    
    # Metadata
    auto_generated = Column(Boolean, default=True)
    modified_by_interviewer = Column(Boolean, default=False)
    
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)
    
    # Relationships
    candidate = relationship("Candidate", back_populates="question_banks")
    job = relationship("Job", back_populates="question_banks")


class InterviewReview(Base):
    """Stores interview reviews/feedback from interviewers.

    After conducting an interview, interviewers submit their assessment
    including ratings and feedback, with a final recommendation.
    """
    __tablename__ = "interview_reviews"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    schedule_id = Column(String(36), ForeignKey("interview_schedules.id"), nullable=False, unique=True)
    interviewer_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    candidate_id = Column(String(36), ForeignKey("candidates.id"), nullable=False)

    # Ratings (1-5 scale)
    technical_skills = Column(Integer, nullable=True)
    communication = Column(Integer, nullable=True)
    problem_solving = Column(Integer, nullable=True)
    cultural_fit = Column(Integer, nullable=True)
    overall_rating = Column(Integer, nullable=True)

    # Feedback
    strengths = Column(Text, nullable=True)
    areas_for_improvement = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)

    # Recommendation
    recommendation = Column(String(50), nullable=False)  # 'strong_yes', 'yes', 'maybe', 'no', 'strong_no'

    # Baton Passing: LLM-assisted review
    llm_generated_feedback = Column(JSON, nullable=True)  # Chatbot Q&A session data
    previous_reviews_context = Column(JSON, nullable=True)  # Snapshot of reviews this interviewer saw

    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    # Relationships
    schedule = relationship("InterviewSchedule", back_populates="review")
    interviewer = relationship("User", back_populates="interview_reviews")
    candidate = relationship("Candidate", back_populates="interview_reviews")


class InterviewQuestionsSnapshot(Base):
    """Immutable snapshot of the question bank at the moment an interview was
    marked conducted.

    The mutable :class:`QuestionBank` is keyed per (candidate, job) and gets
    re-generated for later rounds. This table preserves what each individual
    interviewer actually used: snapshotting category-by-category at
    "interview conducted" time gives the talent-memory view a permanent
    record of what was asked, even after the QB is later overwritten.

    One row per :class:`InterviewSchedule` — the unique constraint enforces
    a single immutable snapshot per (interviewer, candidate, round).
    """
    __tablename__ = "interview_questions_snapshots"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    schedule_id = Column(String(36), ForeignKey("interview_schedules.id"), nullable=False, unique=True)
    interviewer_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    candidate_id = Column(String(36), ForeignKey("candidates.id"), nullable=False)

    # Snapshot of QB question categories at the time of completion.
    jd_based_questions = Column(JSON, nullable=True)
    fundamental_questions = Column(JSON, nullable=True)
    resume_questions = Column(JSON, nullable=True)
    behavioral_questions = Column(JSON, nullable=True)
    insights_based_questions = Column(JSON, nullable=True)
    red_flag_probes = Column(JSON, nullable=True)
    leetcode_questions = Column(JSON, nullable=True)
    follow_up_topics = Column(JSON, nullable=True)

    # Audit: was the QB authored by the LLM, hand-edited, or had a chat trail?
    modified_by_interviewer = Column(Boolean, default=False)
    chat_history = Column(JSON, nullable=True)

    created_at = Column(DateTime, default=_utcnow)

    # Relationships
    schedule = relationship("InterviewSchedule", backref="questions_snapshot", uselist=False)


class EmailTemplate(Base):
    """Email templates for automated communications.
    
    Templates support merge fields like {{candidate_name}}, {{job_title}}, etc.
    Can be triggered automatically on status changes or scheduled manually.
    """
    __tablename__ = "email_templates"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(255), unique=True, nullable=False)  # "interview_confirmation", "rejection", etc.
    subject = Column(String(500), nullable=False)
    body_html = Column(Text, nullable=False)
    body_text = Column(Text, nullable=True)
    variables = Column(JSON, nullable=True)  # List of available merge fields
    trigger_type = Column(String(50), nullable=True)  # "status_change", "scheduled", "manual"
    trigger_condition = Column(JSON, nullable=True)  # {"status": "rejected"} or {"days_after": 14}
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    # Relationships
    communication_logs = relationship("CommunicationLog", back_populates="template")
    scheduled_emails = relationship("ScheduledEmail", back_populates="template")


class CommunicationLog(Base):
    """Tracks all sent communications for audit and history.
    
    Every email sent through the system is logged here for tracking,
    debugging, and providing communication history to HR.
    """
    __tablename__ = "communication_logs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    candidate_id = Column(String(36), ForeignKey("candidates.id"), nullable=True)
    template_id = Column(String(36), ForeignKey("email_templates.id"), nullable=True)
    recipient_email = Column(String(255), nullable=False)
    recipient_name = Column(String(255), nullable=True)
    subject = Column(String(500), nullable=False)
    body_html = Column(Text, nullable=False)
    body_text = Column(Text, nullable=True)
    sent_at = Column(DateTime, default=_utcnow)
    status = Column(String(50), default="sent")  # sent, delivered, opened, clicked, failed
    error_message = Column(Text, nullable=True)
    extra_data = Column(JSON, nullable=True)  # Additional tracking data (job_id, round_id, etc.)
    created_at = Column(DateTime, default=_utcnow)

    # Relationships
    candidate = relationship("Candidate", back_populates="communication_logs")
    template = relationship("EmailTemplate", back_populates="communication_logs")


class ScheduledEmail(Base):
    """Emails scheduled for future delivery.
    
    Supports date-based scheduling (send at specific time),
    relative scheduling (send N days after event), and
    triggered scheduling (send when condition is met).
    """
    __tablename__ = "scheduled_emails"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    candidate_id = Column(String(36), ForeignKey("candidates.id"), nullable=False)
    template_id = Column(String(36), ForeignKey("email_templates.id"), nullable=False)
    scheduled_for = Column(DateTime, nullable=False)
    trigger_type = Column(String(50), nullable=False)  # "date_based", "status_change", "relative", "manual"
    status = Column(String(50), default="pending")  # pending, sent, cancelled, failed
    context_data = Column(JSON, nullable=True)  # Extra merge field data at time of scheduling
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=_utcnow)
    sent_at = Column(DateTime, nullable=True)
    cancelled_at = Column(DateTime, nullable=True)

    # Relationships
    candidate = relationship("Candidate", back_populates="scheduled_emails")
    template = relationship("EmailTemplate", back_populates="scheduled_emails")


class CandidateStatusHistory(Base):
    """Tracks status changes for candidates over time."""
    __tablename__ = "candidate_status_history"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    candidate_id = Column(String(36), ForeignKey("candidates.id"), nullable=False)
    old_status = Column(String(50), nullable=True)  # Null for initial creation
    new_status = Column(String(50), nullable=False)
    changed_at = Column(DateTime, default=_utcnow)
    changed_by = Column(String(36), ForeignKey("users.id"), nullable=True)  # User who made the change
    notes = Column(Text, nullable=True)  # Optional notes about the change

    # Relationships
    candidate = relationship("Candidate", back_populates="status_history")
    changed_by_user = relationship("User")


class ReengagementCandidate(Base):
    """Tracks candidates identified for potential re-engagement.

    These are candidates who performed well in previous interviews but
    weren't hired (rejected, timing issue, etc.) who might be good fits
    for new positions.
    """
    __tablename__ = "reengagement_candidates"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    candidate_id = Column(String(36), ForeignKey("candidates.id"), nullable=False)
    original_job_id = Column(String(36), ForeignKey("jobs.id"), nullable=False)
    new_job_id = Column(String(36), ForeignKey("jobs.id"), nullable=True)
    reason = Column(Text, nullable=True)  # Why they're a good re-engagement candidate
    average_rating = Column(String(10), nullable=True)  # Average interview rating
    contacted_date = Column(DateTime, nullable=True)
    status = Column(String(50), default="identified")  # identified, contacted, responded, converted, declined
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    # Relationships
    candidate = relationship("Candidate", back_populates="reengagement_records")
    original_job = relationship("Job", foreign_keys=[original_job_id])
    new_job = relationship("Job", foreign_keys=[new_job_id])


class OfferLetter(Base):
    """Stores offer letters sent to hired candidates.

    Tracks offer letter content, PDF attachments, and candidate response.
    """
    __tablename__ = "offer_letters"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    candidate_id = Column(String(36), ForeignKey("candidates.id"), nullable=False, unique=True)
    subject = Column(String(500), nullable=False)
    body_html = Column(Text, nullable=False)
    body_text = Column(Text, nullable=True)

    # PDF attachment
    pdf_path = Column(String(500), nullable=True)  # File path to offer letter PDF
    pdf_filename = Column(String(255), nullable=True)  # Original filename

    # Status tracking
    sent_at = Column(DateTime, nullable=True)
    sent_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    status = Column(String(50), default="draft")  # draft, sent, accepted, rejected

    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    # Relationships
    candidate = relationship("Candidate", back_populates="offer_letter")
    sent_by_user = relationship("User", foreign_keys=[sent_by])


class NoticePeriodTracking(Base):
    """Tracks notice period dates and follow-up schedule for hired candidates."""
    __tablename__ = "notice_period_tracking"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    candidate_id = Column(String(36), ForeignKey("candidates.id"), nullable=False, unique=True)

    # Notice period details
    notice_period_end_date = Column(DateTime, nullable=False)  # Expected join date
    last_working_day_current_company = Column(DateTime, nullable=True)
    notice_period_days = Column(Integer, nullable=True)  # Total days (e.g., 30, 60, 90)

    # Follow-up configuration
    follow_up_frequency_days = Column(Integer, default=7)  # How often to check in (default: weekly)
    next_follow_up_date = Column(DateTime, nullable=True)

    # Status
    status = Column(String(50), default="active")  # active, completed, cancelled
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=_utcnow)
    created_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    # Relationships
    candidate = relationship("Candidate", back_populates="notice_period")
    created_by_user = relationship("User", foreign_keys=[created_by])
    follow_ups = relationship("FollowUpSchedule", back_populates="notice_period", cascade="all, delete-orphan")


class FollowUpSchedule(Base):
    """Individual follow-up emails scheduled during notice period."""
    __tablename__ = "follow_up_schedules"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    notice_period_id = Column(String(36), ForeignKey("notice_period_tracking.id"), nullable=False)
    candidate_id = Column(String(36), ForeignKey("candidates.id"), nullable=False)

    # Schedule details
    scheduled_date = Column(DateTime, nullable=False)
    follow_up_number = Column(Integer, nullable=False)  # 1st, 2nd, 3rd follow-up

    # Email content
    subject = Column(String(500), nullable=True)
    body_html = Column(Text, nullable=True)
    body_text = Column(Text, nullable=True)
    template_id = Column(String(36), ForeignKey("email_templates.id"), nullable=True)

    # Status
    status = Column(String(50), default="pending")  # pending, sent, failed, cancelled
    sent_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)

    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    # Relationships
    notice_period = relationship("NoticePeriodTracking", back_populates="follow_ups")
    candidate = relationship("Candidate", back_populates="follow_up_schedules")
    template = relationship("EmailTemplate", foreign_keys=[template_id])
