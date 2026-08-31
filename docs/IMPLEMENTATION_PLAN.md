# Implementation Plan - Hiring Co-Pilot Platform

**Last Updated:** 2026-04-30
**Current Phase:** Phase 5 (Deployment) — ✅ shipped as `v0.1.0`
**Status:** Production live. Frontend on Vercel, backend on Azure Container Apps, DB on Neon, resume CDN on UploadThing.

---

## 🟢 Production status (2026-04-30)

| | |
|---|---|
| Live frontend | https://hiring-capstone.vercel.app |
| Live backend | https://hiring-backend.happymushroom-06d2d3fe.centralindia.azurecontainerapps.io |
| Git tag | `v0.1.0` (commit `00bd5aa`) |
| Image | `hiringcapstone29986.azurecr.io/hiring-backend:00bd5aa` |
| CI/CD | GitHub Actions (`.github/workflows/backend-deploy.yml`) — alembic → build → push → ACA update |

All Phase 1–5 work is on `main`. See [`DEPLOYMENT.md`](DEPLOYMENT.md) for runbook,
[`MIGRATIONS.md`](MIGRATIONS.md) for schema-change strategy.

### Phase summary

| Phase | Status | Outcome |
|---|---|---|
| 1 — Production-readiness fixes | ✅ | Boolean / Integer column type fixes, timezone-aware datetimes, JWT hardening, dead Clerk removed, frontend build green |
| 2 — Alembic + Neon migration | ✅ | All 14 tables on Neon, `initial_schema_from_models` is the baseline migration |
| 3 — UploadThing resume storage | ✅ | Backend proxies uploads via UT v7 REST API; resumes live at `https://utfs.io/f/<key>`; OCR works on URL-hosted PDFs |
| 4 — Local integration test | ✅ | 31/31 pytests pass; Playwright HR-flow drove login → job creation → PDF upload → OCR auto-fill end-to-end |
| 5 — Cloud deployment | ✅ | Azure Container Apps + Vercel + Neon + UploadThing fully wired; CI/CD operational; cost ~$20–30/mo on student credits |
| 5b — CI migrations & cleanup | ✅ | Migrations promoted from container CMD to a dedicated CI step; legacy migrate scripts moved into `backend/scripts/legacy/`; root reorganised; docs split into `docs/` |
| 6 — Interview scheduling solidification | ⏳ pending | Reschedule flow, Google Calendar links, interviewer pipeline view |
| 7 — Candidate timeline UI | ⏳ pending | `GET /candidates/{id}/interview-timeline` + vertical timeline render |
| 8 — Baton-passing validation | ⏳ pending | End-to-end check of Round 1 → Round 2 QB context flow |
| 9 — Playwright E2E coverage | ⏳ pending | Full coverage matrix against production URLs |

---

## 🎯 Context for New Sessions

### What This Platform Does
A hiring automation platform that reduces hiring time by solving real pain points:
- Resume screening paralysis → Smart ranking & prioritization
- Interview scheduling hell → Visual pipeline, self-service availability
- QB generation friction → Auto-generated question banks from resumes
- Vague reviews → Structured feedback system
- Lost context between rounds → Baton passing between interviewers
- Talent memory black hole → Searchable candidate database

**Read PHILOSOPHY.md for full context** - it contains the north star principles and all pain points.

---

## 📋 Current State of Codebase

### Frontend (React + TypeScript + Vite)
**Location:** `/Users/siyer/hiring_capstone/frontend`
**Status:** ✅ Fully implemented with deep insights UI

**Current Structure:**
```
frontend/src/
├── pages/
│   ├── HRDashboard.tsx          # HR main view (✅ Enhanced with insights)
│   ├── InterviewerDashboard.tsx # ✅ Enhanced: Accept/reject, insights, QB
│   ├── LoginPage.tsx            # Authentication
│   └── RoleSelection.tsx        # Role picker
├── components/
│   ├── CandidateCard.tsx        # ✅ Enhanced with insights button
│   ├── UploadResumeModal.tsx    # ✅ Auto-OCR extraction on upload
│   ├── InsightsModal.tsx        # Deep insights visualization
│   ├── InterviewerSidebar.tsx   # Draggable interviewers list
│   ├── InterviewRoundCard.tsx   # Round card with drop zone
│   ├── InterviewPipelineCanvas.tsx # ✅ Pipeline canvas + scheduling modal
│   └── ScheduleInviteModal.tsx  # ✨ NEW: Date/time picker for invites
├── contexts/
│   └── AuthContext.tsx          # Auth provider & hook
├── hooks/
│   └── useClerkAuth.ts          # Clerk integration (unused)
├── apiService.ts                # ✅ API client (insights, pipeline, QB)
├── index.css                    # Global styles + custom utilities
├── App.tsx                      # Main app component
└── main.tsx                     # Entry point
```

**Tech Stack:**
- React 18+ with TypeScript
- Vite (build tool)
- TailwindCSS 4.2.1 (styling)
- Axios 1.13.6 (API calls)
- Lucide React 0.577.0 (icons)
- ESLint (linting)

**Key Features Implemented:**
- ✅ Enhanced candidate card grid with detailed information
- ✅ Experience badge highlighting (orange accent)
- ✅ Education and current position display
- ✅ Drag & drop resume upload
- ✅ Immediate AI extraction on file drop
- ✅ 3-step upload wizard (job → upload → review)
- ✅ **NEW:** Insights button on candidate cards
- ✅ **NEW:** Deep insights modal with startup mindset analysis
- ✅ **NEW:** Quantifiable scores for ranking (0-100)

**Commands:**
```bash
cd /Users/siyer/hiring_capstone/frontend
npm install        # Install dependencies
npm run dev        # Start dev server (http://localhost:5173)
npm run build      # Production build
```

### Backend (Python + FastAPI)
**Location:** `/Users/siyer/hiring_capstone/backend`
**Status:** ✅ Fully implemented with interview scheduling enhancements

**Current Structure:**
```
backend/
├── main.py                      # ✅ FastAPI app entry point
├── config.py                    # ✅ Configuration (+ SMTP, URLs)
├── database.py                  # ✅ Database connection & session
├── models.py                    # ✅ SQLAlchemy models (+ QuestionBank)
├── schemas.py                   # ✅ Pydantic schemas (+ scheduled_at, QB)
├── migrate_candidates.py        # Database migration script
├── migrate_insights.py          # Insights table migration
├── migrate_interviews.py        # Interview pipeline migration
├── migrate_question_banks.py    # ✨ NEW: Question banks migration
├── routers/
│   ├── auth.py                  # ✅ Authentication endpoints
│   ├── jobs.py                  # ✅ Job CRUD endpoints
│   ├── candidates.py            # ✅ Candidate endpoints (+ insights)
│   ├── interviewers.py          # ✅ Enhanced: insights, resume, QB, respond
│   ├── interviews.py            # ✅ Pipeline endpoints (+ scheduling)
│   └── health.py                # ✅ Health check
├── services/
│   ├── auth_service.py          # ✅ Auth logic
│   ├── resume_parser.py         # ✅ Enhanced OCR extraction
│   ├── llm_extractor.py         # ✅ AI extraction
│   ├── insights_generator.py    # ✅ Deep insights with LLM
│   ├── email_service.py         # ✅ Email with ICS attachments
│   └── qb_generator.py          # ✨ NEW: Question bank generator
├── tests/                       # ✅ 30/31 tests passing
├── uploads/                     # Resume file storage
├── hiring_copilot.db           # ✅ SQLite database
├── requirements.txt             # Python dependencies
└── venv/                        # Virtual environment
```

**Tech Stack:**
- FastAPI (web framework)
- SQLAlchemy (ORM)
- SQLite for dev (PostgreSQL ready for prod)
- PyPDF2 / pdfplumber (resume parsing)
- OpenRouter API with Claude Haiku (AI extraction & insights)
- python-dotenv (environment variable loading)
- Pydantic (validation)
- pytest (testing - 30/31 passing)
- Uvicorn (ASGI server)

**Database Schema:**
- ✅ Users (HR Admin & Interviewer roles)
- ✅ Jobs (with requirements)
- ✅ Candidates (with enhanced fields: experience_years, current_position, education)
- ✅ CandidateAssignments (interviewer assignments)
- ✅ **NEW:** CandidateInsights (quantifiable scores, mindset analysis, technical analysis)

