"""Pydantic schemas for request/response validation."""
from datetime import datetime
from typing import Optional, List, Any, Dict
from pydantic import BaseModel, EmailStr

from models import UserRole, JobStatus, CandidateStatus, InterviewStatus


# ----- Auth Schemas -----
class UserRegister(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: UserRole = UserRole.INTERVIEWER


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: UserRole

    model_config = {"from_attributes": True}


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# ----- Role Switching Schemas -----
class RolesResponse(BaseModel):
    roles: List[str]
    current_role: str


class SwitchRoleRequest(BaseModel):
    role: str


class SwitchRoleResponse(BaseModel):
    token: str
    role: str
    user: UserResponse


# ----- Job Schemas -----
class JobRequirements(BaseModel):
    skills: List[str] = []
    experience_years: Optional[int] = None
    education: Optional[str] = None
    nice_to_have: List[str] = []


class JobCreate(BaseModel):
    title: str
    description: Optional[str] = None
    requirements: Optional[JobRequirements] = None
    status: JobStatus = JobStatus.DRAFT


class JobUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    requirements: Optional[JobRequirements] = None
    status: Optional[JobStatus] = None


class JobResponse(BaseModel):
    id: str
    title: str
    description: Optional[str]
    requirements: Optional[Any]
    status: JobStatus
    created_by: str
    created_at: datetime
    updated_at: datetime
    candidate_count: int = 0

    model_config = {"from_attributes": True}


class JobListResponse(BaseModel):
    jobs: List[JobResponse]
    total: int


# ----- Candidate Schemas -----
class EducationEntry(BaseModel):
    degree: Optional[str] = None
    institution: Optional[str] = None
    field: Optional[str] = None
    years: Optional[str] = None  # e.g., "2016-2020"


class CandidateCreate(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    skills: Optional[List[str]] = None
    experience_years: Optional[str] = None
    current_position: Optional[str] = None
    education: Optional[List[EducationEntry]] = None
    job_id: str


class CandidateUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    skills: Optional[List[str]] = None
    experience_years: Optional[str] = None
    current_position: Optional[str] = None
    education: Optional[List[EducationEntry]] = None
    status: Optional[CandidateStatus] = None


class CandidateResponse(BaseModel):
    id: str
    name: str
    email: Optional[str]
    phone: Optional[str]
    skills: Optional[List[str]]
    experience_years: Optional[str]
    current_position: Optional[str]
    education: Optional[List[Any]]
    resume_path: Optional[str]
    job_id: str
    status: CandidateStatus
    applied_at: datetime
    created_at: datetime
    updated_at: datetime
    has_insights: bool = False  # Indicates if insights have been generated
    overall_score: Optional[int] = None  # Overall AI-generated score (0-100) for ranking

    model_config = {"from_attributes": True}


class CandidateDetailResponse(CandidateResponse):
    resume_text: Optional[str]
    job_title: Optional[str] = None


# ----- Resume Extraction Schemas -----
class ResumeExtractRequest(BaseModel):
    resume_text: str


class ResumeExtractResponse(BaseModel):
    name: Optional[str]
    email: Optional[str]
    phone: Optional[str]
    skills: List[str]
    experience_years: Optional[str]
    current_position: Optional[str]
    education: List[EducationEntry]


class CandidateListResponse(BaseModel):
    candidates: List[CandidateResponse]
    total: int


class CandidateRankingStats(BaseModel):
    """Statistics about candidate rankings for a job."""
    job_id: str
    job_title: Optional[str]
    total_candidates: int
    candidates_with_scores: int
    score_distribution: dict  # {"90-100": 2, "80-89": 5, "70-79": 10, ...}
    average_score: Optional[float]
    top_candidate_score: Optional[int]
    top_candidate_name: Optional[str]
    candidates_above_80: int  # Strong candidates
    candidates_above_70: int  # Good candidates
    candidates_above_60: int  # Average candidates


# ----- Assignment Schemas -----
class AssignmentCreate(BaseModel):
    candidate_id: str
    interviewer_id: str
    round_number: Optional[str] = None


class AssignmentResponse(BaseModel):
    id: str
    candidate_id: str
    interviewer_id: str
    round_number: Optional[str]
    assigned_at: datetime
    candidate: Optional[CandidateResponse] = None

    model_config = {"from_attributes": True}


# ----- Insights Schemas -----
class InsightScores(BaseModel):
    overall_score: Optional[int] = None
    technical_depth: Optional[int] = None
    experience_relevance: Optional[int] = None
    education_quality: Optional[int] = None
    startup_mindset: Optional[int] = None
    communication_signals: Optional[int] = None


class MindsetAnalysis(BaseModel):
    startup_fit: Optional[bool] = None
    fit_level: Optional[str] = None  # high, medium, low
    positive_signals: List[str] = []
    concerns: List[str] = []
    culture_indicators: List[str] = []


class TechnicalAnalysis(BaseModel):
    primary_skills: List[str] = []
    skill_depth: Optional[Dict[str, str]] = None
    missing_skills: List[str] = []
    tech_trajectory: Optional[str] = None
    standout_technical: Optional[str] = None


class ExperienceAnalysis(BaseModel):
    total_years: Optional[int] = None
    highlights: List[str] = []
    trajectory: Optional[str] = None
    red_flags: List[str] = []
    company_types: List[str] = []
    leadership_signals: List[str] = []


class InsightsSummary(BaseModel):
    headline: Optional[str] = None
    top_strengths: List[str] = []
    key_concerns: List[str] = []
    areas_to_probe: List[str] = []
    quick_verdict: Optional[str] = None  # strong_yes, yes, maybe, no, strong_no


class JobMatchAnalysis(BaseModel):
    required_skills_match: List[str] = []
    required_skills_missing: List[str] = []
    match_percentage: Optional[int] = None
    experience_gap: Optional[str] = None
    overall_fit_for_role: Optional[str] = None


class CandidateInsightsResponse(BaseModel):
    id: str
    candidate_id: str
    scores: InsightScores
    mindset: MindsetAnalysis
    technical: TechnicalAnalysis
    experience: ExperienceAnalysis
    summary: InsightsSummary
    job_match: Optional[JobMatchAnalysis] = None
    generated_at: datetime

    model_config = {"from_attributes": True}


class CandidateInsightsCreate(BaseModel):
    """For manually creating/updating insights (admin use)."""
    scores: Optional[InsightScores] = None
    mindset: Optional[MindsetAnalysis] = None
    technical: Optional[TechnicalAnalysis] = None
    experience: Optional[ExperienceAnalysis] = None
    summary: Optional[InsightsSummary] = None


# ----- Interview Pipeline Schemas -----
class InterviewRoundCreate(BaseModel):
    """Create a new interview round for a job."""
    round_number: int
    round_name: Optional[str] = None
    description: Optional[str] = None
    is_final_round: bool = False


class InterviewRoundUpdate(BaseModel):
    """Update an existing interview round."""
    round_number: Optional[int] = None
    round_name: Optional[str] = None
    description: Optional[str] = None
    is_final_round: Optional[bool] = None


class InterviewerInfo(BaseModel):
    """Minimal interviewer info for display."""
    id: str
    name: str
    email: str
    role: UserRole

    model_config = {"from_attributes": True}


class InterviewScheduleResponse(BaseModel):
    """Response for a single interview schedule entry."""
    id: str
    interview_round_id: str
    candidate_id: str
    interviewer_id: str
    candidate_name: Optional[str] = None
    interviewer_name: Optional[str] = None
    interviewer_email: Optional[str] = None
    job_id: Optional[str] = None
    job_title: Optional[str] = None
    round_number: Optional[int] = None
    round_name: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    status: InterviewStatus
    invite_sent_at: Optional[datetime] = None
    confirmed_at: Optional[datetime] = None
    created_at: datetime
    # Review data (populated when status is completed)
    review_recommendation: Optional[str] = None
    review_overall_rating: Optional[int] = None
    # Reschedule fields (Phase 6)
    proposed_at: Optional[datetime] = None
    proposed_by: Optional[str] = None
    reschedule_reason: Optional[str] = None
    reschedule_count: Optional[int] = 0
    reschedule_questions_used: Optional[List[Dict[str, Any]]] = None

    model_config = {"from_attributes": True}


class RescheduleRequest(BaseModel):
    """Interviewer asks HR to reschedule an interview."""
    proposed_at: Optional[datetime] = None  # Alternative time the interviewer suggests
    reason: Optional[str] = None  # Why they want to reschedule
    questions_used: Optional[List[Dict[str, Any]]] = None  # Free-form Q&A context


class ProcessRescheduleRequest(BaseModel):
    """HR confirms (or finalizes) a reschedule by picking a new time."""
    new_scheduled_at: datetime  # The new agreed time
    notify_interviewer: bool = True  # Whether to email the interviewer the new invite
    custom_message: Optional[str] = None


class InterviewRoundResponse(BaseModel):
    """Response for an interview round with its schedules."""
    id: str
    job_id: str
    round_number: int
    round_name: Optional[str] = None
    description: Optional[str] = None
    is_final_round: bool = False
    schedules: List[InterviewScheduleResponse] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PipelineResponse(BaseModel):
    """Full pipeline view for a job with all rounds and assignments."""
    job_id: str
    job_title: str
    rounds: List[InterviewRoundResponse]
    interviewers: List[InterviewerInfo]  # Available interviewers to assign


class InterviewAssignCreate(BaseModel):
    """Assign an interviewer to a round for a candidate."""
    interview_round_id: str
    candidate_id: str
    interviewer_id: str
    scheduled_at: Optional[datetime] = None


class InterviewConfirmationResponse(BaseModel):
    """Response after confirmation action."""
    success: bool
    message: str
    status: InterviewStatus


class SendInviteRequest(BaseModel):
    """Request to send interview invitation email."""
    custom_message: Optional[str] = None  # Optional custom message in email
    scheduled_at: Optional[datetime] = None  # Proposed interview date/time


# ----- Question Bank Schemas -----
class QuestionCategory(BaseModel):
    """A category of interview questions."""
    category: str  # e.g., "Fundamentals", "Resume-specific", "Behavioral"
    questions: List[str]


class QuestionBankResponse(BaseModel):
    """Generated question bank for an interview."""
    id: str
    candidate_id: str
    job_id: str
    categories: List[QuestionCategory]
    jd_based_questions: List[str]  # Questions specific to job requirements
    fundamental_questions: List[str]  # Core technical/domain fundamentals
    resume_questions: List[str]  # Questions about candidate's specific experience
    behavioral_questions: List[str]  # Startup mindset, culture fit
    generated_at: datetime

    model_config = {"from_attributes": True}


class QuestionBankCreate(BaseModel):
    """Request to generate question bank."""
    candidate_id: str
    job_id: str
    focus_areas: Optional[List[str]] = None  # Optional areas to focus on


# ----- Talent Memory & Re-engagement Schemas -----
class ReengagementStatus(str):
    IDENTIFIED = "identified"
    CONTACTED = "contacted"
    RESPONDED = "responded"
    CONVERTED = "converted"
    DECLINED = "declined"


class CandidateStatusHistoryResponse(BaseModel):
    id: str
    candidate_id: str
    old_status: Optional[str]
    new_status: str
    changed_at: datetime
    changed_by: Optional[str]
    changed_by_name: Optional[str] = None
    notes: Optional[str]

    model_config = {"from_attributes": True}


class ReviewContext(BaseModel):
    """Extracted context from a previous interview review."""
    round_number: int
    interviewer_name: Optional[str] = None
    overall_rating: Optional[int] = None
    gold_areas: List[str] = []  # Strengths (ratings 4-5, positive feedback)
    grey_areas: List[str] = []  # Weaknesses (ratings 1-3, areas for improvement)
    recommendation: Optional[str] = None
    technical_skills: Optional[int] = None
    communication: Optional[int] = None
    problem_solving: Optional[int] = None
    cultural_fit: Optional[int] = None


class PreviousReviewsResponse(BaseModel):
    """Response containing all previous reviews with extracted context."""
    candidate_id: str
    candidate_name: str
    total_reviews: int
    reviews: List[ReviewContext]
    aggregated_gold_areas: List[str] = []  # Combined strengths across all rounds
    aggregated_grey_areas: List[str] = []  # Combined weaknesses to probe


class TalentSearchFilters(BaseModel):
    """Filters for searching the talent database."""
    name: Optional[str] = None
    skills: Optional[List[str]] = None
    job_id: Optional[str] = None
    min_experience_years: Optional[int] = None
    max_experience_years: Optional[int] = None
    status: Optional[List[str]] = None  # Filter by candidate status
    min_overall_score: Optional[int] = None  # From insights
    min_interview_rating: Optional[float] = None  # Average interview rating
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    has_insights: Optional[bool] = None
    rounds_completed: Optional[int] = None  # Minimum rounds completed


class TalentSearchResult(BaseModel):
    """A single result from talent search."""
    candidate_id: str
    name: str
    email: Optional[str]
    skills: Optional[List[str]]
    experience_years: Optional[str]
    current_position: Optional[str]
    status: str
    job_id: str
    job_title: Optional[str]
    applied_at: datetime
    overall_score: Optional[int] = None  # From insights
    average_interview_rating: Optional[float] = None
    rounds_completed: int = 0
    match_score: float = 0.0  # Relevance score for search


class TalentSearchResponse(BaseModel):
    """Response from talent search."""
    results: List[TalentSearchResult]
    total: int
    page: int
    page_size: int


class CandidateHistoryResponse(BaseModel):
    """Complete history timeline for a candidate."""
    candidate_id: str
    candidate_name: str
    email: Optional[str]
    job_id: str
    job_title: Optional[str]
    current_status: str
    applied_at: datetime
    timeline: List[Dict[str, Any]]  # Chronological events
    interview_rounds: List[Dict[str, Any]]
    reviews: List[ReviewContext]
    insights_summary: Optional[Dict[str, Any]] = None
    status_changes: List[CandidateStatusHistoryResponse]


# ----- Interview Timeline Schemas (Phase 7) -----

# Stable event kinds the frontend recognizes. New kinds can be added later
# without breaking older clients — they should fall back to a generic render.
TimelineEventKind = str  # "applied" | "status_changed" | "interview_assigned" |
                        # "invite_sent" | "interview_confirmed" |
                        # "interview_declined" | "reschedule_requested" |
                        # "reschedule_processed" | "interview_completed" |
                        # "review_submitted" | "email_sent"


class TimelineActor(BaseModel):
    """Who performed the action, when one is identifiable."""
    id: Optional[str] = None
    name: Optional[str] = None
    role: Optional[str] = None  # "hr_admin" | "interviewer" | "candidate" | "system"


class TimelineEvent(BaseModel):
    """One event on the candidate's interview timeline.

    Stable shape across all kinds so the frontend can render unknown future
    kinds gracefully — `meta` carries kind-specific key/value pairs the UI
    can show as a labelled list.
    """
    kind: str
    at: datetime
    actor: Optional[TimelineActor] = None
    title: str
    body: Optional[str] = None
    meta: Dict[str, Any] = {}


class CandidateTimelineResponse(BaseModel):
    candidate_id: str
    candidate_name: str
    job_title: Optional[str] = None
    events: List[TimelineEvent]


# ----- Talent Memory: interviewer-facing candidate list (Phase 7.5) -----

class TalentMemoryCandidateSummary(BaseModel):
    """One row in the interviewer's Talent Memory list.

    `my_role` describes the current user's relationship to this candidate
    even when the list is filtered to "all candidates" — it's the lens through
    which the interviewer recognises which entries are theirs.
    """
    candidate_id: str
    name: str
    email: Optional[str] = None
    skills: Optional[List[str]] = None
    experience_years: Optional[str] = None
    current_position: Optional[str] = None
    job_id: str
    job_title: Optional[str] = None
    status: str
    applied_at: datetime
    rounds_total: int
    rounds_completed: int
    my_role: str  # "interviewed" | "assigned" | "none"
    my_review_id: Optional[str] = None
    latest_event_kind: Optional[str] = None
    latest_event_at: Optional[datetime] = None


class TalentMemoryListResponse(BaseModel):
    candidates: List[TalentMemoryCandidateSummary]
    total: int
    scope: str  # "mine" | "all"


# ----- Interview Questions Snapshot (Phase 7.8) -----

class InterviewQuestionsSnapshotResponse(BaseModel):
    """Read-only response: the exact questions that an interviewer used in a
    given interview, captured at the moment they marked it conducted."""
    id: str
    schedule_id: str
    interviewer_id: str
    interviewer_name: Optional[str] = None
    candidate_id: str
    candidate_name: Optional[str] = None
    job_title: Optional[str] = None
    round_label: Optional[str] = None

    jd_based_questions: List[Any] = []
    fundamental_questions: List[Any] = []
    resume_questions: List[Any] = []
    behavioral_questions: List[Any] = []
    insights_based_questions: List[Any] = []
    red_flag_probes: List[Any] = []
    leetcode_questions: List[Any] = []
    follow_up_topics: List[Any] = []

    modified_by_interviewer: bool = False
    chat_history: List[Any] = []

    created_at: datetime


class ReengagementCandidateCreate(BaseModel):
    """Request to mark a candidate for re-engagement."""
    candidate_id: str
    reason: Optional[str] = None
    new_job_id: Optional[str] = None


class ReengagementCandidateResponse(BaseModel):
    """Response for a re-engagement candidate."""
    id: str
    candidate_id: str
    candidate_name: str
    candidate_email: Optional[str]
    original_job_id: str
    original_job_title: Optional[str]
    new_job_id: Optional[str]
    new_job_title: Optional[str]
    reason: Optional[str]
    average_rating: Optional[str]
    contacted_date: Optional[datetime]
    status: str
    created_at: datetime
    skills: Optional[List[str]] = None

    model_config = {"from_attributes": True}


class ReengagementStatusUpdate(BaseModel):
    """Request to update re-engagement status."""
    status: str  # identified, contacted, responded, converted, declined
    notes: Optional[str] = None
    new_job_id: Optional[str] = None
    contacted_date: Optional[datetime] = None


class CloseRejectCandidateResponse(BaseModel):
    """Response for 'close' rejected candidates good for re-engagement."""
    candidate_id: str
    name: str
    email: Optional[str]
    original_job_title: str
    skills: Optional[List[str]]
    average_rating: float
    highest_rating: int
    recommendation_counts: Dict[str, int]  # Count of yes, maybe, no recommendations
    rounds_completed: int
    rejection_reason: Optional[str]  # From status history notes
    already_marked_for_reengagement: bool


# ----- Communication Schemas -----
class EmailTemplateCreate(BaseModel):
    """Create a new email template."""
    name: str
    subject: str
    body_html: str
    body_text: Optional[str] = None
    variables: Optional[List[str]] = None  # Available merge fields
    trigger_type: Optional[str] = None  # "status_change", "scheduled", "manual"
    trigger_condition: Optional[Dict[str, Any]] = None
    is_active: bool = True


class EmailTemplateUpdate(BaseModel):
    """Update an existing email template."""
    name: Optional[str] = None
    subject: Optional[str] = None
    body_html: Optional[str] = None
    body_text: Optional[str] = None
    variables: Optional[List[str]] = None
    trigger_type: Optional[str] = None
    trigger_condition: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None


class EmailTemplateResponse(BaseModel):
    """Response for an email template."""
    id: str
    name: str
    subject: str
    body_html: str
    body_text: Optional[str]
    variables: Optional[List[str]]
    trigger_type: Optional[str]
    trigger_condition: Optional[Dict[str, Any]]
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime]

    model_config = {"from_attributes": True}


class EmailTemplateListResponse(BaseModel):
    """List of email templates."""
    templates: List[EmailTemplateResponse]
    total: int


class TemplatePreviewRequest(BaseModel):
    """Request to preview a template with sample data."""
    candidate_id: Optional[str] = None  # Use real candidate data if provided
    job_id: Optional[str] = None
    sample_data: Optional[Dict[str, str]] = None  # Override specific fields


class TemplatePreviewResponse(BaseModel):
    """Preview of rendered template."""
    subject: str
    body_html: str
    body_text: Optional[str]
    variables_used: List[str]


class CommunicationLogResponse(BaseModel):
    """Response for a communication log entry."""
    id: str
    candidate_id: Optional[str]
    candidate_name: Optional[str] = None
    template_id: Optional[str]
    template_name: Optional[str] = None
    recipient_email: str
    recipient_name: Optional[str]
    subject: str
    body_html: str
    body_text: Optional[str]
    sent_at: datetime
    status: str
    error_message: Optional[str]
    metadata: Optional[Dict[str, Any]]

    model_config = {"from_attributes": True}


class CommunicationHistoryResponse(BaseModel):
    """Communication history for a candidate."""
    candidate_id: str
    candidate_name: str
    communications: List[CommunicationLogResponse]
    total: int


class SendEmailRequest(BaseModel):
    """Request to send a manual email using a template."""
    template_id: str
    candidate_id: str
    custom_subject: Optional[str] = None  # Override template subject
    custom_body: Optional[str] = None  # Override template body
    extra_context: Optional[Dict[str, str]] = None  # Additional merge fields


class SendEmailResponse(BaseModel):
    """Response after sending an email."""
    success: bool
    message: str
    communication_log_id: Optional[str] = None


class ScheduleEmailRequest(BaseModel):
    """Request to schedule an email for future delivery."""
    template_id: str
    candidate_id: str
    scheduled_for: datetime
    context_data: Optional[Dict[str, str]] = None  # Extra merge fields


class ScheduledEmailResponse(BaseModel):
    """Response for a scheduled email."""
    id: str
    candidate_id: str
    candidate_name: Optional[str] = None
    template_id: str
    template_name: Optional[str] = None
    scheduled_for: datetime
    trigger_type: str
    status: str
    created_at: datetime
    sent_at: Optional[datetime]
    cancelled_at: Optional[datetime]

    model_config = {"from_attributes": True}


class ScheduledEmailListResponse(BaseModel):
    """List of scheduled emails."""
    scheduled_emails: List[ScheduledEmailResponse]
    total: int


class BulkEmailRequest(BaseModel):
    """Request to send bulk emails to multiple candidates."""
    template_id: str
    candidate_ids: List[str]
    extra_context: Optional[Dict[str, str]] = None


class BulkEmailResponse(BaseModel):
    """Response after sending bulk emails."""
    total_sent: int
    total_failed: int
    results: List[Dict[str, Any]]


# ----- Review Assistant Schemas -----
class ReviewAssistantRequest(BaseModel):
    """Request for AI-guided review questions."""
    schedule_id: str
    basic_metrics: Dict[str, Any]


class ReviewChatRequest(BaseModel):
    """Request for review chat refinement."""
    message: str
    conversation_history: List[Dict[str, Any]] = []


# ----- HR Communications Schemas -----
class OfferLetterCreate(BaseModel):
    """Request to create/update an offer letter."""
    candidate_id: str
    subject: str
    body_html: str
    body_text: Optional[str] = None


class OfferLetterResponse(BaseModel):
    """Response for an offer letter."""
    id: str
    candidate_id: str
    subject: str
    body_html: str
    body_text: Optional[str] = None
    pdf_filename: Optional[str] = None
    status: str
    sent_at: Optional[str] = None
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}


class NoticePeriodCreate(BaseModel):
    """Request to create notice period tracking."""
    candidate_id: str
    notice_period_end_date: datetime
    last_working_day_current_company: Optional[datetime] = None
    notice_period_days: Optional[int] = None
    follow_up_frequency_days: Optional[int] = 7
    notes: Optional[str] = None


class FollowUpResponse(BaseModel):
    """Response for a follow-up schedule item."""
    id: str
    scheduled_date: str
    follow_up_number: int
    status: str
    sent_at: Optional[str] = None

    model_config = {"from_attributes": True}


class NoticePeriodResponse(BaseModel):
    """Response for notice period tracking."""
    id: str
    candidate_id: str
    notice_period_end_date: str
    last_working_day_current_company: Optional[str] = None
    notice_period_days: Optional[int] = None
    follow_up_frequency_days: int
    next_follow_up_date: Optional[str] = None
    status: str
    notes: Optional[str] = None
    follow_ups: List[FollowUpResponse] = []
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}


class CandidateStatusUpdate(BaseModel):
    """Request to update candidate status."""
    status: str
    reason: Optional[str] = None
