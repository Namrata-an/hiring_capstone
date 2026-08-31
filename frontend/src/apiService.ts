import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://localhost:8000';

const apiClient = axios.create({
    baseURL: `${API_BASE_URL}/api/v1/`,
    timeout: 60000, // 60 seconds
});

// Store token for use in non-axios requests
let currentToken: string | null = null;

// Add auth token to all requests
export const setAuthToken = (token: string | null) => {
    currentToken = token;
    if (token) {
        // For Axios 1.x, use the headers object setter if possible
        if (apiClient.defaults.headers.common && typeof (apiClient.defaults.headers.common as any).set === 'function') {
            (apiClient.defaults.headers.common as any).set('Authorization', `Bearer ${token}`);
        } else {
            (apiClient.defaults.headers.common as any)['Authorization'] = `Bearer ${token}`;
        }
    } else {
        if (apiClient.defaults.headers.common) {
            if (typeof (apiClient.defaults.headers.common as any).delete === 'function') {
                (apiClient.defaults.headers.common as any).delete('Authorization');
            } else {
                delete (apiClient.defaults.headers.common as any)['Authorization'];
            }
        }
    }
};

// Get current auth token
export const getAuthToken = () => currentToken;

// Request interceptor — always attach the latest token.
// Falls back to localStorage so requests fired before setAuthToken()
// is called (e.g. child components mounting before AuthContext useEffect)
// still carry the correct Authorization header.
apiClient.interceptors.request.use((config) => {
    // Get token from memory or storage
    let token = currentToken || localStorage.getItem('token');
    
    // Safety check: sometimes localStorage can contain string literals like "null" or "undefined"
    if (token === 'null' || token === 'undefined') {
        token = null;
    }

    if (token) {
        // Ensure no "Bearer " prefix is duplicated
        const cleanToken = token.startsWith('Bearer ') ? token.slice(7).trim() : token.trim();
        
        // In Axios 1.x, config.headers is an AxiosHeaders object
        // Use the proper setter if available, otherwise fallback to direct assignment
        if (config.headers && typeof (config.headers as any).set === 'function') {
            (config.headers as any).set('Authorization', `Bearer ${cleanToken}`);
        } else {
            config.headers = config.headers || {};
            config.headers['Authorization'] = `Bearer ${cleanToken}`;
        }
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

// Response interceptor to handle 401 Unauthorized globally
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            console.error('Unauthorized! Clearing local storage and redirecting to login...');
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            // We can't use history here easily without more setup, 
            // but the App state will pick up the missing user on next render.
        }
        return Promise.reject(error);
    }
);

// ============== Jobs API ==============
export interface JobRequirements {
    skills: string[];
    experience_years?: number;
    education?: string;
    nice_to_have: string[];
}

export interface Job {
    id: string;
    title: string;
    description?: string;
    requirements?: JobRequirements;
    status: 'draft' | 'active' | 'closed';
    created_by: string;
    created_at: string;
    updated_at: string;
    candidate_count: number;
}

export interface JobCreate {
    title: string;
    description?: string;
    requirements?: JobRequirements;
    status?: 'draft' | 'active' | 'closed';
}

// ============== Candidates API ==============
export interface EducationEntry {
    degree?: string;
    institution?: string;
    field?: string;
    years?: string;
}

export interface Candidate {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    skills?: string[];
    experience_years?: string;
    current_position?: string;
    education?: EducationEntry[];
    resume_path?: string;
    resume_text?: string;
    job_id: string;
    job_title?: string;
    status: 'applied' | 'screening' | 'interview_round_1' | 'interview_round_2' | 'offer' | 'hired' | 'rejected' | 'onboarded' | 'offer_rejected';
    applied_at: string;
    created_at: string;
    updated_at: string;
    has_insights?: boolean;
    overall_score?: number | null;  // AI-generated score (0-100) for ranking
}

// ============== Insights API ==============
export interface InsightScores {
    overall_score: number | null;
    technical_depth: number | null;
    experience_relevance: number | null;
    education_quality: number | null;
    startup_mindset: number | null;
    communication_signals: number | null;
}

export interface MindsetAnalysis {
    startup_fit: boolean | null;
    fit_level: string | null;
    positive_signals: string[];
    concerns: string[];
    culture_indicators: string[];
}

export interface TechnicalAnalysis {
    primary_skills: string[];
    skill_depth: Record<string, string> | null;
    missing_skills: string[];
    tech_trajectory: string | null;
    standout_technical: string | null;
}

export interface ExperienceAnalysis {
    total_years: number | null;
    highlights: string[];
    trajectory: string | null;
    red_flags: string[];
    company_types: string[];
    leadership_signals: string[];
}

export interface InsightsSummary {
    headline: string | null;
    top_strengths: string[];
    key_concerns: string[];
    areas_to_probe: string[];
    quick_verdict: 'strong_yes' | 'yes' | 'maybe' | 'no' | 'strong_no' | null;
}

export interface JobMatchAnalysis {
    required_skills_match: string[];
    required_skills_missing: string[];
    match_percentage: number | null;
    experience_gap: string | null;
    overall_fit_for_role: string | null;
}