**Key Features Implemented:**
- ✅ Resume upload with OCR
- ✅ AI extraction of name, email, phone, skills
- ✅ Experience years extraction
- ✅ Current position extraction
- ✅ Education history extraction (degree, institution, field, years)
- ✅ Job CRUD operations
- ✅ Candidate CRUD operations with enhanced data
- ✅ Authentication & authorization
- ✅ File storage management
- ✅ Enhanced OCR extraction (regex-based, no LLM for basic fields)
- ✅ Deep insights generation with LLM
- ✅ Quantifiable scores (0-100) for ranking
- ✅ Startup mindset analysis
- ✅ Technical depth assessment
- ✅ Interview areas to probe
- ✅ **NEW:** Interview scheduling with datetime selection
- ✅ **NEW:** ICS calendar attachments in emails
- ✅ **NEW:** Question bank generation
- ✅ **NEW:** Enhanced interviewer endpoints

**API Endpoints (Phase 2 - Insights):**
- `POST /api/v1/candidates/{id}/insights` - Generate deep insights
- `GET /api/v1/candidates/{id}/insights` - Retrieve existing insights
- `POST /api/v1/candidates/extract-ocr` - OCR-only extraction (no LLM)

**API Endpoints (Phase 3.1 - Interviewer Enhancements):**
- `GET /api/v1/interviewer/candidates/{id}/insights` - View candidate insights
- `POST /api/v1/interviewer/candidates/{id}/insights/regenerate` - Regenerate insights
- `GET /api/v1/interviewer/candidates/{id}/resume` - Download resume
- `GET /api/v1/interviewer/candidates/{id}/question-bank` - View question bank
- `POST /api/v1/interviewer/candidates/{id}/question-bank` - Generate question bank
- `POST /api/v1/interviewer/schedule/{id}/respond` - Accept/reject interview

**Commands:**
```bash
cd /Users/siyer/hiring_capstone/backend
source venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000
# Health check: curl http://localhost:8000/health
```

---

## 🏗️ Implementation Phases

### **Phase 1: Foundation - Database & Resume Upload** [COMPLETED ✅]

**Goal:** Create backend foundation + resume upload + basic parsing
**Status:** ✅ All features implemented and tested

#### Step 1.1: Backend Project Setup
```bash
cd /Users/siyer/hiring_capstone/backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install fastapi uvicorn sqlalchemy alembic pydantic python-multipart
pip install pypdf2 pdfplumber python-magic-bin  # Resume parsing
pip install pytest pytest-asyncio httpx  # Testing
pip install python-jose[cryptography] passlib bcrypt  # Auth
pip freeze > requirements.txt
```

#### Step 1.2: Database Schema Design
**File:** `backend/models.py`

**Tables to create:**
```python
# users table (interviewers, HR)
- id (UUID, primary key)
- email (unique, indexed)
- name
- role (enum: 'hr', 'interviewer', 'admin')
- password_hash
- created_at, updated_at

# jobs table
- id (UUID, primary key)
- title
- description (text)
- requirements (JSON: skills[], experience_years, etc.)
- status (enum: 'draft', 'active', 'closed')
- created_by (FK to users)
- created_at, updated_at

# candidates table
- id (UUID, primary key)
- name
- email
- phone
- resume_path (file path)
- resume_text (extracted text)
- job_id (FK to jobs)
- status (enum: 'applied', 'screening', 'interview_round_1', 'interview_round_2', 
          'offer', 'hired', 'rejected')
- applied_at
- created_at, updated_at

# candidate_scores table (Phase 2)
- id (UUID, primary key)
- candidate_id (FK)
- overall_score (float 0-100)
- skills_score (float)
- experience_score (float)
- parsed_data (JSON: skills[], experience[], education[], etc.)
- created_at

# interviews table (Phase 3)
- id (UUID, primary key)
- candidate_id (FK)
- interviewer_id (FK)
- job_id (FK)
- round_number (int)
- scheduled_at (datetime)
- status (enum: 'scheduled', 'completed', 'cancelled')
- meeting_link (optional)
- created_at, updated_at

# reviews table (Phase 4)
- id (UUID, primary key)
- interview_id (FK)
- interviewer_id (FK)
- candidate_id (FK)
- overall_rating (int 1-5)
- structured_ratings (JSON: {category: rating})
- feedback_text (text)
- strengths (text)
- weaknesses (text)
- recommendation (enum: 'hire', 'no_hire', 'maybe')
- created_at

# question_banks table (Phase 4)
- id (UUID, primary key)
- candidate_id (FK)
- interview_id (FK)
- questions (JSON array)
- auto_generated (boolean)
- modified_by_interviewer (boolean)
- created_at
```

#### Step 1.3: Project Structure
```
backend/
├── main.py                    # FastAPI app entry point
├── database.py                # Database connection, session
├── models.py                  # SQLAlchemy models
├── schemas.py                 # Pydantic schemas (request/response)
├── config.py                  # Environment configuration
├── requirements.txt           # Python dependencies
├── alembic/                   # Database migrations
│   ├── versions/
│   └── env.py
├── routers/                   # API endpoints
│   ├── __init__.py
│   ├── auth.py               # Authentication endpoints
│   ├── jobs.py               # Job CRUD
│   ├── candidates.py         # Candidate CRUD, upload
│   ├── users.py              # User management
│   └── health.py             # Health check
├── services/                  # Business logic
│   ├── __init__.py
│   ├── resume_parser.py      # PDF parsing logic
│   ├── scoring.py            # Scoring algorithms (Phase 2)
│   ├── qb_generator.py       # Question bank generation (Phase 4)
│   └── auth_service.py       # JWT, password hashing
├── tests/                     # Test suite
│   ├── __init__.py
│   ├── test_jobs.py
│   ├── test_candidates.py
│   └── test_resume_parser.py
├── uploads/                   # Resume storage (local dev)
│   └── resumes/
└── .env                       # Environment variables
```

#### Step 1.4: Implementation Checklist

**Database Setup:**
- [x] Create `database.py` with SQLAlchemy engine (SQLite for dev) ✅
- [x] Create `models.py` with User, Job, Candidate models ✅
- [x] Initialize Alembic: `alembic init alembic` ✅
- [x] Create first migration: `alembic revision --autogenerate -m "Initial schema"` ✅
- [x] Run migration: `alembic upgrade head` ✅
- [x] **Enhanced:** Add experience_years, current_position, education fields ✅

**API Endpoints (Phase 1):**
- [x] `POST /api/v1/auth/login` - User authentication ✅
- [x] `POST /api/v1/jobs` - Create job ✅
- [x] `GET /api/v1/jobs` - List all jobs ✅
- [x] `GET /api/v1/jobs/{id}` - Get job details ✅
- [x] `PUT /api/v1/jobs/{id}` - Update job ✅
- [x] `POST /api/v1/candidates` - Create candidate (with resume upload) ✅
- [x] `GET /api/v1/candidates?job_id={id}` - List candidates for a job ✅
- [x] `GET /api/v1/candidates/{id}` - Get candidate details + parsed resume ✅
- [x] `PUT /api/v1/candidates/{id}/status` - Update candidate status ✅
- [x] `GET /api/v1/health` - Health check ✅

**Services:**
- [x] `resume_parser.py` - Extract text from PDF, basic parsing (name, email, skills) ✅
- [x] `auth_service.py` - JWT token generation, password hashing ✅
- [x] `llm_extractor.py` - AI-powered extraction with OpenRouter/Claude ✅
- [x] **Enhanced:** Experience, position, and education extraction ✅

**Tests:**
- [x] Test job CRUD operations ✅ (30/31 passing)
- [x] Test candidate creation with file upload ✅
- [x] Test resume parsing service ✅
- [x] Test authentication flow ✅

**Frontend Integration:**
- [x] Update `apiService.ts` with backend API calls ✅
- [x] Connect HRDashboard to job/candidate endpoints ✅
- [x] Implement resume upload UI ✅
- [x] Display candidate list with basic info ✅
- [x] **Enhanced:** Rich candidate cards with detailed view ✅
- [x] **Enhanced:** 3-step upload wizard with drag & drop ✅
- [x] **Enhanced:** Immediate AI extraction on upload ✅

**Phase 1 Status: ✅ COMPLETE (100%)**

---

### **Phase 2: Resume Ranking & Deep Insights** [PAUSED ⏸️]

**Goal:** Solve "too much time screening" - prioritize candidates intelligently

**Status:** ⏸️ PAUSED - Core insights implemented, ranking UI deferred to focus on Phase 3

#### What Was Implemented:

**Backend:**
- ✅ Enhanced OCR extraction (`resume_parser.py`) - extracts name, email, phone, skills, experience, education without LLM
- ✅ Deep insights generator (`insights_generator.py`) - LLM-powered analysis with startup mindset detection
- ✅ CandidateInsights database model with quantifiable scores (0-100)
- ✅ API endpoints: `POST/GET /candidates/{id}/insights`
- ✅ Auto-fill fields on resume upload using OCR

