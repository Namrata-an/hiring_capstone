# Next Session Brief - Hiring Capstone

## Project Status

**Hiring Co-Pilot** - Full-stack hiring platform (FastAPI + React + Postgres)
- **Phases 1-7** complete (candidate management, interview pipeline, QB, timeline, talent search)
- **Current deployment**: Production on Azure Container Apps + Vercel + Neon Postgres
- **Live URLs**:
  - Frontend: https://hiring-capstone.vercel.app
  - Backend: https://hiring-backend.happymushroom-06d2d3fe.centralindia.azurecontainerapps.io

---

## Recent Work Completed (Session 2026-05-05)

### 1. Interview Pipeline UX Improvements
✅ Auto-refresh polling (10-second interval)
✅ Optimistic UI for drag-and-drop assignments ("Assigning..." state)
✅ Loading overlays for deletion operations
✅ Disabled overlay when no candidate selected
✅ Smooth transitions between states (no visual gaps)

**Files modified:**
- `frontend/src/components/InterviewPipelineCanvas.tsx` - Added polling, pending states
- `frontend/src/components/InterviewRoundCard.tsx` - Added PendingInterviewer component, deletion overlay

### 2. Toast Notification System
✅ Replaced all JavaScript alerts with in-UI toast notifications
✅ 4 types: success (green), error (red), warning (orange), info (blue)
✅ Auto-dismiss after 5 seconds, manual close button
✅ Top-right stacking with smooth animations

**Files created:**
- `frontend/src/components/Toast.tsx` - Complete toast system with useToast hook

### 3. Resume PDF Viewer Fix
✅ Fixed 404 error when viewing candidate resumes in Interviewer Dashboard
✅ Backend now detects and proxies UploadThing CDN URLs
✅ Made endpoint async and uses httpx for remote fetching
✅ Backward compatible with local file paths

**Files modified:**
- `backend/routers/interviewers.py` - get_candidate_resume() function

### 4. Database Persistence Verification
✅ Verified all CRUD operations (rounds, schedules) persist correctly in Postgres
✅ No orphaned records, all foreign keys valid
✅ Created verification script for future testing

**Files created:**
- `backend/scripts/verify_pipeline_persistence.py`

---

## Known Issues

### ❌ AI Chatbot QB Modification - JSON Parse Errors (CRITICAL)

**Problem:** AI chatbot for Question Bank modification fails intermittently with JSON parse errors:
- "Unterminated string starting at: line 117 column 25"
- "Expecting ',' delimiter: line 75 column 42 (char 4481)"

**Root Cause:** LLMs (via OpenRouter) return JSON with:
- Trailing commas
- Unescaped newlines in strings
- Comments
- Single quotes instead of double quotes
- Markdown code fences

**Attempted Fixes:**
1. Enhanced regex cleaning (`_clean_json_string()`)
2. Fallback extraction with `re.search(r'\{[\s\S]*\}', content)`
3. Stricter prompt instructions
4. Lower temperature (0.3)
5. **json5 library** - Most robust attempt:
   - Installed `json5==0.14.0`
   - Implemented 3-strategy parsing (json → json5 → extracted json5)
   - Added graceful fallback preserving original questions

**Current Status:** 
- ⚠️ json5 installed and implemented but issue still persists per user
- System has graceful error handling, won't crash UI
- Returns friendly error message and preserves original questions

**Files modified:**
- `backend/services/qb_generator.py` - Multi-strategy parsing with json5
- `backend/requirements.txt` - Added json5==0.14.0

**Next Steps for This Issue:**
1. Consider switching to Claude API directly (better JSON generation than OpenRouter)
2. Use structured output mode if available
3. Simplify response format (fewer nested fields)
4. Add JSON schema validation before parsing
5. Implement retry logic with rephrased prompts
6. Alternative: Remove suggested_answer from AI modifications, only modify questions

**Documentation archived:** See `archive/session_docs/` for detailed fix attempts

---

## Architecture & Deployment

### Tech Stack
- **Backend**: FastAPI (Python 3.10+), SQLAlchemy, Alembic
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Database**: Neon Postgres (serverless, us-east-1)
- **File Storage**: UploadThing CDN (resumes)
- **AI**: OpenRouter (Claude Sonnet 3.7, gpt-4o)
- **Email**: Brevo SMTP
- **Auth**: JWT tokens with httpOnly cookies

### Deployment Flow