export interface CandidateInsights {
    id: string;
    candidate_id: string;
    scores: InsightScores;
    mindset: MindsetAnalysis;
    technical: TechnicalAnalysis;
    experience: ExperienceAnalysis;
    summary: InsightsSummary;
    job_match: JobMatchAnalysis | null;
    generated_at: string;
}

export interface ResumeExtractResponse {
    name: string | null;
    email: string | null;
    phone: string | null;
    skills: string[];
    experience_years: string | null;
    current_position: string | null;
    education: EducationEntry[];
}

export interface User {
    id: string;
    email: string;
    name: string;
    role: 'hr_admin' | 'interviewer';
}

// ============== Interview Pipeline API ==============
export type InterviewStatus = 'pending' | 'confirmed' | 'declined' | 'completed' | 'reschedule_requested';

export interface InterviewerInfo {
    id: string;
    name: string;
    email: string;
    role: 'hr_admin' | 'interviewer';
}

export interface InterviewSchedule {
    id: string;
    interview_round_id: string;
    candidate_id: string;
    interviewer_id: string;
    candidate_name?: string;
    interviewer_name?: string;
    interviewer_email?: string;
    job_id?: string;
    job_title?: string;
    round_number?: number;
    round_name?: string;
    scheduled_at?: string;
    status: InterviewStatus;
    invite_sent_at?: string;
    confirmed_at?: string;
    created_at: string;
    // Review data (populated when status is completed)
    review_recommendation?: string;
    review_overall_rating?: number;
    // Reschedule fields (Phase 6)
    proposed_at?: string;
    proposed_by?: string;
    reschedule_reason?: string;
    reschedule_count?: number;
    reschedule_questions_used?: Array<Record<string, unknown>>;
    // Nested objects when fetched with joins
    candidate?: {
        id: string;
        name: string;
        email?: string;
    };
    round?: {
        id: string;
        round_number: number;
        round_name?: string;
    };
    job?: {
        id: string;
        title: string;
    };
}

export interface RescheduleRequestPayload {
    proposed_at?: string;
    reason?: string;
    questions_used?: Array<Record<string, unknown>>;
}

export interface ProcessReschedulePayload {
    new_scheduled_at: string;
    notify_interviewer?: boolean;
    custom_message?: string;
}

export interface InterviewRound {
    id: string;
    job_id: string;
    round_number: number;
    round_name?: string;
    description?: string;
    is_final_round: boolean;
    schedules: InterviewSchedule[];
    created_at: string;
    updated_at: string;
}

export interface PipelineResponse {
    job_id: string;
    job_title: string;
    rounds: InterviewRound[];
    interviewers: InterviewerInfo[];
}

export interface InterviewRoundCreate {
    round_number: number;
    round_name?: string;
    description?: string;
    is_final_round?: boolean;
}

export interface InterviewAssignCreate {
    interview_round_id: string;
    candidate_id: string;
    interviewer_id: string;
    scheduled_at?: string;
}

// Question Bank types - updated to support Q&A format and enhanced features
export interface QuestionWithAnswer {
    question: string;
    suggested_answer: string;
}

export interface LeetCodeQuestion {
    title: string;
    url: string;
    difficulty: 'Easy' | 'Medium' | 'Hard';
    solution_hint: string;
    category?: string;
    skill_match?: string[];
}

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
}

export interface PreviousReview {
    round_number: number;
    technical_skills?: number;
    communication?: number;
    problem_solving?: number;
    cultural_fit?: number;
    overall_rating?: number;
    strengths?: string;
    areas_for_improvement?: string;
    notes?: string;
    recommendation?: string;
}

export interface QuestionBank {
    id: string;
    candidate_id: string;
    job_id: string;
    jd_based_questions: (string | QuestionWithAnswer)[];
    fundamental_questions: (string | QuestionWithAnswer)[];
    resume_questions: (string | QuestionWithAnswer)[];
    behavioral_questions: (string | QuestionWithAnswer)[];
    insights_based_questions?: (string | QuestionWithAnswer)[];
    follow_up_topics: string[];
    red_flag_probes: (string | QuestionWithAnswer)[];
    leetcode_questions?: LeetCodeQuestion[];
    round_number?: number;
    previous_review_context?: PreviousReview[];
    chat_history?: ChatMessage[];
    auto_generated: boolean;
    modified_by_interviewer?: boolean;
    created_at: string;
    updated_at?: string;
}

export interface QBChatResponse {
    success: boolean;
    message: string;
    question_bank: QuestionBank;
}

export interface PreviousReviewsResponse {
    reviews: PreviousReview[];
    gold_areas: string[];
    grey_areas: string[];
    total_rounds_completed: number;
    total_visible_reviews: number;
}

// Interview Review types
export interface InterviewReviewCreate {
    technical_skills?: number;
    communication?: number;
    problem_solving?: number;
    cultural_fit?: number;
    overall_rating?: number;
    strengths?: string;
    areas_for_improvement?: string;
    notes?: string;
    recommendation: 'strong_yes' | 'yes' | 'maybe' | 'no' | 'strong_no';
}