**Frontend:**
- ✅ InsightsModal component with detailed visualization
- ✅ "Generate Insights" / "View Insights" button on candidate cards
- ✅ Score bars for each dimension (technical, experience, startup mindset, etc.)
- ✅ Startup fit badge and quick verdict display
- ✅ Areas to probe section for interview preparation

**Insights Structure (Quantifiable for Ranking):**
```json
{
  "scores": {
    "overall_score": 85,
    "technical_depth": 80,
    "experience_relevance": 90,
    "education_quality": 75,
    "startup_mindset": 85,
    "communication_signals": 70
  },
  "mindset": {
    "startup_fit": true,
    "fit_level": "high",
    "positive_signals": ["ownership language", "fast-paced experience"],
    "concerns": []
  },
  "technical": {
    "primary_skills": ["Python", "React", "AWS"],
    "skill_depth": {"Python": "expert"},
    "missing_skills": ["GraphQL"],
    "tech_trajectory": "Moving towards cloud/infrastructure"
  },
  "experience": {
    "highlights": ["Led team of 5", "Scaled system 10x"],
    "trajectory": "IC to Tech Lead path",
    "red_flags": [],
    "leadership_signals": ["Mentored 3 junior devs"]
  },
  "summary": {
    "headline": "Strong Python dev with startup DNA",
    "top_strengths": ["Technical depth", "Ownership mindset"],
    "areas_to_probe": ["Team management experience"],
    "quick_verdict": "yes"
  }
}
```

**Next: Implement ranker.py** to use these quantifiable scores for candidate ranking.

#### Previous Plan (Reference):
**File:** `frontend/src/pages/HRDashboard.tsx`

**Features:**
- Candidate list with score column (sortable)
- Color-coded scores (green >80, yellow 60-80, red <60)
- Quick filters: score range, skills, experience level
- Candidate detail view with insights visualization
- Bulk actions: select multiple → "Move to Interview"

#### Step 2.5: Implementation Checklist

**Backend:**
- [ ] Enhance resume parser with skills/experience extraction
- [ ] Implement scoring algorithm with configurable weights
- [ ] Create insights generation service
- [ ] Add API endpoint for candidate insights
- [ ] Add filtering/sorting to candidate list endpoint
- [ ] Write tests for scoring accuracy

**Frontend:**
- [ ] Add score column to candidate table
- [ ] Implement sorting by score
- [ ] Build insights detail view (charts, highlights, concerns)
- [ ] Add filter UI (score range, skills checkboxes)
- [ ] Implement bulk selection + actions

**Testing:**
- [ ] Test with 10+ real resumes
- [ ] Validate scoring accuracy vs manual review
- [ ] Test filter combinations

---

### **Phase 3: Interview Pipeline Management** [CODE COMPLETE ✅]

**Goal:** Visual drag-and-drop pipeline for managing interview rounds and interviewers

**Status:** ✅ CODE COMPLETE - Run migration to test

#### Overview:
HR can create interview rounds for each job, drag interviewers into rounds, and send email confirmations. Interviewers receive emails with Yes/No options and see their schedule on their dashboard.

#### Key Features:
1. **Pipeline Canvas (HR View)**
   - Job-specific pipeline view with round cards
   - Visual flow: Round 1 → Round 2 → ... → Hired/Rejected
   - Drag & drop interviewers from sidebar onto rounds
   - Show interviewer name + position on round cards
   - "Schedule" button to send email notifications
   - Warnings when interviewers decline

2. **Interviewer Sidebar**
   - Display all registered interviewers
   - Draggable cards with name and position
   - Visual feedback during drag

3. **Email Notifications (MVP)**
   - Send confirmation email when interviewer assigned
   - Yes/No links in email
   - Track confirmation status (pending/confirmed/declined)

4. **Interviewer Dashboard Updates**
   - See scheduled interviews
   - Confirmation status display

#### Implementation Checklist:

**Backend - Database:**
- [x] Create InterviewRound model (job_id, round_number, round_name) ✅
- [x] Create InterviewSchedule model (round_id, candidate_id, interviewer_id, status, confirmation_token) ✅
- [ ] Run database migration: `python migrate_interviews.py`

**Backend - API Endpoints:**
- [x] `GET /api/v1/jobs/{job_id}/pipeline` - Get full pipeline with rounds & assignments ✅
- [x] `POST /api/v1/jobs/{job_id}/rounds` - Create interview round ✅
- [x] `PUT /api/v1/jobs/{job_id}/rounds/{round_id}` - Update round ✅
- [x] `DELETE /api/v1/jobs/{job_id}/rounds/{round_id}` - Delete round ✅
- [x] `POST /api/v1/interviews/assign` - Assign interviewer to round for candidate ✅
- [x] `DELETE /api/v1/interviews/{id}` - Remove assignment ✅
- [x] `POST /api/v1/interviews/{id}/send-invite` - Send email notification ✅
- [x] `GET /api/v1/interviews/confirm/{token}` - Handle Yes/No confirmation ✅
- [x] `GET /api/v1/interviewer/schedule` - Get interviewer's scheduled interviews ✅

**Backend - Email Service:**
- [x] Create email service (SMTP-based) ✅ `services/email_service.py`
- [x] Interview invitation email template with Yes/No links ✅
- [x] Token generation for confirmation links ✅

**Frontend - Components:**
- [x] Install @dnd-kit/core drag-and-drop library ✅
- [x] InterviewerSidebar - list of draggable interviewers ✅
- [x] InterviewRoundCard - visual card for each round ✅
- [x] InterviewPipelineCanvas - main drag-drop canvas ✅
- [x] JobPipelineSelector - switch between job pipelines ✅

**Frontend - Integration:**
- [x] Add Pipeline tab/view to HR Dashboard ✅
- [x] Update Interviewer Dashboard with scheduled interviews ✅
- [x] Confirmation status indicators ✅

**Testing:**
- [ ] Run database migration
- [ ] Manual E2E testing of full flow

#### Files Created/Modified:

**Backend:**
- ✏️ `models.py` - Added InterviewRound, InterviewSchedule models, InterviewStatus enum
- ✏️ `schemas.py` - Added pipeline schemas (InterviewRoundCreate, PipelineResponse, etc.)
- ✏️ `config.py` - Added SMTP and URL configuration
- ✏️ `main.py` - Registered interviews router
- ✨ `routers/interviews.py` - NEW: All interview pipeline endpoints
- ✨ `services/email_service.py` - NEW: Email sending with templates
- ✨ `migrate_interviews.py` - NEW: Migration script

**Frontend:**
- ✏️ `apiService.ts` - Added pipeline API functions and types
- ✏️ `pages/HRDashboard.tsx` - Added Pipeline tab
- ✏️ `pages/InterviewerDashboard.tsx` - Added schedule view with tabs
- ✨ `components/InterviewerSidebar.tsx` - NEW: Draggable interviewers list
- ✨ `components/InterviewRoundCard.tsx` - NEW: Round card with drop zone
- ✨ `components/InterviewPipelineCanvas.tsx` - NEW: Main pipeline canvas

#### How to Run:

```bash
# 1. Run database migration
cd /Users/siyer/hiring_capstone/backend
source venv/bin/activate
python migrate_interviews.py

# 2. Start backend (if not running)
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# 3. Start frontend (if not running)
cd /Users/siyer/hiring_capstone/frontend
npm run dev
```

#### Deferred to Later:
- Google Calendar OAuth integration (auto-scheduling based on calendar availability)
- Rescheduling functionality
- Advanced availability management

---

### **Phase 3.1: Interview Scheduling Enhancements** [CODE COMPLETE ✅]

**Goal:** Improve interview scheduling with datetime selection, production-ready URLs, enhanced interviewer view, and question bank generation

**Status:** ✅ CODE COMPLETE - Run `python migrate_question_banks.py` to enable question bank features

#### Implemented Features:

##### 1. Date/Time Selection for Interview Scheduling
- HR can now select a proposed date and time when sending interview invites
- `ScheduleInviteModal` component with date picker and time picker
- Scheduled time stored in `scheduled_at` field on `InterviewSchedule` model
- Email includes formatted date/time and .ICS calendar attachment

**Files:**
- `frontend/src/components/ScheduleInviteModal.tsx` - NEW: Date/time picker modal
- `backend/schemas.py` - Added `scheduled_at` to `SendInviteRequest`
- `backend/routers/interviews.py` - Updated `send-invite` endpoint
- `frontend/src/components/InterviewPipelineCanvas.tsx` - Integrated modal

##### 2. ICS Calendar File Attachments
- Email invites now include `.ics` calendar attachment
- Recipients can add interview directly to their calendar (Outlook, Google, Apple)
- ICS includes: event title, description, start/end time, organizer, attendee
- 30-minute reminder alarm included