#### Backend (Azure Container Apps)
```
Push to main
  → GitHub Actions (.github/workflows/backend-deploy.yml)
  → Run alembic upgrade head (migrations)
  → Build Docker image (backend/Dockerfile)
  → Push to Azure Container Registry
  → Update Azure Container App (zero-downtime)
```

**Key Environment Variables (Azure Container App):**
- `DATABASE_URL` - Neon Postgres connection string
- `UPLOADTHING_TOKEN` - File upload CDN
- `OPENROUTER_API_KEY` - LLM access
- `BREVO_API_KEY` - Email sending
- `SECRET_KEY` - JWT signing key
- `FRONTEND_URL` - CORS origin

**Manual Deploy Command:**
```bash
cd backend
az containerapp update --name hiring-backend --resource-group DefaultResourceGroup-CIN --image <new-image>
```

**Logs:**
```bash
az containerapp logs show --name hiring-backend --resource-group DefaultResourceGroup-CIN --follow
```

#### Frontend (Vercel)
```
Push to main
  → Vercel auto-deploys (connected to GitHub)
  → Build: npm run build
  → Runs TypeScript type checking
  → Deploys to CDN
```

**Environment Variables (Vercel):**
- `VITE_API_BASE_URL` - Backend URL (Azure Container App)

**Manual Deploy:**
```bash
cd frontend
vercel --prod
```

#### Database Migrations (Alembic)
```bash
cd backend
source venv/bin/activate

# Create new migration
alembic revision --autogenerate -m "description"

# Review generated file in alembic/versions/

# Apply locally first
alembic upgrade head

# Push to main → CI applies to production automatically
```

**Migration Safety:**
- Always test locally against Neon dev branch first
- Use `alembic downgrade -1` if rollback needed
- CI runs migrations BEFORE deploying new code
- See `docs/MIGRATIONS.md` for full workflow

---

## Project Structure

```
hiring_capstone/
├── backend/
│   ├── alembic/              Database migrations (single source of truth)
│   ├── routers/              HTTP endpoints
│   │   ├── auth.py          Login, register, JWT
│   │   ├── candidates.py    Candidate CRUD
│   │   ├── jobs.py          Job postings
│   │   ├── interviews.py    Interview scheduling (HR side)
│   │   ├── interviewers.py  Interviewer dashboard endpoints
│   │   ├── hr.py            HR-specific endpoints
│   │   └── question_bank.py QB CRUD + AI chat
│   ├── services/
│   │   ├── qb_generator.py  LLM QB generation (⚠️ JSON issue here)
│   │   ├── talent_search.py Vector search with LLM
│   │   ├── ocr_service.py   Resume parsing
│   │   ├── uploadthing.py   File CDN integration
│   │   └── email_service.py Brevo SMTP
│   ├── models.py            SQLAlchemy models
│   ├── main.py              FastAPI app + CORS
│   ├── requirements.txt     Python deps (includes json5)
│   ├── Dockerfile           Production container
│   └── scripts/
│       ├── verify_pipeline_persistence.py
│       └── legacy/          Pre-Alembic migration scripts
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── HRDashboard.tsx
│       │   ├── InterviewerDashboard.tsx
│       │   └── LoginPage.tsx
│       ├── components/
│       │   ├── InterviewPipelineCanvas.tsx  (✅ Optimistic UI)
│       │   ├── InterviewRoundCard.tsx       (✅ Pending states)
│       │   ├── Toast.tsx                    (✅ New notification system)
│       │   └── ...
│       ├── contexts/
│       │   └── AuthContext.tsx
│       ├── apiService.ts    Axios client
│       └── types.ts         TypeScript interfaces
├── docs/
│   ├── DEPLOYMENT.md        ⭐ Full deployment guide
│   ├── MIGRATIONS.md        Database schema workflow
│   ├── CODEBASE_EXPLANATION.md  Code tour
│   ├── PHILOSOPHY.md        Product vision
│   └── IMPLEMENTATION_PLAN.md   Phase breakdown
├── archive/
│   ├── session_docs/        Temporary fix documentation
│   ├── test_artifacts/      Test scripts and results
│   └── screenshots/         Phase demos
└── README.md                Quick start + links
```

---

## Essential Commands

### Local Development
```bash
# Backend
cd backend
source venv/bin/activate
uvicorn main:app --reload  # Port 8000

# Frontend
cd frontend
npm run dev                 # Port 5173

# Database
cd backend
alembic upgrade head        # Apply migrations
alembic downgrade -1        # Rollback one
alembic revision --autogenerate -m "msg"  # Create migration
```

### Testing
```bash
cd backend && pytest tests/              # Backend tests (31 passing)
cd frontend && npm run build             # Type check
cd frontend && npm run test:e2e          # Playwright E2E
```