export interface InterviewReview {
    id: string;
    technical_skills?: number;
    communication?: number;
    problem_solving?: number;
    cultural_fit?: number;
    overall_rating?: number;
    strengths?: string;
    areas_for_improvement?: string;
    notes?: string;
    recommendation: string;
    created_at: string;
}

// ============== Talent Memory API Types ==============
export interface TalentSearchParams {
    query?: string;
    skills?: string[];
    dateFrom?: string;
    dateTo?: string;
    jobId?: number;
    minScore?: number;
    roundsCompleted?: number;
}

export interface TalentSearchResult {
    candidate: Candidate;
    matchScore: number;
    lastInteraction: string;
    roundsCompleted: number;
    averageScore: number;
}

// Backend raw response (flat structure)
interface TalentSearchResultRaw {
    candidate_id: string;
    name: string;
    email?: string;
    skills?: string[];
    experience_years?: string;
    current_position?: string;
    status: string;
    job_id: string;
    job_title?: string;
    applied_at: string;
    overall_score?: number;
    average_interview_rating?: number;
    rounds_completed: number;
    match_score: number;
}

export interface HistoryEvent {
    type: 'status_change' | 'interview' | 'review' | 'email' | 'note';
    timestamp: string;
    description: string;
    metadata?: any;
}

export interface CandidateHistory {
    candidate: Candidate;
    timeline: HistoryEvent[];
    interviews: InterviewSchedule[];
    reviews: InterviewReview[];
    insights: CandidateInsights | null;
}

// Phase 7 — merged candidate interview timeline
export type TimelineEventKind =
    | 'applied'
    | 'status_changed'
    | 'interview_assigned'
    | 'invite_sent'
    | 'interview_confirmed'
    | 'interview_declined'
    | 'reschedule_requested'
    | 'reschedule_processed'
    | 'interview_completed'
    | 'review_submitted'
    | 'email_sent'
    | string; // forward-compatible — unknown kinds render generically

export interface TimelineActor {
    id?: string | null;
    name?: string | null;
    role?: string | null;
}

export interface TimelineEvent {
    kind: TimelineEventKind;
    at: string;
    actor?: TimelineActor | null;
    title: string;
    body?: string | null;
    meta: Record<string, any>;
}

export interface CandidateTimeline {
    candidate_id: string;
    candidate_name: string;
    job_title?: string | null;
    events: TimelineEvent[];
}

// Talent Memory list (Phase 7.5)
export type TalentMemoryRole = 'interviewed' | 'assigned' | 'none';

export interface TalentMemoryCandidateSummary {
    candidate_id: string;
    name: string;
    email?: string | null;
    skills?: string[] | null;
    experience_years?: string | null;
    current_position?: string | null;
    job_id: string;
    job_title?: string | null;
    status: string;
    applied_at: string;
    rounds_total: number;
    rounds_completed: number;
    my_role: TalentMemoryRole;
    my_review_id?: string | null;
    latest_event_kind?: string | null;
    latest_event_at?: string | null;
}

export interface TalentMemoryListResponse {
    candidates: TalentMemoryCandidateSummary[];
    total: number;
    scope: 'mine' | 'all';
}

// Phase 7.8 — questions actually asked in a specific interview
export interface InterviewQuestionItem {
    question: string;
    suggested_answer?: string;
}

export interface InterviewQuestionsSnapshot {
    id: string;
    schedule_id: string;
    interviewer_id: string;
    interviewer_name?: string | null;
    candidate_id: string;
    candidate_name?: string | null;
    job_title?: string | null;
    round_label?: string | null;
    jd_based_questions: InterviewQuestionItem[];
    fundamental_questions: InterviewQuestionItem[];
    resume_questions: InterviewQuestionItem[];
    behavioral_questions: InterviewQuestionItem[];
    insights_based_questions: InterviewQuestionItem[];
    red_flag_probes: InterviewQuestionItem[];
    leetcode_questions: any[];
    follow_up_topics: any[];
    modified_by_interviewer: boolean;
    chat_history: any[];
    created_at: string;
}

export interface ReengagementCandidate {
    candidate: Candidate;
    originalJob: Job;
    rejectionDate: string;
    reason: string;
    status: 'identified' | 'contacted' | 'responded';
    suggestedJobs?: Job[];
}

export interface CloseRejectedCandidate {
    candidate_id: string;
    name: string;
    email?: string;
    original_job_title: string;
    skills?: string[];
    average_rating: number;
    highest_rating: number;
    recommendation_counts: Record<string, number>;
    rounds_completed: number;
    rejection_reason?: string;
    already_marked_for_reengagement: boolean;
}

export interface CandidateRankingStats {
    job_id: string;
    job_title?: string;
    total_candidates: number;
    candidates_with_scores: number;
    score_distribution: Record<string, number>;  // {"90-100": 2, "80-89": 5, ...}
    average_score?: number;
    top_candidate_score?: number;
    top_candidate_name?: string;
    candidates_above_80: number;  // Strong candidates
    candidates_above_70: number;  // Good candidates
    candidates_above_60: number;  // Average candidates
}

export interface PreviousRoundContext {
    goldAreas: string[];
    greyAreas: string[];
    previousRound: number;
    reviewer: string;
    overallRating: number;
    suggestedFocusAreas: string[];
}