**Files:**
- `backend/services/email_service.py` - Added `generate_ics_content()` function

##### 3. Production-Ready Confirmation Links
- All email links use `BACKEND_URL` and `FRONTEND_URL` from environment
- When deploying to Azure/AWS/Vercel, update `.env` with production URLs
- Accept/reject links will work from any device once deployed

**Configuration for Deployment:**
```env
# For local development
BACKEND_URL=http://localhost:8000
FRONTEND_URL=http://localhost:5173

# For production (example)
BACKEND_URL=https://api.yourdomain.com
FRONTEND_URL=https://app.yourdomain.com
```

##### 4. Question Bank Generator Service
- LLM-powered question bank generation based on JD, resume, and fundamentals
- Categories: JD-based, fundamentals, resume-specific, behavioral, red flags
- Uses Claude Haiku via OpenRouter API
- Falls back to generic questions if LLM unavailable

**Files:**
- `backend/services/qb_generator.py` - NEW: Question bank generation service
- `backend/models.py` - Added `QuestionBank` model
- `backend/migrate_question_banks.py` - NEW: Database migration script

**QuestionBank Schema:**
```python
QuestionBank(
    id, candidate_id, job_id,
    jd_based_questions: List[str],      # Questions from job description
    fundamental_questions: List[str],   # Core technical fundamentals
    resume_questions: List[str],        # Probing resume claims
    behavioral_questions: List[str],    # STAR format questions
    follow_up_topics: List[str],        # Areas to dig deeper
    red_flag_probes: List[str],         # Verify concerns
    created_at, updated_at
)
```

##### 5. Enhanced Interviewer Dashboard
Interviewers now have a comprehensive view with:

- **Accept/Reject from Dashboard**: Buttons directly on schedule cards
- **View AI Insights**: See scores, summary, strengths, concerns, areas to probe
- **Regenerate Insights**: Re-run LLM analysis with fresh output
- **Download Resume**: Direct PDF download from dashboard
- **Generate Question Bank**: Create customized interview questions
- **View Question Bank**: Collapsible sections for each question category

**Files:**
- `backend/routers/interviewers.py` - Added 6 new endpoints:
  - `GET /api/v1/interviewer/candidates/{id}/insights` - View insights
  - `POST /api/v1/interviewer/candidates/{id}/insights/regenerate` - Regenerate insights
  - `GET /api/v1/interviewer/candidates/{id}/resume` - Download resume
  - `GET /api/v1/interviewer/candidates/{id}/question-bank` - View question bank
  - `POST /api/v1/interviewer/candidates/{id}/question-bank` - Generate question bank
  - `POST /api/v1/interviewer/schedule/{id}/respond` - Accept/reject interview
- `frontend/src/pages/InterviewerDashboard.tsx` - Complete overhaul:
  - `EnhancedCandidateDetailModal` with tabbed interface
  - `ScheduleCard` with accept/reject buttons
  - `QuestionSection` collapsible components
- `frontend/src/apiService.ts` - Added 6 new API functions and types

##### 6. Google Calendar Integration (Documented for Production)
The platform supports Google Calendar integration via OAuth 2.0. For the development phase, .ICS file attachments allow manual calendar import.

**Production Setup Requirements:**
1. Create project in Google Cloud Console
2. Enable Google Calendar API
3. Configure OAuth consent screen
4. Create OAuth 2.0 credentials
5. Add redirect URI: `{BACKEND_URL}/api/v1/google/callback`
6. Set environment variables:
   ```env
   GOOGLE_CLIENT_ID=your-client-id
   GOOGLE_CLIENT_SECRET=your-client-secret
   GOOGLE_REDIRECT_URI=https://api.yourdomain.com/api/v1/google/callback
   ```

**Feature Flow (Production):**
1. HR connects Google Calendar (OAuth flow)
2. System checks interviewer's calendar availability
3. Auto-suggests available time slots
4. Creates calendar event on both parties' calendars
5. Updates event status on accept/reject/reschedule

*This feature is documented for future implementation once the platform is deployed with proper OAuth credentials.*

#### How to Run:

```bash
# 1. Run question banks migration
cd /Users/siyer/hiring_capstone/backend
source venv/bin/activate
python migrate_question_banks.py

# 2. Start backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# 3. Start frontend
cd /Users/siyer/hiring_capstone/frontend
npm run dev
```

#### Testing the Flow:

1. **As HR:**
   - Go to Pipeline tab for a job
   - Add candidates and interviewers to rounds
   - Click "Send Invite" on an assignment
   - Select date and time in the modal
   - Recipient gets email with .ICS attachment

2. **As Interviewer:**
   - View scheduled interviews in Dashboard
   - Click "Accept" or "Reject" directly from the card
   - Click on candidate name to open detail modal
   - View/regenerate AI insights
   - Generate/view question bank
   - Download candidate's resume

---

### **Phase 3.2: Interviewer Dashboard Enhancements** [CODE COMPLETE ✅]

**Goal:** Fix resume viewing, add Q&A to question bank, add interview review flow

**Status:** ✅ CODE COMPLETE - All features implemented and tested

#### Implemented Features:

##### 1. Fixed Resume PDF Viewer
- Resume PDF now displays inline within the modal (not opening in new tab)
- Uses authenticated blob fetch to bypass "Not authenticated" error
- Working Download button that properly fetches PDF with auth token
- PDF displays in scrollable iframe at 600px height

**Files:**
- `frontend/src/pages/InterviewerDashboard.tsx` - Added Resume PDF tab with iframe viewer
- `frontend/src/apiService.ts` - Added `getInterviewerCandidateResumeBlob()` function

##### 2. Question Bank with Suggested Answers
- Questions now include "suggested answers" to help interviewers evaluate responses
- Each question shows what to look for in a strong answer
- Collapsible answer sections (click "Show Suggested Answer" to expand)
- LLM prompt updated to generate Q&A pairs

**Schema Updated:**
```typescript
interface QuestionWithAnswer {
    question: string;
    suggested_answer: string;
}
```

**Files:**
- `backend/services/qb_generator.py` - Updated to generate Q&A pairs
- `frontend/src/apiService.ts` - Added `QuestionWithAnswer` interface
- `frontend/src/pages/InterviewerDashboard.tsx` - Updated QuestionSection component

##### 3. Question Bank Download
- Download button exports QB as formatted text file
- Includes all questions and suggested answers
- Organized by category with clear formatting
- Filename: `{CandidateName}_question_bank.txt`

##### 4. Interview Conducted Flow (Review Submission)
- New "Interview Conducted" button on confirmed interview cards
- Opens review modal with:
  - 5-star ratings for: Technical Skills, Communication, Problem Solving, Cultural Fit, Overall
  - Text fields for: Strengths, Areas for Improvement, Notes
  - Recommendation buttons: Strong Yes, Yes, Maybe, No, Strong No
- Submitting marks interview as "completed" in database
- Status reflected in HR pipeline view

**Database:**
- New `interview_reviews` table (run `python migrate_interview_reviews.py`)

**Files:**
- `backend/models.py` - Added `InterviewReview` model
- `backend/routers/interviewers.py` - Added `/schedule/{id}/complete` and `/schedule/{id}/review` endpoints
- `backend/migrate_interview_reviews.py` - NEW: Migration script
- `frontend/src/apiService.ts` - Added `submitInterviewReview()` and `getInterviewReview()` functions
- `frontend/src/pages/InterviewerDashboard.tsx` - Added `InterviewReviewModal` component

#### Interview Status Flow:
```
pending → confirmed (interviewer accepts) → completed (review submitted)
       ↘ declined (interviewer rejects)
```

#### How to Test:

1. **Resume Viewer:**
   - Login as interviewer
   - Click on a scheduled interview candidate
   - Go to "Resume PDF" tab
   - PDF should display inline with working download button

2. **Question Bank with Answers:**
   - Go to "Question Bank" tab
   - Click "Generate Questions"
   - Each question shows "Show Suggested Answer" button
   - Click to expand/collapse answers

3. **Interview Review:**
   - Accept an interview (status becomes "confirmed")
   - Click "Interview Conducted" button
   - Fill out ratings and feedback
   - Select recommendation
   - Submit - status changes to "completed"

---

### **Phase 4: QB Generation & Reviews** [COMPLETE ✅]

**Goal:** Auto-generate interview questions, structured feedback

**Status:** ✅ COMPLETE - Merged into Phase 3.1 and 3.2

**Implemented Features:**
- ✅ AI-powered question generation with suggested answers
- ✅ Downloadable question banks
- ✅ Structured review form with star ratings
- ✅ Recommendation system (Strong Yes → Strong No)
- ✅ Interview completion tracking

