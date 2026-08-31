# Hiring Platform - Codebase Explanation

## Table of Contents
- [Overview](#overview)
- [Architecture](#architecture)
- [Backend Structure](#backend-structure)
- [Frontend Structure](#frontend-structure)
- [Technology Choices & Rationale](#technology-choices--rationale)
- [Data Flow](#data-flow)
- [Key Features & Implementation](#key-features--implementation)
- [Development Workflow](#development-workflow)

---

## Overview

This is an **AI-powered hiring automation platform** designed to eliminate friction in the interview process. It's not a theoretical tool - it's built to solve real pain points that hiring teams face daily:

- **Resume screening paralysis** → Intelligent prioritization
- **Interview scheduling hell** → Visual pipeline with drag-and-drop
- **Question bank generation friction** → Auto-generated QBs from resume analysis
- **Vague interview reviews** → Structured feedback with ratings
- **No context between rounds** → Round-to-round insight passing
- **Lost talent memory** → Searchable candidate database

**Philosophy:** Friction removal over feature bloat. Every feature must reduce manual work.

---

## Architecture

### High-Level Design

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ HR Dashboard │  │ Interviewer  │  │ Role Selection   │   │
│  │              │  │ Dashboard    │  │ & Auth           │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↕ REST API (axios)
┌─────────────────────────────────────────────────────────────┐
│                     Backend (FastAPI)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │   Routers    │  │   Services   │  │   Models         │   │
│  │ (Endpoints)  │  │ (Business    │  │ (SQLAlchemy)     │   │
│  │              │  │  Logic)      │  │                  │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                   Database (SQLite → PostgreSQL)              │
│  Jobs | Candidates | Users | Interviews | Reviews | QBs      │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│              External Services & Integrations                 │
│  • Clerk (Auth)  • OpenRouter (LLM)  • Email Service         │
└─────────────────────────────────────────────────────────────┘
```

**Architecture Principles:**
- **Separation of Concerns:** Frontend (UI) ↔ Backend (API) ↔ Database (Storage)
- **Stateless API:** Backend doesn't maintain session state (JWT-based auth)
- **Modular Services:** Each feature has its own service module (e.g., `qb_generator.py`, `insights_generator.py`)
- **Database Abstraction:** SQLAlchemy ORM allows easy migration from SQLite (dev) to PostgreSQL (prod)

---

## Backend Structure

### Directory Layout

```
backend/
├── main.py                    # FastAPI app entry point
├── config.py                  # Environment variables, secrets
├── database.py                # SQLAlchemy connection & session management
├── models.py                  # Database models (Jobs, Candidates, etc.)
├── schemas.py                 # Pydantic schemas for request/response validation
├── requirements.txt           # Python dependencies
│
├── routers/                   # API endpoints (organized by resource)
│   ├── auth.py                # Authentication (login, signup, JWT)
│   ├── jobs.py                # Job CRUD operations
│   ├── candidates.py          # Candidate CRUD, resume upload, insights
│   ├── interviews.py          # Interview scheduling, reviews
│   └── interviewers.py        # Interviewer-specific endpoints (QB, insights)
│
├── services/                  # Business logic & AI integrations
│   ├── auth_service.py        # Password hashing, JWT token generation
│   ├── resume_parser.py       # PDF parsing (pdfplumber + pdfminer)
│   ├── llm_extractor.py       # Resume data extraction using LLMs
│   ├── insights_generator.py  # Candidate insights (strengths, concerns, red flags)
│   ├── qb_generator.py        # Question bank generation with chat modification
│   ├── leetcode_questions.py  # Curated LeetCode question mappings
│   └── email_service.py       # Email automation (invites, reminders)
│
├── tests/                     # Automated tests (pytest)
│   ├── test_auth.py
│   ├── test_jobs.py
│   └── test_candidates.py
│
├── uploads/                   # Resume file storage (local dev, S3 for prod)
├── migrate_*.py               # Database migration scripts
└── hiring_copilot.db          # SQLite database file (dev)
```

### Key Backend Files

#### `main.py`
- **Purpose:** FastAPI app initialization, CORS setup, router registration
- **Why:** Single entry point for the API server
- **Key Setup:**
  ```python
  app = FastAPI()
  app.add_middleware(CORSMiddleware)  # Allow frontend to call API
  app.include_router(auth.router)
  app.include_router(jobs.router)
  # ... other routers
  ```

#### `models.py`
- **Purpose:** SQLAlchemy ORM models (database schema as Python classes)
- **Why:** Type-safe database operations, automatic migrations via Alembic
- **Key Models:**
  - `User` - HR and Interviewer accounts
  - `Job` - Job postings with requirements
  - `Candidate` - Candidate data, resume path, status
  - `Interview` - Scheduled interviews linking candidates + interviewers
  - `InterviewReview` - Structured feedback with ratings
  - `QuestionBank` - Auto-generated questions with LeetCode links
  - `CandidateInsights` - AI-generated analysis (strengths, concerns)

#### `database.py`
- **Purpose:** Database connection & session management
- **Why:** Single source of truth for DB connections, dependency injection for endpoints
- **Pattern:** Each API endpoint gets a database session via `Depends(get_db)`

#### `routers/`
- **Purpose:** Define API endpoints (routes) grouped by resource
- **Why:** Separation of concerns - each resource (jobs, candidates) has its own file
- **Pattern:**
  ```python
  router = APIRouter(prefix="/api/jobs", tags=["jobs"])
  
  @router.post("/", response_model=JobResponse)
  async def create_job(job_data: JobCreate, db: Session = Depends(get_db)):
      # Business logic here
  ```

#### `services/`
- **Purpose:** Reusable business logic separated from HTTP layer
- **Why:** Testable, reusable across multiple endpoints
- **Key Services:**
  - **`resume_parser.py`** - Extracts text from PDF resumes
  - **`llm_extractor.py`** - Uses OpenRouter LLM to structure resume data (name, skills, experience)
  - **`insights_generator.py`** - Generates AI insights (strengths, concerns, questions to ask)
  - **`qb_generator.py`** - Creates interview question banks, supports chat-based modification
  - **`leetcode_questions.py`** - Static mapping of LeetCode questions by skill category
  - **`email_service.py`** - Sends automated emails (invites, reminders)

---

## Frontend Structure

### Directory Layout

```
frontend/
├── index.html                 # HTML entry point
├── vite.config.ts             # Vite bundler configuration
├── tailwind.config.js         # Tailwind CSS theming
├── package.json               # NPM dependencies
│
└── src/
    ├── main.tsx               # React app entry point
    ├── App.tsx                # Root component with routing
    ├── apiService.ts          # Centralized API client (axios wrapper)
    │
    ├── pages/                 # Full-page views
    │   ├── RoleSelection.tsx  # Choose HR or Interviewer role
    │   ├── LoginPage.tsx      # Login/Signup UI
    │   ├── HRDashboard.tsx    # HR main interface (pipeline, candidates)
    │   └── InterviewerDashboard.tsx  # Interviewer schedule & QB
    │
    ├── components/            # Reusable UI components
    │   ├── CandidateCard.tsx
    │   ├── InterviewPipelineCanvas.tsx  # Drag-drop Kanban board
    │   ├── UploadResumeModal.tsx
    │   ├── ScheduleInviteModal.tsx
    │   ├── InsightsModal.tsx
    │   ├── QuestionBankEditor.tsx
    │   └── InterviewRoundCard.tsx
    │
    ├── contexts/              # React Context for global state
    │   └── AuthContext.tsx    # User authentication state
    │
    └── hooks/                 # Custom React hooks
        └── useClerkAuth.ts    # Clerk authentication integration
```

### Key Frontend Files

#### `apiService.ts`
- **Purpose:** Single source of truth for all API calls
- **Why:** DRY principle, centralized error handling, type safety
- **Pattern:**
  ```typescript
  export const api = {
    getCandidates: () => axios.get<Candidate[]>('/api/candidates'),
    uploadResume: (file: File, data: CandidateCreate) => {
      const formData = new FormData();
      formData.append('file', file);
      return axios.post('/api/candidates/upload', formData);
    }
  };
  ```

#### `HRDashboard.tsx`
- **Purpose:** HR's main interface (candidate pipeline, scheduling)
- **Features:**
  - Visual Kanban pipeline (Applied → Screening → Interview → Offer)
  - Drag-and-drop candidates between stages
  - Upload resumes
  - Schedule interviews
  - View insights & question banks
- **Why:** Single-page workflow for HR (no context switching)

#### `InterviewerDashboard.tsx`
- **Purpose:** Interviewer's main interface (schedule, QB, reviews)
- **Features:**
  - View assigned interviews
  - Generate/edit question banks with AI chat
  - Submit structured reviews
  - View candidate insights
  - Download QB as PDF
- **Why:** Everything an interviewer needs in one place

#### `InterviewPipelineCanvas.tsx`
- **Purpose:** Drag-and-drop Kanban board for candidate pipeline
- **Technology:** `@dnd-kit/core` (modern drag-and-drop library)
- **Why:** Visual > tabular for pipeline management (follows Kanban UX pattern)

#### `AuthContext.tsx`
- **Purpose:** Global authentication state (user info, login/logout)
- **Technology:** React Context API
- **Why:** Avoid prop drilling, centralized auth logic

---

## Technology Choices & Rationale

### Backend: FastAPI

**Why FastAPI?**
- ✅ **Speed:** Async/await support, one of the fastest Python frameworks
- ✅ **Developer Experience:** Auto-generated OpenAPI docs, type hints everywhere
- ✅ **Validation:** Pydantic schemas catch bad data before it hits the database
- ✅ **Modern:** Built for async workloads (LLM calls, file uploads)

**Alternatives Considered:**
- Flask: Too basic, lacks native async support
- Django: Too heavy for an API-only backend

### Frontend: React + TypeScript + Vite

**Why React?**
- ✅ **Component Reusability:** Build once, use everywhere
- ✅ **Ecosystem:** Massive library of pre-built components
- ✅ **Hiring:** Easy to find React developers

**Why TypeScript?**
- ✅ **Type Safety:** Catch bugs at compile time, not runtime
- ✅ **Autocomplete:** IDE knows exactly what fields exist
- ✅ **Refactoring:** Rename a type, all usages update automatically

**Why Vite?**
- ✅ **Speed:** Instant hot module reload (HMR)
- ✅ **Modern:** Native ES modules, optimized builds
- ✅ **Simple:** Less configuration than Webpack

**Alternatives Considered:**
- Create React App (CRA): Deprecated, slow builds
- Next.js: Overkill for a single-page app (no SSR needed)

### Database: SQLite (Dev) → PostgreSQL (Prod)

**Why SQLite for Dev?**
- ✅ **Zero Setup:** No server installation, just a file
- ✅ **Portable:** Entire database is one file
- ✅ **Fast Iteration:** Easy to reset, migrate, experiment

**Why PostgreSQL for Prod?**
- ✅ **Scalability:** Handles concurrent writes, large datasets
- ✅ **Features:** JSON columns, full-text search, advanced indexing
- ✅ **Reliability:** Battle-tested for production workloads

**SQLAlchemy ORM:**
- ✅ **Database Agnostic:** Write once, deploy on any SQL database
- ✅ **Migration Path:** Alembic handles schema changes automatically
- ✅ **Type Safety:** Python classes represent database tables

### Authentication: Clerk

**Why Clerk?**
- ✅ **Out-of-the-Box:** Login, signup, password reset, social auth
- ✅ **Security:** Handles JWT, session management, rate limiting
- ✅ **UI Components:** Pre-built React components (no custom auth UI needed)
- ✅ **Free Tier:** Sufficient for MVP

**Why Not Roll Our Own?**
- Auth is security-critical - mistakes = data breaches
- Time saver: Focus on hiring features, not auth plumbing

### AI/LLM: OpenRouter

**Why OpenRouter?**
- ✅ **Model Choice:** Access to GPT-4, Claude, Gemini via one API
- ✅ **Cost Optimization:** Compare prices, switch models easily
- ✅ **No Vendor Lock-In:** Not tied to OpenAI or Anthropic

**Use Cases:**
- Resume parsing (extract structured data from PDF text)
- Candidate insights generation (strengths, concerns, red flags)
- Question bank generation (JD + resume → tailored questions)
- Chat-based QB modification ("Add more system design questions")

### PDF Processing: pdfplumber + pdfminer.six

**Why pdfplumber?**
- ✅ **Accurate Text Extraction:** Preserves layout, handles tables
- ✅ **Python Native:** Easy integration with FastAPI

**Why pdfminer.six?**
- ✅ **Fallback:** When pdfplumber struggles, pdfminer often succeeds
- ✅ **Mature:** Battle-tested for edge cases

### Styling: Tailwind CSS

**Why Tailwind?**
- ✅ **Utility-First:** No CSS files, styles inline with components
- ✅ **Consistency:** Pre-defined spacing, colors, typography
- ✅ **Speed:** No context switching between HTML and CSS files

**Dark Theme:**
- All UI uses dark theme (gray-900 backgrounds, white/gray text)
- Reduces eye strain for long sessions
- Modern aesthetic

### Icons: Lucide React

**Why Lucide?**
- ✅ **Tree-Shakeable:** Only import icons you use
- ✅ **Consistent Design:** All icons have same stroke width, style
- ✅ **Lightweight:** SVG-based, no font dependencies

### Drag-and-Drop: @dnd-kit

**Why @dnd-kit?**
- ✅ **Modern:** Built for React hooks, not class components
- ✅ **Accessible:** Keyboard navigation, screen reader support
- ✅ **Performant:** Uses CSS transforms, not JS position updates

### Charts: Recharts

**Why Recharts?**
- ✅ **React Native:** Built specifically for React
- ✅ **Composable:** Build complex charts from simple primitives
- ✅ **Responsive:** Auto-scales to container size

**Use Case:**
- (Future) Analytics dashboard for HR (candidate pipeline metrics, interview conversion rates)

### PDF Generation: jsPDF

**Why jsPDF?**
- ✅ **Client-Side:** No backend needed for PDF generation
- ✅ **Customizable:** Full control over layout, fonts, colors
- ✅ **Battle-Tested:** Used by thousands of projects

**Use Case:**
- Download question banks as PDF (for offline interviews)
- Includes all questions, suggested answers, LeetCode links

---

## Data Flow

### 1. Resume Upload Flow

```
User uploads PDF
    ↓
Frontend: FormData with file + candidate info
    ↓
Backend: /api/candidates/upload
    ↓
Save PDF to /uploads/{candidate_id}.pdf
    ↓
Extract text: pdfplumber → raw text
    ↓
Parse with LLM: OpenRouter → structured data (name, skills, experience)
    ↓
Save to database: Candidate model
    ↓
Return candidate object to frontend
```

### 2. Insights Generation Flow

```
Interviewer clicks "Generate Insights"
    ↓
Frontend: POST /api/interviewer/candidates/{id}/insights
    ↓
Backend: Load candidate resume + job description
    ↓
Call insights_generator.py service
    ↓
OpenRouter API: Analyze resume → strengths, concerns, red flags
    ↓
Save to database: CandidateInsights model
    ↓
Return insights JSON to frontend
    ↓
Frontend: Display in modal with collapsible sections
```

### 3. Question Bank Generation Flow

```
Interviewer selects round number (1, 2, 3...)
    ↓
Frontend: POST /api/interviewer/candidates/{id}/question-bank?round=2
    ↓
Backend: Load resume, insights, previous round reviews
    ↓
Call qb_generator.py service
    ↓
Build LLM prompt:
  - JD requirements
  - Candidate skills/experience
  - Insights (strengths, concerns)
  - Previous review (gold/grey areas) - Round 2+ only
    ↓
OpenRouter API: Generate questions
    ↓
Add LeetCode questions: leetcode_questions.py (skill-matched)
    ↓
Save to database: QuestionBank model
    ↓
Return QB JSON (6 categories + LeetCode links)
    ↓
Frontend: Display in tabs (Questions, AI Chat, LeetCode)
```

### 4. Chat-Based QB Modification Flow

```
Interviewer types: "Add more system design questions"
    ↓
Frontend: POST /api/interviewer/candidates/{id}/question-bank/chat
    ↓
Backend: Load current question bank + chat history
    ↓
Build LLM prompt:
  - Current questions (all categories)
  - User message
  - Previous chat messages
    ↓
OpenRouter API: Modify questions based on request
    ↓
Parse LLM response → Updated questions JSON
    ↓
Update database: QuestionBank.chat_history + modified questions
    ↓
Return updated QB to frontend
    ↓
Frontend: Update UI with new questions
```

### 5. Interview Scheduling Flow

```
HR drags candidate to "Round 1" stage
    ↓
Frontend: Update local state (optimistic UI)
    ↓
Backend: PUT /api/candidates/{id} (status = "interviewing")
    ↓
HR clicks "Schedule Interview"
    ↓
Modal: Select interviewer, date, time
    ↓
Frontend: POST /api/interviews
    ↓
Backend: Create Interview record
    ↓
Call email_service.py: Send invite to candidate + interviewer
    ↓
Return interview object
    ↓
Frontend: Show in interviewer's schedule
```

### 6. Review Submission Flow

```
Interviewer completes interview
    ↓
Clicks "Submit Review" button
    ↓
Frontend: Modal with structured form
  - Ratings (1-5): Technical, Communication, Problem-Solving, Cultural Fit
  - Text: Strengths, Areas for Improvement, Notes
  - Recommendation: Hire / No Hire / Maybe
    ↓
Frontend: POST /api/interviews/{id}/review
    ↓
Backend: Save InterviewReview record
    ↓
Update Interview.status = "completed"
    ↓
Return review object
    ↓
Frontend: Show success message, update interview card
```

### 7. Round 2+ Context Passing Flow

```
HR schedules Round 2 interview
    ↓
Interviewer opens QB generator
    ↓
Selects "Round 2" from dropdown
    ↓
Frontend: POST /api/interviewer/candidates/{id}/question-bank?round=2
    ↓
Backend: Fetch Round 1 review
    ↓
Extract gold areas (strengths) + grey areas (weaknesses)
    ↓
Build enhanced LLM prompt:
  "Round 1 showed strong React skills (gold) but weak async patterns (grey).
   Skip React basics. Probe async/await, promises, error handling."
    ↓
Generate Round 2 QB (targeted questions)
    ↓
Return QB with previous_review_context field
    ↓
Frontend: Display Round 1 summary + new questions
```

---

## Key Features & Implementation

### 1. **Visual Interview Pipeline (Kanban Board)**

**Purpose:** Replace manual status tracking with drag-and-drop visual workflow

**Implementation:**
- **Library:** `@dnd-kit/core` (React drag-and-drop)
- **Components:**
  - `InterviewPipelineCanvas.tsx` - Main Kanban board
  - `CandidateCard.tsx` - Draggable candidate cards
- **Backend:** `PUT /api/candidates/{id}` updates `status` field
- **UX:** Optimistic updates (UI changes immediately, syncs to backend async)

**Stages:**
1. Applied (new resumes)
2. Screening (being reviewed)
3. Interview (scheduled or in-progress)
4. Offer (passed all rounds)
5. Hired / Rejected (final states)

**Why It Works:**
- Visual > tabular for pipeline management
- Drag-drop is faster than dropdowns
- Follows familiar Trello/Jira UX pattern

---

### 2. **AI-Powered Resume Insights**

**Purpose:** Auto-analyze resumes to surface strengths, concerns, and interview focus areas

**Implementation:**
- **Service:** `insights_generator.py`
- **Endpoint:** `POST /api/interviewer/candidates/{id}/insights`
- **LLM Prompt:**
  ```
  Analyze this resume for a [Job Title] position.
  
  Resume: {resume_text}
  Job Requirements: {job_description}
  
  Provide:
  1. Key Strengths (3-5 bullet points)
  2. Potential Concerns (yellow flags to probe)
  3. Critical Red Flags (deal-breakers)
  4. Questions to Ask (probe weak areas)
  5. Recommended Focus Areas
  ```
- **Output:** Structured JSON stored in `CandidateInsights` table

**Why It Works:**
- Saves interviewers 10-15 minutes per resume
- Surfaces hidden red flags (job hopping, skill mismatches)
- Provides interview talking points

---

### 3. **Auto-Generated Question Banks**

**Purpose:** Generate tailored interview questions from resume + JD analysis

**Implementation:**
- **Service:** `qb_generator.py`
- **Endpoint:** `POST /api/interviewer/candidates/{id}/question-bank?round=1`
- **Categories:**
  1. **JD-Based Questions** - Match job requirements
  2. **Technical Fundamentals** - Test core knowledge
  3. **Resume-Specific** - Verify claims ("You say you built X, how?")
  4. **Behavioral/Startup Mindset** - Culture fit, ownership, resourcefulness
  5. **Insights-Based** - Probe concerns from AI analysis
  6. **Red Flag Probes** - Dig into yellow/red flags
- **LeetCode Integration:**
  - `leetcode_questions.py` maps skills → relevant LeetCode problems
  - Auto-includes 3-5 Easy/Medium problems with solution hints
- **Format:** Each question has `question` + `suggested_answer` fields

**Why It Works:**
- Eliminates manual QB creation (saves 20-30 min per candidate)
- Questions are tailored, not generic
- LeetCode links allow technical assessment prep

---

### 4. **Chat-Based QB Modification**

**Purpose:** Let interviewers customize QBs via natural language ("Add more system design questions")

**Implementation:**
- **Service:** `qb_generator.py → chat_modify_questions()`
- **Endpoint:** `POST /api/interviewer/candidates/{id}/question-bank/chat`
- **LLM Prompt:**
  ```
  Current Question Bank:
  {current_questions_json}
  
  User Request: "{user_message}"
  
  Modify the question bank according to the request.
  Return updated JSON in the same format.
  ```
- **Chat History:** Stored in `QuestionBank.chat_history` (array of messages)
- **UI:** Chat tab in QB viewer (similar to ChatGPT interface)

**Why It Works:**
- Faster than manual editing
- Natural language > forms for complex changes
- Conversational ("Add 2 more", "Remove generic questions")

---

### 5. **Manual Question Editing (CRUD)**

**Purpose:** Full control - interviewers can add/edit/delete individual questions

**Implementation:**
- **Endpoints:**
  - `POST /question-bank/add` - Add question to category
  - `PUT /question-bank/update` - Edit question text/answer
  - `DELETE /question-bank/delete` - Remove question
- **UI:** Inline editing (hover to reveal edit/delete icons)
- **UX:** Immediate feedback (optimistic updates)

**Why It Works:**
- Some interviewers prefer manual control
- Edge cases where AI doesn't get it right
- "Edit on the fly" during interview prep

---

### 6. **Round-Aware QB Generation**

**Purpose:** Round 2+ QBs leverage previous round insights (skip gold, probe grey)

**Implementation:**
- **Review Analysis:** Extract strengths (gold) and weaknesses (grey) from Round 1 review
- **LLM Prompt Enhancement:**
  ```
  Previous Round Results:
  Gold Areas (Strong): {strengths}
  Grey Areas (Weak): {areas_for_improvement}
  
  Generate Round 2 questions that:
  - Skip validated gold areas (already confirmed)
  - Probe grey areas deeply (verify if it's a real gap)
  - Add new dimensions not covered in Round 1
  ```
- **UI:** Round selector dropdown (1-5), shows previous round summary

**Why It Works:**
- Each round builds on the last (no redundant questions)
- Efficient use of interview time
- "Baton passing" between interviewers

---

### 7. **PDF Export with LeetCode Links**

**Purpose:** Download QB as formatted PDF for offline interviews

**Implementation:**
- **Library:** `jsPDF` (client-side PDF generation)
- **Function:** `handleDownloadQB()` in `InterviewerDashboard.tsx`
- **Format:**
  - Title page (candidate name, date)
  - Sections for each question category (color-coded)
  - LeetCode questions with URLs and solution hints
  - Follow-up topics
- **Layout:** Multi-page, auto-pagination, wrapped text

**Why It Works:**
- Some interviews happen offline (no laptop)
- Print-friendly format
- Includes everything (questions + answers + LeetCode links)

---

### 8. **Structured Interview Reviews**

**Purpose:** Move from vague text blobs to actionable structured feedback

**Implementation:**
- **Model:** `InterviewReview` with fields:
  - `technical_skills` (1-5)
  - `communication` (1-5)
  - `problem_solving` (1-5)
  - `cultural_fit` (1-5)
  - `overall_rating` (1-5)
  - `strengths` (text)
  - `areas_for_improvement` (text)
  - `notes` (text)
  - `recommendation` (Hire / No Hire / Maybe)
- **UI:** Star ratings + text areas
- **Backend:** `POST /api/interviews/{id}/review`

**Why It Works:**
- Granular ratings enable data-driven decisions
- "Technical: 5/5, Communication: 2/5" is more actionable than "Maybe hire"
- Can aggregate across multiple interviewers

---

### 9. **LeetCode Question Mapping**

**Purpose:** Auto-recommend relevant LeetCode problems based on candidate skills

**Implementation:**
- **File:** `backend/services/leetcode_questions.py`
- **Data Structure:**
  ```python
  LEETCODE_QUESTIONS = {
    'arrays': [
      {
        'title': 'Two Sum',
        'url': 'https://leetcode.com/problems/two-sum/',
        'difficulty': 'Easy',
        'solution_hint': 'Use hash map for O(n) solution'
      },
      # ... more questions
    ],
    'strings': [...],
    'dynamic_programming': [...]
  }
  
  SKILL_TO_CATEGORY = {
    'Python': ['arrays', 'strings', 'hash_maps'],
    'JavaScript': ['arrays', 'strings', 'async'],
    'React': ['frontend', 'javascript']
  }
  ```
- **Logic:** Match candidate skills → categories → select 3-5 relevant problems
- **UI:** Separate "LeetCode" tab in QB viewer

**Why It Works:**
- Technical screening needs coding problems
- Curated questions (not random)
- Difficulty appropriate to role (Easy/Medium for most roles)

---

### 10. **Email Automation**

**Purpose:** Auto-send interview invites, reminders, status updates

**Implementation:**
- **Service:** `email_service.py`
- **Use Cases:**
  - Interview invite (to candidate + interviewer)
  - Interview reminder (24 hours before)
  - Status updates (offer sent, rejection)
  - Notice period check-ins (future feature)
- **Technology:** SMTP (Gmail) or SendGrid API
- **Templates:** HTML email templates with merge fields

**Why It Works:**
- Eliminates manual email copy-paste
- Reduces no-shows (automated reminders)
- Keeps candidates engaged

---

## Development Workflow

### Local Development Setup

1. **Backend:**
   ```bash
   cd backend
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   uvicorn main:app --reload  # Runs on http://localhost:8000
   ```

2. **Frontend:**
   ```bash
   cd frontend
   npm install
   npm run dev  # Runs on http://localhost:5173
   ```

3. **Database:**
   - SQLite auto-creates `hiring_copilot.db` on first run
   - Migrations: `python migrate_*.py` scripts (manual for now)

### Environment Variables

**Backend (`.env`):**
```
DATABASE_URL=sqlite:///./hiring_copilot.db
SECRET_KEY=your-secret-key-here
OPENROUTER_API_KEY=sk-or-xxx
CLERK_SECRET_KEY=sk_test_xxx
```

**Frontend:**
- Vite uses `import.meta.env.VITE_*` for env vars
- API base URL configured in `apiService.ts`

### Testing

**Backend Tests:**
```bash
cd backend
pytest tests/  # Runs all tests
pytest tests/test_candidates.py  # Specific test file
```

**Test Structure:**
- `conftest.py` - Shared fixtures (test database, auth tokens)
- `test_*.py` - Test files matching `routers/*.py`

**Frontend Testing:**
- (Future) Jest + React Testing Library

### Code Quality

**Backend:**
- Type hints everywhere (`def func(x: int) -> str:`)
- Pydantic schemas for validation
- SQLAlchemy models for database safety

**Frontend:**
- TypeScript strict mode
- ESLint for code style
- Prettier for formatting (future)

### Git Workflow

1. Feature branch: `git checkout -b feature/qb-chat-interface`
2. Commit with meaningful messages
3. Push to GitHub
4. (Future) CI/CD runs tests, deploys to staging

---

## Migration Path: Dev → Production

### Current State (Dev)
- **Database:** SQLite (single file)
- **File Storage:** Local `/uploads` folder
- **Auth:** Clerk (already prod-ready)
- **Server:** `uvicorn` (single process)

### Production Readiness Checklist

**Database:**
- [ ] Migrate to PostgreSQL (AWS RDS or Railway)
- [ ] Run Alembic migrations for schema
- [ ] Set up automated backups

**File Storage:**
- [ ] Move resumes to S3 (AWS) or Cloudflare R2
- [ ] Update `resume_parser.py` to read from S3

**Server:**
- [ ] Deploy backend to Railway / Render / AWS Lambda
- [ ] Set up gunicorn with multiple workers
- [ ] Add load balancer (if needed)

**Frontend:**
- [ ] Deploy to Vercel / Netlify / Cloudflare Pages
- [ ] Set `VITE_API_URL` to production backend URL
- [ ] Enable HTTPS (free via hosting provider)

**Monitoring:**
- [ ] Add Sentry for error tracking
- [ ] Set up uptime monitoring (UptimeRobot)
- [ ] Log aggregation (Papertrail, LogDNA)

**Security:**
- [ ] Enable HTTPS everywhere
- [ ] Set CORS to specific origin (not `*`)
- [ ] Rate limiting on API endpoints
- [ ] Input sanitization (SQL injection prevention - already handled by SQLAlchemy)

---

## Future Enhancements

### Phase 6: Talent Memory Search
- Full-text search across resumes, reviews, insights
- Filter by skills, ratings, date ranges
- "Show me all backend engineers we interviewed in Q4"
- Re-engage rejected candidates for new roles

### Phase 7: Analytics Dashboard
- Pipeline conversion rates (Applied → Hired %)
- Average time-to-hire
- Interviewer performance metrics
- Candidate sourcing effectiveness

### Phase 8: Notice Period Automation
- Auto-send check-in emails during notice period
- Track candidate status (still coming / changed mind)
- Reduce candidate drop-off

### Phase 9: Advanced Scheduling
- Calendar integration (Google Calendar, Outlook)
- Auto-detect interviewer availability
- Suggest optimal interview times (ML-based)

### Phase 10: Interview Recording & Transcription
- Record interviews (audio/video)
- AI transcription → auto-populate review notes
- Search interview transcripts

---

## Conclusion

This codebase is built on the principle of **friction removal over feature bloat**. Every technology choice, architectural decision, and feature implementation serves the goal of making hiring faster, easier, and more data-driven.

**Key Takeaways:**
- **Modular Architecture:** Backend services, frontend components - easy to extend
- **AI-First:** LLMs do the heavy lifting (insights, QB generation, chat)
- **Developer Experience:** Type safety (TypeScript + Pydantic), auto-docs (FastAPI), hot reload (Vite)
- **Production-Ready Path:** SQLite → PostgreSQL migration is straightforward via SQLAlchemy
- **Real Pain Points Solved:** Not a toy project - built to replace Google Sheets and manual processes

**Next Steps:**
1. Complete Phase 3 features (scheduling, reviews)
2. Add comprehensive test coverage (>80%)
3. Deploy to staging environment
4. Gather user feedback
5. Iterate and scale

This is not just a hiring platform - it's a **friction removal tool** that happens to be for hiring. Big difference.