// ============== Auth API ==============
export interface RolesResponse {
    roles: string[];
    current_role: string;
}

export interface SwitchRoleResponse {
    token: string;
    role: string;
    user: User;
}

// ============== Communications API ==============

// Types
export interface EmailTemplate {
    id: number;
    name: string;
    subject: string;
    body_html: string;
    body_text: string;
    variables: string[];
    trigger_type?: 'manual' | 'status_change' | 'scheduled' | 'interview_scheduled';
    trigger_condition?: Record<string, any>;
    is_active: boolean;
    created_at: string;
}

export interface EmailTemplateCreate {
    name: string;
    subject: string;
    body_html: string;
    body_text: string;
    trigger_type?: string;
    trigger_condition?: Record<string, any>;
    is_active?: boolean;
}

export interface EmailTemplateUpdate {
    name?: string;
    subject?: string;
    body_html?: string;
    body_text?: string;
    trigger_type?: string;
    trigger_condition?: Record<string, any>;
    is_active?: boolean;
}

export interface TemplatePreview {
    subject: string;
    body_html: string;
    body_text: string;
}

export interface CommunicationLog {
    id: number;
    candidate_id: number;
    candidate_name?: string;
    template_id?: number;
    template_name?: string;
    recipient_email: string;
    subject: string;
    body: string;
    sent_at: string;
    status: 'sent' | 'delivered' | 'opened' | 'clicked' | 'failed';
}

export interface ScheduledEmail {
    id: number;
    candidate_id: number;
    candidate_name?: string;
    candidate_email?: string;
    template_id: number;
    template_name?: string;
    scheduled_for: string;
    status: 'pending' | 'sent' | 'cancelled';
    created_at?: string;
}

export interface SendEmailRequest {
    candidate_id: number;
    template_id?: number;
    subject?: string;
    body_html?: string;
    body_text?: string;
}

export interface ScheduleEmailRequest {
    candidate_id: number;
    template_id: number;
    scheduled_for: string;
}

export interface AutomationTrigger {
    id: number;
    name: string;
    trigger_type: 'status_change' | 'date_based' | 'interview_scheduled';
    trigger_condition: Record<string, any>;
    template_id: number;
    template_name?: string;
    delay_minutes: number;
    is_enabled: boolean;
    created_at: string;
}

export interface AutomationTriggerCreate {
    name: string;
    trigger_type: 'status_change' | 'date_based' | 'interview_scheduled';
    trigger_condition: Record<string, any>;
    template_id: number;
    delay_minutes?: number;
    is_enabled?: boolean;
}

export const getMyRoles = async (): Promise<RolesResponse> => {
    const response = await apiClient.get('auth/my-roles');
    return response.data;
};

export const switchRole = async (role: string): Promise<SwitchRoleResponse> => {
    const response = await apiClient.post('auth/switch-role', { role });
    return response.data;
};