---

### **Phase 5: Baton Passing & Talent Memory** [COMPLETE ✅]

**Goal:** Context flow between rounds, searchable candidate history

**Status:** ✅ COMPLETE

**Implemented Features:**
- ✅ Previous round context (gold/grey areas) available to next interviewer
- ✅ Talent search with filters (name, skills, job, experience, scores, date range)
- ✅ Candidate history timeline
- ✅ Re-engagement candidate tracking (identify, contact, convert pipeline)
- ✅ Talent Memory section in HR Dashboard with Search and Re-engagement tabs

**Files:**
- `backend/routers/talent.py` - Talent search, history, re-engagement endpoints
- `backend/services/talent_search.py` - Search and history service logic
- `frontend/src/components/TalentSearch.tsx` - Talent search UI
- `frontend/src/components/ReengagementList.tsx` - Re-engagement management UI

---

### **Phase 6: Automated Communications** [COMPLETE ✅]

**Goal:** Reduce HR follow-ups, candidate engagement

**Status:** ✅ COMPLETE

**Implemented Features:**
- ✅ Email templates CRUD (create, edit, delete, preview with merge fields)
- ✅ Send emails manually using templates
- ✅ Schedule emails for future delivery
- ✅ Communication history (per-candidate and all)
- ✅ Automation triggers (stub - ready for full implementation)
- ✅ AI content improvement chatbot for offer letters
- ✅ Accept/Reject/Hire candidate actions with status tracking
- ✅ Offer letter flow (compose, upload PDF, AI assistant, send)
- ✅ Hired tab showing offer/hired/rejected candidates
- ✅ Candidate status auto-updates through pipeline stages
- ✅ Status history tracking for all status changes

**Files:**
- `backend/routers/communications.py` - NEW: All communications endpoints
- `backend/routers/candidates.py` - Added accept/reject/hire/offer-letter endpoints
- `backend/routers/interviews.py` - Auto-status updates on assign/confirm
- `frontend/src/components/OfferLetterModal.tsx` - NEW: Offer letter compose/upload/AI
- `frontend/src/components/EmailTemplates.tsx` - Template management
- `frontend/src/components/ScheduledEmails.tsx` - Scheduled email management
- `frontend/src/components/AutomationTriggers.tsx` - Automation triggers
- `frontend/src/components/CommunicationHistory.tsx` - Communication history
- `frontend/src/pages/HRDashboard.tsx` - Added Hired/Offers and Talent Memory views

---

## 🧪 Testing Strategy

### Phase 1 Tests
```bash
# Backend
cd /Users/siyer/hiring_capstone/backend
source venv/bin/activate
pytest tests/ -v

# Specific test files
pytest tests/test_resume_parser.py -v
pytest tests/test_candidates.py -v
```

**Test Cases:**
- [ ] Job creation with valid data
- [ ] Candidate upload with PDF resume
- [ ] Resume text extraction accuracy
- [ ] API authentication (JWT)
- [ ] File upload size limits
- [ ] Invalid data handling (400 errors)

### Phase 2 Tests
- [ ] Scoring algorithm with sample resumes
- [ ] Skills extraction accuracy (precision/recall)
- [ ] Ranking order correctness
- [ ] Filter logic (score ranges, skills)

---

## 🔧 Configuration

### Environment Variables (.env)

**Backend:**
```bash
# Database (SQLite for dev)
DATABASE_URL=sqlite:///./hiring_copilot.db

# For production (PostgreSQL)
# DATABASE_URL=postgresql://user:pass@localhost:5432/hiring_copilot

# JWT Auth
JWT_SECRET_KEY=your-secret-key-change-in-production
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=1440

# File Upload
MAX_UPLOAD_SIZE_MB=10
UPLOAD_DIR=./uploads/resumes

# AI Services (Phase 4+)
OPENROUTER_API_KEY=your-key-here
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet

# Email (Phase 6)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

**Frontend (.env):**
```bash
VITE_API_BASE_URL=http://localhost:8000
```

---

## 🚀 Running the Application

### Development Mode

**Backend:**
```bash
cd /Users/siyer/hiring_capstone/backend
source venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
Access: http://localhost:8000/docs (Swagger UI)

**Frontend:**
```bash
cd /Users/siyer/hiring_capstone/frontend
npm run dev
```
Access: http://localhost:5173

### Production Build

**Backend:**
```bash
cd backend
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000
```

**Frontend:**
```bash
cd frontend
npm run build
npm run preview  # Test production build
```

---

## 📊 Progress Tracking

### Phase 1 Progress: [95%] 🚀
- [x] Backend setup complete
- [x] Database schema created
- [x] Basic API endpoints working
- [x] Resume upload functional
- [x] Frontend connected to backend
- [x] Authentication working
- [x] **REFINE** LLM-based resume extraction (OCR) via OpenRouter ✅
- [x] **REFINE** Skills field added to candidate model ✅
- [x] **REFINE** "Scan with AI" button in upload modal ✅
- [x] **REFINE** View Resume with two buttons (PDF + formatted text) ✅
- [ ] Tests for new features (Phase 1 refinement tests)

### Current Snapshot (2026-03-20 17:09)

**Phase 1 Refinement Complete - Resume Management with AI**

#### Core Features Implemented:

1. **LLM Resume Extraction Service** (`backend/services/llm_extractor.py`)
   - Extracts: name, email, phone, skills from resume PDF text
   - Uses OpenRouter API (Claude Haiku) for intelligent extraction
   - Fallback regex-based extraction when API unavailable
   - Handles extraction failures gracefully

2. **Skills Storage & Management**
   - Added `skills` JSON column to Candidate model
   - Skills stored as array of strings
   - Extracted automatically via LLM or regex

3. **Frontend AI Scan Workflow**
   - "Scan with AI" button in Upload Resume modal
   - Creates temp candidate, extracts text, calls LLM, deletes temp candidate
   - Auto-fills: name, email, phone, skills
   - Shows success/error feedback
   - Simple one-click flow for HR users

4. **Resume Viewing - Two Buttons**
   - **"View Actual Resume"** (blue button)
     - Opens original PDF in new browser tab
     - Fetches with proper Bearer token authentication
     - Fixed 404 error issue
   
   - **"Show Resume"** (purple button)
     - Displays formatted extracted text content
     - Auto-detects section headers (EDUCATION, SKILLS, EXPERIENCE, etc.)
     - Headers styled with orange color and underline
     - Scrollable container with proper spacing
     - Toggle on/off display

5. **Auth Token Handling**
   - `getAuthToken()` exported from apiService
   - PDF fetch requests include Bearer token in headers
   - Proper authorization for file downloads

6. **Modal Enhancement**
   - Fetches full candidate details when opened
   - Loading indicator while fetching resume text
   - Both buttons visible when resume available

#### Backend API Endpoints Added:
- `POST /api/v1/candidates/extract` - Extract details from resume text
- `GET /api/v1/candidates/{id}/resume` - Download/view PDF with auth

#### Files Modified/Created:
- `backend/services/llm_extractor.py` - New (420 lines)
- `backend/routers/candidates.py` - Updated (added endpoints, skills handling)
- `backend/models.py` - Updated (added skills column)
- `backend/schemas.py` - Updated (added extract schemas, skills field)
- `backend/.env` - Updated (added OpenRouter config)
- `backend/database.py` - Database schema migration (skills column)
- `frontend/src/apiService.ts` - Updated (extractResumeDetails, getResumeUrl, getAuthToken)
- `frontend/src/pages/HRDashboard.tsx` - Updated (UploadResumeModal, CandidateDetailModal)

#### Testing & Validation:
- ✅ Tested with 3 real resumes (Venugopal, Shlok, Krithin)
- ✅ All extraction working: names, emails, phones, skills
- ✅ PDF viewing with auth working
- ✅ Database stores skills correctly
- ✅ Frontend buttons functional
- Current database: 4 candidates, 2 with extracted skills

#### Configuration:
- Optional: Set `OPENROUTER_API_KEY` in `backend/.env` for AI extraction
- Without key: Uses regex-based fallback extraction
- Model: `anthropic/claude-3-haiku` (cost-effective)

#### User Workflow (Phase 1 Complete):
1. HR uploads resume PDF
2. Clicks "Scan with AI" → auto-filled with name, email, phone, skills
3. Creates candidate entry with all details
4. Later: click candidate → view PDF or formatted text
5. Skills displayed as tags in candidate detail view

#### Known Limitations & Future Improvements:
- Regex fallback has limited accuracy (for Phase 2 enhancement)
- Resume text formatting could be enhanced with NLP
- Phase 2 will add: resume ranking, scoring, insights