### Production
```bash
# View backend logs
az containerapp logs show --name hiring-backend --resource-group DefaultResourceGroup-CIN --follow

# Force redeploy backend
cd backend
docker build -t hiring-backend .
# Push to ACR and update container app (see docs/DEPLOYMENT.md)

# Force redeploy frontend
cd frontend
vercel --prod
```

---

## Key Documents to Reference

1. **`docs/DEPLOYMENT.md`** - Complete deployment runbook
   - Azure Container Apps setup
   - Vercel configuration
   - Environment variables
   - Rollback procedures
   - Monitoring and logs

2. **`docs/MIGRATIONS.md`** - Database schema changes
   - Alembic workflow
   - Safe migration practices
   - Testing migrations locally
   - Production migration process

3. **`docs/CODEBASE_EXPLANATION.md`** - Code architecture
   - Router organization
   - Service layer patterns
   - Frontend component structure
   - State management approach

4. **`README.md`** - Quick reference
   - Live URLs
   - Architecture diagram
   - Quick start commands

5. **Archive files** (if needed for debugging):
   - `archive/session_docs/JSON5_FINAL_FIX.md` - Detailed AI chatbot issue analysis
   - `archive/session_docs/OPTIMISTIC_UI_IMPROVEMENTS.md` - Drag-and-drop implementation

---

## What to Focus On Next

### Immediate Priority: AI Chatbot JSON Fix
The json5 solution didn't fully resolve the issue. Consider:
1. **Simplify the response format** - Remove `suggested_answer` field from AI modifications
2. **Switch to Claude API directly** - OpenRouter may add JSON instability
3. **Add structured output** - Use Claude's JSON mode if available
4. **Alternative approach** - Only let AI suggest changes, require manual confirmation

### Other Potential Improvements
1. **Performance**: Add caching for talent search results
2. **UX**: Add keyboard shortcuts for common operations
3. **Monitoring**: Set up error tracking (Sentry)
4. **Testing**: Add E2E tests for interview pipeline
5. **Features**: Calendar integration for interview scheduling

---

## Quick Context Recap

- This is a **production system** deployed and running
- **Phases 1-7 complete**: Candidate mgmt, job postings, interview pipeline, QB system, timeline, talent search, interviewer dashboard
- **User roles**: HR (full access), Interviewer (assigned candidates only)
- **Key workflows**:
  1. HR uploads candidate → OCR extracts info
  2. HR creates job posting → LLM generates question bank
  3. HR schedules interview rounds → Assigns interviewers
  4. Interviewers view assigned candidates → Access QB, timeline, talent search
  5. System tracks interview lifecycle → Status updates → Email notifications

---

## Git Status Summary

```
Current branch: main
Untracked files now in archive/:
  - session_docs/ (7 markdown files)
  - test_artifacts/ (2 test files)
  - screenshots/ (30+ phase demo PNGs)

Recent commits:
  65a79d1 Perf: fix N+1 query problem in interview pipeline drag-and-drop
  d9461d2 Fix: add connection pooling to prevent stale DB connections
  074f46c Fix: QB add/update/delete/bulk/chat now actually persist on Postgres
  4ad45f1 Phase 7.8 UI: "View questions asked" link on timeline events
  33fa417 Phase 7.8: snapshot the question bank at "interview conducted" time
```

---

## Session Opening Prompt Template

**Use this to brief the next AI session:**

```
I'm working on a production hiring platform (FastAPI + React + Postgres) deployed on Azure Container Apps + Vercel.

CRITICAL CONTEXT:
- Read /Users/siyer/hiring_capstone/NEXT_SESSION_BRIEF.md for full status
- Read /Users/siyer/hiring_capstone/docs/DEPLOYMENT.md for deployment details
- Read /Users/siyer/hiring_capstone/README.md for quick architecture overview

KNOWN ISSUE:
AI chatbot for Question Bank modification has persistent JSON parse errors. Previous attempts with json5, regex cleaning, and fallback extraction haven't fully resolved it. The system has graceful error handling but success rate is still too low.

CODEBASE:
- Backend: /Users/siyer/hiring_capstone/backend/ (FastAPI, Alembic migrations)
- Frontend: /Users/siyer/hiring_capstone/frontend/ (React + TypeScript + Vite)
- Docs: /Users/siyer/hiring_capstone/docs/

Ready to continue work. What should we tackle next?
```

---

**Generated:** 2026-05-05  
**Session archived to:** `archive/session_docs/`