// ============== API Functions ==============
export const api = {
    // Jobs
    listJobs: async (status?: string): Promise<{ jobs: Job[]; total: number }> => {
        const params = status ? { status } : {};
        const response = await apiClient.get('jobs', { params });
        return response.data;
    },

    getJob: async (jobId: string): Promise<Job> => {
        const response = await apiClient.get(`jobs/${jobId}`);
        return response.data;
    },

    createJob: async (job: JobCreate): Promise<Job> => {
        const response = await apiClient.post('jobs', job);
        return response.data;
    },

    updateJob: async (jobId: string, job: Partial<JobCreate>): Promise<Job> => {
        const response = await apiClient.put(`jobs/${jobId}`, job);
        return response.data;
    },

    deleteJob: async (jobId: string): Promise<void> => {
        await apiClient.delete(`jobs/${jobId}`);
    },

    // Candidates
    listCandidates: async (jobId?: string, status?: string): Promise<{ candidates: Candidate[]; total: number }> => {
        const params: Record<string, string> = {};
        if (jobId) params.job_id = jobId;
        if (status) params.status = status;
        const response = await apiClient.get('candidates', { params });
        return response.data;
    },

    getCandidate: async (candidateId: string): Promise<Candidate> => {
        const response = await apiClient.get(`candidates/${candidateId}`);
        return response.data;
    },

    createCandidate: async (formData: FormData): Promise<Candidate> => {
        const response = await apiClient.post('candidates', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return response.data;
    },

    updateCandidate: async (candidateId: string, data: Partial<Candidate>): Promise<Candidate> => {
        const response = await apiClient.put(`candidates/${candidateId}`, data);
        return response.data;
    },

    updateCandidateStatus: async (candidateId: string, status: string): Promise<Candidate> => {
        const response = await apiClient.put(`candidates/${candidateId}/status?status=${status}`);
        return response.data;
    },

    deleteCandidate: async (candidateId: string): Promise<void> => {
        await apiClient.delete(`candidates/${candidateId}`);
    },

    assignCandidate: async (candidateId: string, interviewerId: string, roundNumber?: string): Promise<any> => {
        const response = await apiClient.post(`candidates/${candidateId}/assign`, {
            candidate_id: candidateId,
            interviewer_id: interviewerId,
            round_number: roundNumber,
        });
        return response.data;
    },

    // Direct resume CDN upload (UploadThing). Returns public file URL.
    uploadResume: async (file: File): Promise<{ url: string; key?: string }> => {
        const formData = new FormData();
        formData.append('file', file);
        const response = await apiClient.post('uploads/resume', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return response.data;
    },

    // Resume extraction using AI
    extractResumeDetails: async (resumeText: string): Promise<ResumeExtractResponse> => {
        const response = await apiClient.post('candidates/extract', { resume_text: resumeText });
        return response.data;
    },

    // Resume extraction using OCR only (no LLM)
    extractResumeOCR: async (resumeText: string): Promise<ResumeExtractResponse> => {
        const response = await apiClient.post('candidates/extract-ocr', { resume_text: resumeText });
        return response.data;
    },

    // Get resume PDF URL
    getResumeUrl: (candidateId: string): string => {
        return `${API_BASE_URL}/api/v1/candidates/${candidateId}/resume`;
    },

    // Insights
    generateInsights: async (candidateId: string): Promise<CandidateInsights> => {
        const response = await apiClient.post(`candidates/${candidateId}/insights`);
        return response.data;
    },

    getInsights: async (candidateId: string): Promise<CandidateInsights> => {
        const response = await apiClient.get(`candidates/${candidateId}/insights`);
        return response.data;
    },

    // Interviewer-specific
    getMyAssignedCandidates: async (): Promise<{ candidates: Candidate[]; total: number }> => {
        const response = await apiClient.get('interviewer/candidates');
        return response.data;
    },

    getAssignedCandidateDetail: async (candidateId: string): Promise<Candidate> => {
        const response = await apiClient.get(`interviewer/candidates/${candidateId}`);
        return response.data;
    },

    listInterviewers: async (): Promise<User[]> => {
        const response = await apiClient.get('interviewer/users');
        return response.data;
    },

    // Interview Pipeline
    getJobPipeline: async (jobId: string): Promise<PipelineResponse> => {
        const response = await apiClient.get(`jobs/${jobId}/pipeline`);
        return response.data;
    },

    createInterviewRound: async (jobId: string, round: InterviewRoundCreate): Promise<InterviewRound> => {
        const response = await apiClient.post(`jobs/${jobId}/rounds`, round);
        return response.data;
    },

    updateInterviewRound: async (jobId: string, roundId: string, round: Partial<InterviewRoundCreate>): Promise<InterviewRound> => {
        const response = await apiClient.put(`jobs/${jobId}/rounds/${roundId}`, round);
        return response.data;
    },

    deleteInterviewRound: async (jobId: string, roundId: string): Promise<void> => {
        await apiClient.delete(`jobs/${jobId}/rounds/${roundId}`);
    },

    markRoundAsFinal: async (jobId: string, roundId: string, isFinal: boolean): Promise<InterviewRound> => {
        const response = await apiClient.patch(`jobs/${jobId}/rounds/${roundId}/mark-final?is_final=${isFinal}`);
        return response.data.round;
    },

    assignInterviewer: async (assignment: InterviewAssignCreate): Promise<InterviewSchedule> => {
        const response = await apiClient.post('interviews/assign', assignment);
        return response.data;
    },

    removeInterviewAssignment: async (scheduleId: string): Promise<void> => {
        await apiClient.delete(`interviews/${scheduleId}`);
    },

    sendInterviewInvite: async (
        scheduleId: string, 
        customMessage?: string, 
        scheduledAt?: string
    ): Promise<{ message: string; sent_to: string }> => {
        const response = await apiClient.post(`interviews/${scheduleId}/send-invite`, {
            custom_message: customMessage,
            scheduled_at: scheduledAt
        });
        return response.data;
    },

    getInterviewerSchedule: async (statusFilter?: InterviewStatus): Promise<InterviewSchedule[]> => {
        const params = statusFilter ? { status_filter: statusFilter } : {};
        const response = await apiClient.get('interviewer/schedule', { params });
        return response.data;
    },

    // Interviewer-specific endpoints for enhanced dashboard
    getInterviewerCandidateInsights: async (candidateId: string): Promise<CandidateInsights> => {
        const response = await apiClient.get(`interviewer/candidates/${candidateId}/insights`);
        return response.data;
    },

    regenerateInterviewerCandidateInsights: async (candidateId: string): Promise<CandidateInsights> => {
        const response = await apiClient.post(`interviewer/candidates/${candidateId}/insights/regenerate`);
        return response.data;
    },

    // Get resume PDF as blob with authentication
    getInterviewerCandidateResumeBlob: async (candidateId: string): Promise<Blob> => {
        const response = await apiClient.get(
            `interviewer/candidates/${candidateId}/resume`,
            { responseType: 'blob' }
        );
        return response.data;
    },

    // Get resume URL (for backward compatibility - requires auth header)
    getInterviewerCandidateResumeUrl: (candidateId: string): string => {
        return `${API_BASE_URL}/api/v1/interviewer/candidates/${candidateId}/resume`;
    },

    generateQuestionBank: async (
        candidateId: string, 
        focusAreas?: string[],
        roundNumber?: number
    ): Promise<QuestionBank> => {
        const params: Record<string, any> = {};
        if (focusAreas) params.focus_areas = focusAreas;
        if (roundNumber) params.round_number = roundNumber;
        const response = await apiClient.post(
            `interviewer/candidates/${candidateId}/question-bank`,
            null,
            { params }
        );
        return response.data;
    },

    getQuestionBank: async (candidateId: string): Promise<QuestionBank> => {
        const response = await apiClient.get(`interviewer/candidates/${candidateId}/question-bank`);
        return response.data;
    },

    // Chat-based QB modification
    chatModifyQuestionBank: async (
        candidateId: string,
        message: string
    ): Promise<QBChatResponse> => {
        const response = await apiClient.post(
            `interviewer/candidates/${candidateId}/question-bank/chat`,
            { message }
        );
        return response.data;
    },

    // Add single question
    addQuestion: async (
        candidateId: string,
        category: string,
        question: string,
        suggestedAnswer: string
    ): Promise<{ success: boolean; message: string; questions: QuestionWithAnswer[] }> => {
        const response = await apiClient.post(
            `interviewer/candidates/${candidateId}/question-bank/add`,
            { category, question, suggested_answer: suggestedAnswer }
        );
        return response.data;
    },

    // Update single question
    updateQuestion: async (
        candidateId: string,
        category: string,
        index: number,
        question: string,
        suggestedAnswer: string
    ): Promise<{ success: boolean; message: string; questions: QuestionWithAnswer[] }> => {
        const response = await apiClient.put(
            `interviewer/candidates/${candidateId}/question-bank/update`,
            { category, index, question, suggested_answer: suggestedAnswer }
        );
        return response.data;
    },

    // Delete single question
    deleteQuestion: async (
        candidateId: string,
        category: string,
        index: number
    ): Promise<{ success: boolean; message: string }> => {
        const response = await apiClient.delete(
            `interviewer/candidates/${candidateId}/question-bank/delete`,
            { params: { category, index } }
        );
        return response.data;
    },

    // Get previous reviews for a candidate
    getPreviousReviews: async (candidateId: string): Promise<PreviousReviewsResponse> => {
        const response = await apiClient.get(`interviewer/candidates/${candidateId}/previous-reviews`);
        return response.data;
    },

    respondToInterview: async (
        scheduleId: string,
        action: 'accept' | 'reject'
    ): Promise<{ message: string; status: string; confirmed_at: string }> => {
        const response = await apiClient.post(
            `interviewer/schedule/${scheduleId}/respond?action=${action}`
        );
        return response.data;
    },

    requestReschedule: async (
        scheduleId: string,
        payload: RescheduleRequestPayload
    ): Promise<{ message: string; status: string; proposed_at?: string; reschedule_count: number }> => {
        const response = await apiClient.post(
            `interviewer/schedule/${scheduleId}/reschedule`,
            payload
        );
        return response.data;
    },

    processReschedule: async (
        scheduleId: string,
        payload: ProcessReschedulePayload
    ): Promise<InterviewSchedule> => {
        const response = await apiClient.post(
            `interviews/${scheduleId}/process-reschedule`,
            payload
        );
        return response.data;
    },

    // Submit interview review and mark as completed
    submitInterviewReview: async (
        scheduleId: string,
        review: InterviewReviewCreate
    ): Promise<{ message: string; review_id: string; recommendation: string; schedule_status: string }> => {
        const response = await apiClient.post(
            `interviewer/schedule/${scheduleId}/complete`,
            review
        );
        return response.data;
    },

    // Get interview review
    getInterviewReview: async (scheduleId: string): Promise<{ has_review: boolean; review?: InterviewReview }> => {
        const response = await apiClient.get(`interviewer/schedule/${scheduleId}/review`);
        return response.data;
    },

    // ============== Talent Memory API ==============
    
    // Search for talent in the database
    searchTalent: async (params: TalentSearchParams): Promise<TalentSearchResult[]> => {
        const response = await apiClient.post('talent/search', {
            name: params.query,
            skills: params.skills,
            date_from: params.dateFrom,
            date_to: params.dateTo,
            job_id: params.jobId?.toString(),
            min_overall_score: params.minScore,
            rounds_completed: params.roundsCompleted,
        });

        // Backend returns TalentSearchResponse with results array (flat structure)
        const backendResults: TalentSearchResultRaw[] = response.data.results || [];

        // Transform to frontend format (nested candidate object)
        return backendResults.map(r => ({
            candidate: {
                id: r.candidate_id,
                name: r.name,
                email: r.email,
                skills: r.skills,
                experience_years: r.experience_years,
                current_position: r.current_position,
                status: r.status as any,
                job_id: r.job_id,
                job_title: r.job_title,
                applied_at: r.applied_at,
                has_insights: r.overall_score != null,
            } as Candidate,
            matchScore: r.match_score,
            lastInteraction: r.applied_at, // Use applied_at as fallback
            roundsCompleted: r.rounds_completed,
            averageScore: r.average_interview_rating || r.overall_score || 0,
        }));
    },

    // Get full candidate history
    getCandidateHistory: async (candidateId: string): Promise<CandidateHistory> => {
        const response = await apiClient.get(`talent/candidate/${candidateId}/history`);
        return response.data;
    },

    // Get the chronologically-merged candidate interview timeline (Phase 7).
    // Auth: any authenticated user — talent memory is shared.
    getInterviewTimeline: async (candidateId: string): Promise<CandidateTimeline> => {
        const response = await apiClient.get(`candidates/${candidateId}/interview-timeline`);
        return response.data;
    },

    // Interviewer-side Talent Memory list (Phase 7.5)
    getInterviewerMemoryCandidates: async (params: {
        scope?: 'mine' | 'all';
        status?: string;
        job_id?: string;
        q?: string;
        limit?: number;
    } = {}): Promise<TalentMemoryListResponse> => {
        const response = await apiClient.get('interviewer/memory/candidates', { params });
        return response.data;
    },

    // Phase 7.8 — questions actually asked in a specific completed interview
    getInterviewQuestionsAsked: async (scheduleId: string): Promise<InterviewQuestionsSnapshot> => {
        const response = await apiClient.get(`interviews/${scheduleId}/questions-asked`);
        return response.data;
    },

    // Get candidates eligible for re-engagement
    getReengagementCandidates: async (): Promise<ReengagementCandidate[]> => {
        const response = await apiClient.get('talent/reengagement-candidates');
        return response.data;
    },

    // Get all rejected candidates with good ratings (for re-engagement)
    getCloseRejectedCandidates: async (minAvgRating: number = 3.5, minHighestRating: number = 4): Promise<CloseRejectedCandidate[]> => {
        const response = await apiClient.get('talent/close-rejected-candidates', {
            params: { min_avg_rating: minAvgRating, min_highest_rating: minHighestRating }
        });
        return response.data;
    },

    // Mark a candidate for re-engagement
    markForReengagement: async (candidateId: string, newJobId?: string): Promise<void> => {
        await apiClient.post(`talent/reengagement/${candidateId}`, { new_job_id: newJobId, reason: "Good candidate for re-engagement" });
    },

    // Get previous review context for interviewers (enhanced version)
    getPreviousRoundContext: async (candidateId: string): Promise<PreviousRoundContext> => {
        const response = await apiClient.get(`interviewer/candidates/${candidateId}/previous-round-context`);
        return response.data;
    },

    // ============== Communications API Methods ==============
  
    // Email Templates
    getEmailTemplates: async (): Promise<EmailTemplate[]> => {
        const response = await apiClient.get('communications/templates');
        return response.data;
    },

    createEmailTemplate: async (template: EmailTemplateCreate): Promise<EmailTemplate> => {
        const response = await apiClient.post('communications/templates', template);
        return response.data;
    },

    updateEmailTemplate: async (id: number, template: EmailTemplateUpdate): Promise<EmailTemplate> => {
        const response = await apiClient.put(`communications/templates/${id}`, template);
        return response.data;
    },

    deleteEmailTemplate: async (id: number): Promise<void> => {
        await apiClient.delete(`communications/templates/${id}`);
    },

    previewTemplate: async (id: number, sampleData?: Record<string, any>): Promise<TemplatePreview> => {
        const response = await apiClient.get(`communications/templates/${id}/preview`, { params: sampleData });
        return response.data;
    },

    // Communication History
    getCandidateCommunications: async (candidateId: number): Promise<CommunicationLog[]> => {
        const response = await apiClient.get(`communications/candidate/${candidateId}/history`);
        return response.data;
    },

    getAllCommunications: async (): Promise<CommunicationLog[]> => {
        const response = await apiClient.get('communications/history');
        return response.data;
    },

    // Send & Schedule Emails
    sendEmail: async (data: SendEmailRequest): Promise<void> => {
        await apiClient.post('communications/send', data);
    },

    // Send custom email (simple version for re-engagement)
    sendCustomEmail: async (data: { to_email: string; to_name: string; subject: string; body: string }): Promise<void> => {
        await apiClient.post('communications/send', {
            ...data,
            email_type: 'reengagement',
        });
    },

    // AI improve email content
    improveEmailContent: async (content: string, instruction?: string): Promise<{ improved_content: string }> => {
        const response = await apiClient.post('communications/ai-improve', {
            content,
            instruction: instruction || 'Make this more professional and engaging',
        });
        return response.data;
    },

    scheduleEmail: async (data: ScheduleEmailRequest): Promise<ScheduledEmail> => {
        const response = await apiClient.post('communications/schedule', data);
        return response.data;
    },

    getScheduledEmails: async (): Promise<ScheduledEmail[]> => {
        const response = await apiClient.get('communications/scheduled');
        return response.data;
    },

    cancelScheduledEmail: async (id: number): Promise<void> => {
        await apiClient.delete(`communications/scheduled/${id}`);
    },

    sendScheduledEmailNow: async (id: number): Promise<void> => {
        await apiClient.post(`communications/scheduled/${id}/send-now`);
    },

    // Automation Triggers
    getAutomationTriggers: async (): Promise<AutomationTrigger[]> => {
        const response = await apiClient.get('communications/automations');
        return response.data;
    },

    createAutomationTrigger: async (trigger: AutomationTriggerCreate): Promise<AutomationTrigger> => {
        const response = await apiClient.post('communications/automations', trigger);
        return response.data;
    },

    updateAutomationTrigger: async (id: number, trigger: Partial<AutomationTriggerCreate>): Promise<AutomationTrigger> => {
        const response = await apiClient.put(`communications/automations/${id}`, trigger);
        return response.data;
    },

    deleteAutomationTrigger: async (id: number): Promise<void> => {
        await apiClient.delete(`communications/automations/${id}`);
    },

    toggleAutomationTrigger: async (id: number, enabled: boolean): Promise<AutomationTrigger> => {
        const response = await apiClient.patch(`communications/automations/${id}/toggle`, { is_enabled: enabled });
        return response.data;
    },

    // ============== Candidate Actions (Accept/Reject/Hire) ==============

    acceptCandidate: async (candidateId: string): Promise<{ message: string; status: string }> => {
        const response = await apiClient.post(`candidates/${candidateId}/accept`);
        return response.data;
    },

    hireCandidate: async (candidateId: string): Promise<{ message: string; status: string }> => {
        const response = await apiClient.post(`candidates/${candidateId}/hire`);
        return response.data;
    },

    rejectCandidate: async (candidateId: string, reason?: string): Promise<{ message: string; status: string }> => {
        const response = await apiClient.post(`candidates/${candidateId}/reject`, { reason });
        return response.data;
    },

    // ============== Offer Letter API ==============

    sendOfferLetterOld: async (
        candidateId: string,
        data: {
            subject: string;
            body_html: string;
            body_text?: string;
            attachment_base64?: string;
            attachment_filename?: string;
        }
    ): Promise<{ message: string; communication_log_id: string }> => {
        const response = await apiClient.post(`candidates/${candidateId}/offer-letter`, data);
        return response.data;
    },

    // ============== AI Chat for Content ==============

    chatImproveContent: async (
        content: string,
        instruction: string
    ): Promise<{ improved_content: string }> => {
        const response = await apiClient.post('communications/ai-improve', { content, instruction });
        return response.data;
    },

    // ============== HR Communications API ==============

    // Hired candidates
    getHiredCandidates: async (): Promise<any[]> => {
        const response = await apiClient.get('hr-comms/hired-candidates');
        return response.data;
    },

    getRejectedCandidates: async (): Promise<any[]> => {
        const response = await apiClient.get('hr-comms/rejected-candidates');
        return response.data;
    },

    // Offer letters
    createOfferLetter: async (formData: FormData): Promise<any> => {
        const response = await apiClient.post('hr-comms/offer-letter/create', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return response.data;
    },

    getCandidateOfferLetter: async (candidateId: string): Promise<any> => {
        const response = await apiClient.get(`hr-comms/offer-letter/candidate/${candidateId}`);
        return response.data;
    },

    sendOfferLetter: async (offerLetterId: string): Promise<any> => {
        const response = await apiClient.post(`hr-comms/offer-letter/${offerLetterId}/send`);
        return response.data;
    },

    downloadOfferLetterPDF: async (offerLetterId: string): Promise<Blob> => {
        const response = await apiClient.get(`hr-comms/offer-letter/${offerLetterId}/download`, {
            responseType: 'blob',
        });
        return response.data;
    },

    // Notice period tracking
    createNoticePeriod: async (data: {
        candidate_id: string;
        notice_period_end_date: string;
        last_working_day_current_company?: string;
        notice_period_days?: number;
        follow_up_frequency_days?: number;
        notes?: string;
    }): Promise<any> => {
        const response = await apiClient.post('hr-comms/notice-period/create', data);
        return response.data;
    },

    getNoticePeriod: async (candidateId: string): Promise<any> => {
        const response = await apiClient.get(`hr-comms/notice-period/candidate/${candidateId}`);
        return response.data;
    },

    sendFollowUpEmail: async (followUpId: string, formData: FormData): Promise<any> => {
        const response = await apiClient.post(`hr-comms/follow-up/${followUpId}/send`, formData);
        return response.data;
    },

    // Candidate status updates
    markCandidateOnboarded: async (candidateId: string): Promise<any> => {
        const response = await apiClient.post(`hr-comms/candidate/${candidateId}/mark-onboarded`);
        return response.data;
    },

    markOfferRejected: async (candidateId: string, formData: FormData): Promise<any> => {
        const response = await apiClient.post(`hr-comms/candidate/${candidateId}/mark-offer-rejected`, formData);
        return response.data;
    },

    // Rejection emails
    sendRejectionEmail: async (formData: FormData): Promise<any> => {
        const response = await apiClient.post('hr-comms/send-rejection-email', formData);
        return response.data;
    },

    // ============== Candidate Ranking API ==============
    getRankedCandidates: async (params: {
        jobId?: string;
        status?: string;
        minScore?: number;
        skip?: number;
        limit?: number;
    }): Promise<{ candidates: Candidate[]; total: number }> => {
        const response = await apiClient.get('candidates/ranked', { params });
        return response.data;
    },

    getRankingStats: async (jobId: string): Promise<CandidateRankingStats> => {
        const response = await apiClient.get(`candidates/ranking-stats/${jobId}`);
        return response.data;
    },
};