### Phase 2 Progress: [0%] - Resume Ranking & Prioritization
**Goal:** Solve "too much time screening resumes" - smart ranking and filtering

**Ready to Start:**
- Foundation in place: candidates with extracted skills, LLM service working
- Next: Build scoring algorithm, ranking UI, filtering

**Planned Features:**
- [ ] Resume parsing enhancement (extract more details: experience years, companies, education)
- [ ] Scoring algorithm (skills match, experience alignment, startup fit)
- [ ] Auto-ranking by score
- [ ] Filtering: score range, skills, experience level
- [ ] Insights generation: top candidates, gaps, matches
- [ ] Ranking UI with sortable columns
- [ ] Bulk actions (select multiple → move to interview)
- [ ] Tests for scoring accuracy

---

## 🎯 Next Steps for Any AI Model

**If starting fresh:**
1. Read PHILOSOPHY.md to understand the "why"
2. Review this document (IMPLEMENTATION_PLAN.md)
3. Check current phase progress above
4. Start from first incomplete checkbox in current phase

**If continuing work:**
1. Ask user which phase they want to work on
2. Review phase checklist
3. Implement next incomplete item
4. Test thoroughly
5. Update progress checkboxes

**Before implementing anything:**
- Mental simulation: Think through the user flow
- Check PHILOSOPHY.md: Does this reduce friction?
- Validate: Test with real use case scenario

---

## 📝 Code Style Guidelines

**Backend (Python):**
- Follow PEP 8
- Type hints for function signatures
- Docstrings for services/complex functions
- Keep routes thin, logic in services
- Use Pydantic for validation

**Frontend (TypeScript):**
- Functional components + hooks
- TypeScript strict mode
- Descriptive variable names
- Components max 200 lines (split if larger)
- Co-locate styles with components

**Testing:**
- Arrange-Act-Assert pattern
- One assertion per test (generally)
- Descriptive test names: `test_candidate_creation_with_valid_pdf`

---

## 🆘 Common Issues & Solutions

**Issue:** "Module not found" errors
**Solution:** 
```bash
cd backend && source venv/bin/activate && pip install -r requirements.txt
cd frontend && npm install
```

**Issue:** Database migration conflicts
**Solution:**
```bash
cd backend
alembic downgrade base
alembic upgrade head
```

**Issue:** Port already in use
**Solution:**
```bash
# Kill process on port 8000
lsof -ti:8000 | xargs kill -9
```

---

**This document is the single source of truth for implementation. Update it as you progress.**

---

## 📸 SESSION SNAPSHOT: 2026-03-21 05:55 UTC

### ✅ What Was Completed This Session

#### Feature: Enhanced Candidate Detailed View with Streamlined Upload

**Implementation Summary:**
Phase 1 enhancement that transforms the basic candidate table into rich, detailed cards with comprehensive information extracted via AI from resumes.

### 1. Backend Enhancements

#### Database Schema Changes
```sql
-- Added 3 new columns to candidates table
ALTER TABLE candidates ADD COLUMN experience_years VARCHAR(50);
ALTER TABLE candidates ADD COLUMN current_position VARCHAR(255);
ALTER TABLE candidates ADD COLUMN education JSON;
```

**Migration:** `backend/migrate_candidates.py` created and executed successfully.
- Status: ✅ All 3 columns present in database
- Backward compatible: Existing candidates not affected

#### Files Modified:

**models.py**
- Added `experience_years` field (stores "3", "5-7", "10+" format)
- Added `current_position` field (current/most recent job title)
- Added `education` field (JSON array of degree objects)

**schemas.py**
- Created `EducationEntry` schema (degree, institution, field, years)
- Updated `CandidateCreate` with new fields
- Updated `CandidateUpdate` with new fields
- Updated `CandidateResponse` with new fields
- Updated `ResumeExtractResponse` with new fields

**routers/candidates.py**
- Updated `create_candidate` endpoint to accept new form fields
- Updated `candidate_to_response` helper function
- Updated all response serialization
- Enhanced extraction endpoint return data

**services/llm_extractor.py**
- **Enhanced Extraction Prompt:** Now extracts:
  - Years of experience (calculated total or range)
  - Current/most recent position
  - Complete education history (all degrees with details)
- **Improved Parsing:** Better JSON extraction from LLM responses
- **Enhanced Fallback:** Regex patterns for experience and position extraction
- **Better Logging:** More detailed extraction info logged

### 2. Frontend Implementation

#### New Components Created:

**`frontend/src/components/CandidateCard.tsx`** (NEW FILE)
```typescript
// 157 lines - Rich candidate card component
Features:
- Header with application date, job position, status badge
- Name with experience badge (orange highlight if experience > 0)
- Current position with briefcase icon
- Education section with graduation cap icon
- Skills display (first 8 + counter for more)
- Contact info footer
- Hover effects with orange accent
- Responsive design
```

**`frontend/src/components/UploadResumeModal.tsx`** (NEW FILE)
```typescript
// 375 lines - 3-step upload wizard
Step 1: Job Selection
  - Grid of active jobs
  - Click to select
  - Visual feedback (orange border)

Step 2: Drag & Drop Upload
  - Beautiful drag zone
  - Immediate AI processing on drop
  - Real-time loading indicator
  - Error handling

Step 3: Review & Edit
  - All fields auto-populated
  - Editable before submission
  - Success notification
  - Education preview cards
  - Skills preview pills
```

#### Files Modified:

**apiService.ts**
- Added `EducationEntry` interface
- Updated `Candidate` interface with 3 new fields
- Updated `ResumeExtractResponse` interface with 3 new fields

**pages/HRDashboard.tsx**
- Imported new components: `CandidateCard`, `UploadResumeModal`
- Replaced table view with card grid
  - Before: `<table>` with rows
  - After: Grid layout with `<CandidateCard>` components
- Maintained filters (job, status)
- Enhanced empty state
- Commented out old UploadResumeModal (kept for reference)

### 3. UI/UX Design

**Color Scheme (Maintained):**
- Background: #000000, #0a0a0a, #111111
- Primary accent: #f97316 (orange)
- Status colors: green, yellow, blue, purple, red

**Key Visual Elements:**
- Experience Badge: Orange pill with "X years of work experience"
- Icons: Briefcase (work), Graduation cap (education), Calendar (date)
- Skills: Pill-shaped tags with hover effects
- Cards: Glass effect with hover state (orange border)

**Layout:**
- 2-column grid on large screens
- Stacked on smaller screens
- Consistent spacing and padding
- Professional typography

### 4. Testing & Validation

**Backend Tests:** 30/31 passing (97%)
- All CRUD operations working
- Resume upload tested
- AI extraction tested
- One failing test unrelated to new features (interviewer assignment)

**Manual Testing Completed:**
- ✅ Database migration successful
- ✅ Backend server starts without errors
- ✅ Frontend compiles and serves
- ✅ New fields present in database
- ✅ API endpoints returning enhanced data
- ✅ Components importing correctly

### 5. Integration Points

**Data Flow:**
```
PDF Upload (Frontend)
    ↓
FormData with resume file
    ↓
POST /api/v1/candidates (Backend)
    ↓
OCR: PyPDF2/pdfplumber extracts text
    ↓
LLM: OpenRouter/Claude Haiku analyzes text
    ↓
Structured JSON: {name, email, phone, skills, experience_years, current_position, education[]}
    ↓
Database: SQLite stores all fields
    ↓
Response: CandidateDetailResponse with all data
    ↓
Frontend: Auto-fills form fields
    ↓
Review: User confirms/edits
    ↓
Final Submit: Candidate created
    ↓
Card View: Rich display in grid
```

### 6. Files Created/Modified Summary

**Backend:**
- ✏️ `models.py` - Added 3 columns
- ✏️ `schemas.py` - Added EducationEntry, updated 5 schemas
- ✏️ `routers/candidates.py` - Updated endpoints
- ✏️ `services/llm_extractor.py` - Enhanced prompt and parsing
- ✨ `migrate_candidates.py` - Migration script (NEW)

**Frontend:**
- ✏️ `apiService.ts` - Updated 2 interfaces
- ✏️ `pages/HRDashboard.tsx` - Integrated new components
- ✨ `components/CandidateCard.tsx` - Card component (NEW)
- ✨ `components/UploadResumeModal.tsx` - Upload wizard (NEW)

**Documentation:**
- ✏️ `IMPLEMENTATION_PLAN.md` - This snapshot
- ✨ `IMPLEMENTATION_SUMMARY.md` - Feature summary (NEW)

### 7. Metrics

