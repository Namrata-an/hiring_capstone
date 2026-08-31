# Changelog

All notable changes to this project. Format follows [Keep a Changelog](https://keepachangelog.com/);
versioning uses semantic-ish tags on `main`.

---

## [v0.1.0] — 2026-04-30 — Initial production release

First publicly-deployed version. Frontend on Vercel, backend on Azure Container
Apps (Central India), Postgres on Neon (us-east-1), resume CDN on UploadThing.

**Live:**
- Frontend — https://hiring-capstone.vercel.app
- Backend — https://hiring-backend.happymushroom-06d2d3fe.centralindia.azurecontainerapps.io
- Image — `hiringcapstone29986.azurecr.io/hiring-backend:00bd5aa`

### Highlights

- Production-grade deployment pipeline (CI builds, migrates, ships).
- Alembic owns the schema; seven legacy `migrate_*.py` scripts retired.
- Resume storage moved off the local filesystem onto UploadThing CDN.
- All schema- and CI-level config tightened so a missing secret crashes loudly
  instead of silently using a "dev" fallback.

### Phase 1 — Code-level production-readiness

Shipped in commit `a6e37b4`.

| Area | Change |
|---|---|
| `backend/models.py` | `is_active`, `auto_generated`, `modified_by_interviewer` switched from `Column(String("true"/"false"))` to `Column(Boolean)` |
| `backend/models.py` | `CandidateInsights.overall_score` and 5 sub-score columns switched from `Column(String(10))` to `Column(Integer)` |
| `backend/models.py` + routers | All `default=datetime.utcnow` and `onupdate=datetime.utcnow` replaced with timezone-aware `_utcnow()` helper (`datetime.now(timezone.utc)`); `datetime.utcnow()` is deprecated in Python 3.12 |
| `backend/services/insights_generator.py` | `insights_to_db_format` returns ints (was casting LLM scores to `str` for the old `String(10)` columns) |
| `backend/routers/interviewers.py` + `communications.py` | All sites that wrote `"true"`/`"false"` strings to bool columns updated to write real booleans |
| `backend/config.py` | `JWT_SECRET_KEY` now hard-fails on startup if missing; previous default of `"dev-secret-key-change-in-production"` is gone. Added declarations for `UPLOADTHING_TOKEN`, `UPLOADTHING_SECRET_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`. Module-level `UPLOAD_DIR.mkdir(...)` removed (lazy now). |
| `frontend/src/hooks/useClerkAuth.ts`, `frontend/src/pages/RoleSelection.tsx` | Deleted (unused; transitive Clerk removal) |
| `frontend/package.json` | `@clerk/react` removed from deps; `npm install` re-run |
| `frontend/src/components/{CandidateHistory,EmailTemplates,PreviousRoundContext,ReengagementList,TalentSearch}.tsx` | Pre-existing TS build errors fixed (type-only imports, optional callback guards) so `npm run build` passes |
| `.gitignore` | `.env`, `*.db`, `backend/uploads/`, `.playwright-mcp/`, `*.bak`, etc. |

### Phase 2 — Alembic + Neon Postgres

Shipped in commit `a6e37b4`.

| Area | Change |
|---|---|
| Schema source of truth | Alembic now manages all DDL. Initial migration `192dd71d9f7f_initial_schema_from_models.py` captures all 14 tables. Generated against an empty SQLite (so it's a clean `op.create_table` rather than ALTERs against drifting state) and then applied to Neon. |
| `backend/alembic/env.py` | Reads `DATABASE_URL` from `config.py`; registers `Base.metadata` from `database.py`; imports `models` for autogen |
| `backend/main.py` | `Base.metadata.create_all(bind=engine)` removed — Alembic owns schema; double-create-on-start hides drift |
| `backend/requirements.txt` | `psycopg2-binary` added; Python <3.11 backports (`backports.asyncio.runner`, `exceptiongroup`, `tomli`) removed because the production container runs 3.11 |
| Seed data | `hr@company.com / test123` (HR Admin) and `interviewer@company.com / test123` (Interviewer) registered against Neon |

### Phase 3 — UploadThing resume storage

Shipped in commit `a6e37b4`.

| Area | Change |
|---|---|
| `backend/services/uploadthing_service.py` (new) | Server-side proxy. `upload_pdf(content, filename)` → `POST /v7/prepareUpload` to UT, then multipart `PUT` to the returned ingest URL; returns `{url, key}`. `download_pdf(url)` for the reverse path |
| `backend/routers/uploads.py` (new) | `POST /api/v1/uploads/resume` (auth-gated, PDF-only, ≤10 MB) |
| `backend/routers/candidates.py` | Accepts a new `resume_url` form field (preferred); legacy multipart upload kept as fallback for tests. `GET /candidates/{id}/resume` proxies the PDF from UploadThing for HTTPS-stored resumes |
| `backend/services/resume_parser.py` | `extract_text_from_pdf(source)` accepts a local path *or* an HTTPS URL (uses httpx to download bytes, then pdfplumber on the buffer) |
| `frontend/src/apiService.ts` | `uploadResume(file)` posts to `/uploads/resume` |
| `frontend/src/components/UploadResumeModal.tsx` | New flow: drop PDF → upload to CDN → backend OCRs the URL → review extracted fields → final create with `resume_url` |

UploadThing v7 endpoint discovery and the multipart-PUT requirement are both
captured in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) "Things that bit us".

### Phase 4 — Local integration test

Not committed; validation only.

- pytest 31/31 passing (`backend/tests/`).
- Playwright drove HR login → job creation → PDF upload via UploadThing → OCR
  auto-fill → 3 candidates persisted to Neon (`Smoke Tester`, `temp_scan`,
  `Venugopala C S`).

### Phase 5 — Cloud deployment

Shipped in commit `b8275f4` (artefacts) + post-deploy fixes in `a99ebb2` and `00bd5aa`.

| Area | Change |
|---|---|
| `backend/Dockerfile` (new) | `python:3.11-slim`, installs `gcc` + `libpq-dev` for `psycopg2-binary`, exposes 8000 |
| `backend/.dockerignore` (new) | Skips `venv/`, `tests/`, `uploads/`, `*.db`, `.env`, legacy migrate scripts |
| `.github/workflows/backend-deploy.yml` (new) | On `main` push touching `backend/**`: setup-python → `alembic upgrade head` against Neon → `docker buildx build` → push to ACR → `az containerapp update` → `/health` smoke loop |
| Image tagging | Every shipped commit gets `<short-sha>` + `latest` tags; v0.1.0 tagged in ACR |
| Frontend hardcoded URLs | Two sites that hardcoded `http://localhost:8000` (`apiService.ts`, `contexts/AuthContext.tsx`) now read `VITE_API_BASE_URL` (or `VITE_API_URL`) with localhost as a dev fallback |
| `git` author hygiene | First post-deploy commits got rejected by Vercel's Hobby plan because the author email wasn't bound to a GitHub user. Rewritten with `shlok-iyer <shlokiyer2004@gmail.com>` |

**Provisioned Azure resources (resource group `hiring-rg`, Central India):**
- ACR `hiringcapstone29986` (Basic SKU, admin enabled)
- Container Apps environment `hiring-env` (with managed Log Analytics workspace)
- Container App `hiring-backend` (min=1, max=3, 0.5 vCPU, 1 GiB)
- Service principal `hiring-capstone-gha`, scoped to `hiring-rg` only

**GitHub secrets:** `AZURE_CREDENTIALS`, `DATABASE_URL`.
**Vercel env:** `VITE_API_BASE_URL`.

### Phase 5b — CI migrations + repo cleanup + docs

Shipped in commit `3c084ca`.

| Area | Change |
|---|---|
| `.github/workflows/backend-deploy.yml` | Added `Run Alembic migrations against Neon` step **before** the image build; failures abort the deploy without swapping traffic |
| `backend/Dockerfile` | `CMD` no longer runs `alembic upgrade head` on container boot — CI is authoritative |
| `backend/scripts/` (new) | Houses post-Alembic helper scripts. `legacy/` subdir holds the seven retired `migrate_*.py` scripts |
| Repo root | Reduced from 18+ items to 7. Removed: 4 stray screenshots, 50 KB resume zip, broken root `requirements.txt`, `.session_snapshot`, `*.bak` / `*.backup` page files, stray `server.log` |
| `docs/` (new) | All long-form markdown consolidated here. New: `DEPLOYMENT.md`, `MIGRATIONS.md`. Pre-existing docs (`PHILOSOPHY.md`, `IMPLEMENTATION_PLAN.md`, etc.) moved in as-is |
| `README.md` (new) | Quick-start entry point at repo root |
| `docs/IMPLEMENTATION_PLAN.md` | Prepended with a current-production-status block + phase summary table |
| `.gitignore` | Extended for `resumes/`, `*.zip`, `*.backup`, `*.log`, `production-*.png` |

---

## Pre-v0.1.0

Forty-plus features were already implemented before this session began
(authentication, jobs/candidates CRUD, AI insights, question banks, interview
scheduling, talent search, communications, scheduled emails, etc.). They are
*not* re-listed here — see commit history before `0ce5a2e` and the
`docs/IMPLEMENTATION_PLAN.md` body for that legacy detail.