**Code Added:**
- Backend: ~150 lines modified, 50 lines added
- Frontend: ~550 lines added (new components)
- Migration: 50 lines
- Documentation: ~400 lines

**Files Changed:** 10 files
**New Files Created:** 4 files
**Database Tables Modified:** 1 table (candidates)
**New Database Columns:** 3 columns

### 8. Known Issues & Future Work

**Current Limitations:**
- Education extraction quality depends on resume formatting
- Experience years may need manual correction for non-standard formats
- No validation for education data structure yet

**Suggested Improvements for Next Session:**
- Add education field editing in candidate detail modal
- Improve experience years parsing for international formats
- Add visual timeline for work history
- Enhance mobile responsiveness
- Add search functionality to candidate cards

### 9. Deployment Notes

**To Deploy This Update:**
1. Pull latest code
2. Run database migration: `python migrate_candidates.py`
3. Restart backend server
4. Rebuild frontend: `npm run build`
5. Test upload flow with sample resumes

**Rollback Plan:**
If issues occur:
1. Revert database: The new columns can be NULL, so old code still works
2. No breaking changes to existing API contracts

### 10. Next Session Preparation

**What to Know:**
- All Phase 1 foundation features are now complete
- Enhanced candidate view is ready for Phase 2 (ranking/scoring)
- Resume extraction is production-ready
- Database is migrated and stable

**Recommended Next Features:**
1. Resume scoring algorithm (Phase 2)
2. Candidate ranking UI
3. Advanced filters (experience range, education level)
4. Interview scheduling pipeline (Phase 3)

---

**Session End Time:** 2026-03-21 05:55 UTC
**Duration:** ~2 hours
**Status:** ✅ All features implemented, tested, and documented
**Servers Status:** ✅ Both running (Backend: :8000, Frontend: :5173)

---

## Phase 5: Baton Passing & Talent Memory

### Goal
Enable context flow between interview rounds and build a searchable talent database.

### Backend Components
- [x] CandidateStatusHistory model for tracking status changes
- [x] ReengagementCandidate model for re-engagement tracking
- [x] Review context extraction service (gold/grey areas)
- [x] QB auto-adjustment algorithm with context awareness
- [x] Full-text search service for talent discovery
- [x] Candidate history aggregation endpoint
- [x] Talent router with search and re-engagement endpoints

### Frontend Components
- [x] TalentSearch component with filters
- [x] CandidateHistory timeline component
- [x] ReengagementList component
- [x] PreviousRoundContext component for interviewers
- [x] Talent Search tab in HR Dashboard
- [x] Context display in Interviewer QB generation

### API Endpoints
- POST /api/talent/search - Search candidates with filters
- GET /api/talent/candidate/{id}/history - Full candidate history
- GET /api/talent/reengagement-candidates - List re-engagement candidates
- POST /api/talent/reengagement/{candidate_id} - Mark for re-engagement
- GET /api/interviewer/candidates/{id}/previous-reviews - Get previous round context

---

## Phase 6: Automated Communications

### Goal
Reduce manual HR follow-ups with automated messaging at key milestones.

### Backend Components
- [x] EmailTemplate model with merge field support
- [x] CommunicationLog model for tracking sent emails
- [x] ScheduledEmail model for deferred sending
- [x] Template engine service with variable replacement
- [x] Automation trigger system (status change, date-based)
- [x] Communications router with full CRUD
- [x] Default template seeding

### Frontend Components
- [x] EmailTemplates list and management
- [x] TemplateEditor with variable picker
- [x] CommunicationHistory timeline
- [x] ScheduledEmails management
- [x] AutomationTriggers configuration
- [x] Communications tab in HR Dashboard

### API Endpoints
- GET/POST/PUT/DELETE /api/communications/templates - Template CRUD
- GET /api/communications/templates/{id}/preview - Preview with sample data
- GET /api/communications/candidate/{id}/history - Communication history
- POST /api/communications/send - Send manual email
- POST /api/communications/schedule - Schedule email
- GET/DELETE /api/communications/scheduled - Manage scheduled emails

### Default Templates
1. Interview Confirmation
2. Interview Reminder (24h before)
3. Rejection Notification
4. Offer Letter
5. Notice Period Check-in
6. Welcome Email

---

## Switch User Feature ✅ IMPLEMENTED

### Purpose
Allow quick switching between HR and Interviewer views for users with multiple roles or for demo/testing purposes.

### Implementation Status: ✅ COMPLETE (2024)

### Backend Implementation
**File:** `backend/routers/auth.py`
- `GET /api/v1/auth/my-roles` - Returns available roles (hr_admin, interviewer in demo mode)
- `POST /api/v1/auth/switch-role` - Switches user role, updates DB, returns new JWT token

**Schemas:** `backend/schemas.py`
- `RolesResponse` - roles list and current_role
- `SwitchRoleRequest` - role to switch to
- `SwitchRoleResponse` - new token, role, and user info

### Frontend Implementation
**Component:** `frontend/src/components/SwitchUserDropdown.tsx`
- Dropdown in dashboard headers showing current role
- Click to switch between HR Admin and Interviewer views
- Loading spinner during switch
- Keyboard shortcut: ⌘/Ctrl + Shift + U to toggle dropdown
- ESC to close dropdown
- Click outside to close

**API Service:** `frontend/src/apiService.ts`
- `getMyRoles()` - Fetch available roles
- `switchRole(role)` - Switch to different role

**Auth Context:** `frontend/src/contexts/AuthContext.tsx`
- `switchUserRole()` - Updates token, user state, and localStorage

**Dashboard Integration:**
- `HRDashboard.tsx` - SwitchUserDropdown in header
- `InterviewerDashboard.tsx` - SwitchUserDropdown in header

### Features
- ✅ Smooth role switching without logout
- ✅ Demo mode allows switching between all roles
- ✅ New JWT token generated on switch
- ✅ User role updated in database (demo mode)
- ✅ LocalStorage updated automatically
- ✅ Keyboard shortcut support (⌘+⇧+U)
- ✅ Active role indicator
- ✅ Loading state during switch
- ✅ Playwright test IDs for E2E testing

---

## Testing Infrastructure

### Backend Tests (pytest)
```bash
cd backend
pytest tests/ -v --cov=. --cov-report=html
```

### Frontend E2E Tests (Playwright)
```bash
cd frontend
npm run test:e2e        # Run all tests
npm run test:e2e:ui     # Interactive UI mode
npm run test:e2e:headed # Watch tests run in browser
```

### Test Files
- backend/tests/test_*.py - Backend unit and integration tests
- frontend/e2e/*.spec.ts - Playwright E2E tests
- frontend/e2e/pages/*.page.ts - Page Object classes

---

## Azure Deployment & Database Migration Guide

### Overview
This guide covers migrating from SQLite (development) to Azure PostgreSQL (production) and deploying the application to Azure.

### Prerequisites
- Azure account with active subscription
- Azure CLI installed (`az` command)
- Docker installed (for containerization)

### Step 1: Create Azure Resources

```bash
# Login to Azure
az login

# Create resource group
az group create --name hiring-platform-rg --location eastus

# Create Azure PostgreSQL Flexible Server
az postgres flexible-server create \
  --resource-group hiring-platform-rg \
  --name hiring-platform-db \
  --location eastus \
  --admin-user adminuser \
  --admin-password <secure-password> \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --storage-size 32 \
  --version 15

# Create database
az postgres flexible-server db create \
  --resource-group hiring-platform-rg \
  --server-name hiring-platform-db \
  --database-name hiring_db

# Allow Azure services access
az postgres flexible-server firewall-rule create \
  --resource-group hiring-platform-rg \
  --name hiring-platform-db \
  --rule-name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0
```

### Step 2: Set Up Alembic for Migrations

```bash
cd backend

# Install Alembic
pip install alembic psycopg2-binary

# Initialize Alembic
alembic init alembic
```

Update `alembic.ini`:
```ini
# Replace SQLite URL with environment variable
sqlalchemy.url = %(DATABASE_URL)s
```

Update `alembic/env.py`:
```python
import os
from backend.models import Base

# Get database URL from environment
config.set_main_option('sqlalchemy.url', os.environ.get('DATABASE_URL'))

# Set target metadata for autogenerate
target_metadata = Base.metadata
```

Generate initial migration:
```bash
# Generate migration from current models
alembic revision --autogenerate -m "Initial migration"

# Review the generated migration in alembic/versions/

# Apply migration
alembic upgrade head
```

### Step 3: Update Database Configuration

Update `backend/config.py`:
```python
import os

# Database URL - PostgreSQL in production, SQLite in development
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite:///./hiring_platform.db"  # Default for local dev
)

# Convert postgres:// to postgresql:// (Heroku/Azure compatibility)
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
```

Update `backend/database.py`:
```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from config import DATABASE_URL

# Use check_same_thread only for SQLite
connect_args = {}
if "sqlite" in DATABASE_URL:
    connect_args["check_same_thread"] = False

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
```

### Step 4: Create Docker Configuration

Create `backend/Dockerfile`:
```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 8000

# Run with Gunicorn
CMD ["gunicorn", "main:app", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "-b", "0.0.0.0:8000"]
```

Create `frontend/Dockerfile`:
```dockerfile
FROM node:20-alpine as build

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

Create `frontend/nginx.conf`:
```nginx
server {
    listen 80;
    location / {
        root /usr/share/nginx/html;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
    location /api {
        proxy_pass http://backend:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Step 5: Deploy to Azure App Service

```bash
# Create App Service Plan
az appservice plan create \
  --name hiring-platform-plan \
  --resource-group hiring-platform-rg \
  --sku B1 \
  --is-linux

# Create backend Web App
az webapp create \
  --resource-group hiring-platform-rg \
  --plan hiring-platform-plan \
  --name hiring-platform-api \
  --runtime "PYTHON:3.11"

# Create frontend Web App (Static Web App)
az staticwebapp create \
  --name hiring-platform-ui \
  --resource-group hiring-platform-rg \
  --location eastus2

# Configure backend environment variables
az webapp config appsettings set \
  --resource-group hiring-platform-rg \
  --name hiring-platform-api \
  --settings \
    DATABASE_URL="postgresql://adminuser:<password>@hiring-platform-db.postgres.database.azure.com/hiring_db?sslmode=require" \
    SECRET_KEY="<your-secret-key>" \
    OPENROUTER_API_KEY="<your-api-key>" \
    SMTP_HOST="<smtp-host>" \
    SMTP_PORT="587" \
    SMTP_USER="<smtp-user>" \
    SMTP_PASSWORD="<smtp-password>"
```

### Step 6: Database Migration Script

Create `scripts/migrate_to_postgres.py`:
```python
"""
Script to migrate data from SQLite to PostgreSQL
Run this ONCE during initial deployment
"""
import os
import sqlite3
import psycopg2
from psycopg2.extras import execute_values

# Source: Local SQLite
SQLITE_PATH = "hiring_platform.db"

# Target: Azure PostgreSQL
PG_CONNECTION = os.environ.get("DATABASE_URL")

def migrate_table(sqlite_cur, pg_cur, table_name, columns):
    """Migrate a single table from SQLite to PostgreSQL"""
    print(f"Migrating {table_name}...")
    
    # Fetch all data from SQLite
    sqlite_cur.execute(f"SELECT {', '.join(columns)} FROM {table_name}")
    rows = sqlite_cur.fetchall()
    
    if not rows:
        print(f"  No data in {table_name}")
        return
    
    # Insert into PostgreSQL
    cols = ', '.join(columns)
    placeholders = ', '.join(['%s'] * len(columns))
    
    insert_query = f"INSERT INTO {table_name} ({cols}) VALUES %s ON CONFLICT DO NOTHING"
    execute_values(pg_cur, insert_query, rows)
    
    print(f"  Migrated {len(rows)} rows")

def main():
    # Connect to SQLite
    sqlite_conn = sqlite3.connect(SQLITE_PATH)
    sqlite_cur = sqlite_conn.cursor()
    
    # Connect to PostgreSQL
    pg_conn = psycopg2.connect(PG_CONNECTION)
    pg_cur = pg_conn.cursor()
    
    try:
        # Define tables and their columns (in dependency order)
        tables = [
            ("users", ["id", "email", "hashed_password", "full_name", "role", "created_at"]),
            ("jobs", ["id", "title", "description", "requirements", "status", "created_at", "created_by"]),
            ("candidates", ["id", "name", "email", "phone", "resume_path", "skills", "experience", "education", "status", "job_id", "created_at"]),
            ("candidate_insights", ["id", "candidate_id", "insights_data", "created_at"]),
            ("interview_rounds", ["id", "job_id", "round_number", "name", "created_at"]),
            ("interview_schedules", ["id", "candidate_id", "interviewer_id", "round_id", "scheduled_at", "status", "created_at"]),
            ("interview_reviews", ["id", "schedule_id", "technical_rating", "communication_rating", "problem_solving_rating", "overall_rating", "strengths", "weaknesses", "recommendation", "notes", "created_at"]),
            ("question_banks", ["id", "candidate_id", "job_id", "questions", "created_at"]),
            # Phase 5 & 6 tables
            ("candidate_status_history", ["id", "candidate_id", "old_status", "new_status", "changed_at", "changed_by"]),
            ("reengagement_candidates", ["id", "candidate_id", "original_job_id", "new_job_id", "reason", "contacted_date", "status"]),
            ("email_templates", ["id", "name", "subject", "body_html", "body_text", "variables", "trigger_type", "trigger_condition", "is_active", "created_at"]),
            ("communication_logs", ["id", "candidate_id", "template_id", "recipient_email", "subject", "body", "sent_at", "status", "error_message"]),
            ("scheduled_emails", ["id", "candidate_id", "template_id", "scheduled_for", "status", "created_at", "sent_at"]),
        ]
        
        for table_name, columns in tables:
            try:
                migrate_table(sqlite_cur, pg_cur, table_name, columns)
            except Exception as e:
                print(f"  Error migrating {table_name}: {e}")
        
        # Commit changes
        pg_conn.commit()
        print("\nMigration complete!")
        
    finally:
        sqlite_conn.close()
        pg_conn.close()

if __name__ == "__main__":
    main()
```

### Step 7: CI/CD Pipeline (GitHub Actions)

Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy to Azure

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      
      - name: Install backend dependencies
        run: |
          cd backend
          pip install -r requirements.txt
          pip install pytest pytest-asyncio
      
      - name: Run backend tests
        run: |
          cd backend
          pytest tests/ -v

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install frontend dependencies
        run: |
          cd frontend
          npm ci
      
      - name: Run E2E tests
        run: |
          cd frontend
          npx playwright install --with-deps
          npm run test:e2e

  deploy-backend:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Deploy to Azure Web App
        uses: azure/webapps-deploy@v2
        with:
          app-name: 'hiring-platform-api'
          publish-profile: ${{ secrets.AZURE_WEBAPP_PUBLISH_PROFILE }}
          package: './backend'

  deploy-frontend:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Build frontend
        run: |
          cd frontend
          npm ci
          npm run build
      
      - name: Deploy to Azure Static Web Apps
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
          action: "upload"
          app_location: "frontend"
          output_location: "dist"
```

### Step 8: Environment Variables Checklist

**Backend (Azure App Service):**
```
DATABASE_URL=postgresql://user:pass@server.postgres.database.azure.com/db?sslmode=require
SECRET_KEY=<random-256-bit-key>
OPENROUTER_API_KEY=<your-key>
CLERK_SECRET_KEY=<clerk-key>
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=<sendgrid-api-key>
SMTP_FROM_EMAIL=noreply@yourdomain.com
SMTP_FROM_NAME=Hiring Platform
BACKEND_URL=https://hiring-platform-api.azurewebsites.net
FRONTEND_URL=https://hiring-platform-ui.azurestaticapps.net
```

**Frontend (Build-time):**
```
VITE_API_URL=https://hiring-platform-api.azurewebsites.net/api
VITE_CLERK_PUBLISHABLE_KEY=<clerk-publishable-key>
```

### Step 9: Post-Deployment Checklist

- [ ] Run Alembic migrations: `alembic upgrade head`
- [ ] Seed default email templates
- [ ] Verify database connectivity
- [ ] Test all API endpoints
- [ ] Verify frontend can reach backend
- [ ] Test authentication flow
- [ ] Verify email sending works
- [ ] Run E2E tests against production
- [ ] Set up monitoring (Azure Application Insights)
- [ ] Configure backup schedule for PostgreSQL
- [ ] Set up SSL certificates (auto with Azure)

### Rollback Procedure

```bash
# Rollback database migration
alembic downgrade -1

# Rollback App Service deployment
az webapp deployment slot swap \
  --resource-group hiring-platform-rg \
  --name hiring-platform-api \
  --slot staging \
  --target-slot production
```

### Cost Estimation (Monthly)

| Resource | SKU | Est. Cost |
|----------|-----|-----------|
| PostgreSQL Flexible | B1ms | ~$15 |
| App Service (Backend) | B1 | ~$13 |
| Static Web App (Frontend) | Free | $0 |
| Storage (Resumes) | Standard | ~$5 |
| **Total** | | **~$33/month** |

---

This completes the implementation plan with all phases and deployment guide.
