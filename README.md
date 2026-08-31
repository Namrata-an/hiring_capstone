# Hiring Co-Pilot

Friction-removal tool for hiring. FastAPI backend, React/TypeScript frontend, Postgres on Neon, resume CDN on UploadThing.

## Quick links

| | |
|---|---|
| **Live frontend** | https://hiring-capstone.vercel.app/ |
| **Live backend** | https://hiring-backend.happymushroom-06d2d3fe.centralindia.azurecontainerapps.io |
| **Personal repo** | https://github.com/Namrata-an/hiring_capstone |
| **Docs** | [`docs/`](docs/) |

## Architecture (current production)

```
                                       ┌────────────────┐
                                       │ UploadThing    │
                                       │ (resume CDN)   │
                                       └────────┬───────┘
                                                │
   Vercel ──────────► Azure Container Apps ─────┴───────► Neon Postgres
   (frontend)         (FastAPI, Central India)            (us-east-1)
```

## Project layout

```
hiring_capstone/
├── backend/          FastAPI app
│   ├── alembic/      Schema migrations (single source of truth for DB shape)
│   ├── routers/      HTTP endpoints (auth, candidates, jobs, interviews, ...)
│   ├── services/     Business logic (LLM, OCR, email, UploadThing, talent search)
│   ├── tests/        pytest suite (run with `pytest`)
│   ├── scripts/      One-shot scripts; `scripts/legacy/` = pre-Alembic migrations
│   ├── Dockerfile    Production container build
│   └── main.py       FastAPI app factory + router registration
├── frontend/         Vite + React + TypeScript
│   └── src/
│       ├── pages/        HRDashboard / InterviewerDashboard / LoginPage
│       ├── components/   Reusable UI
│       ├── contexts/     AuthContext
│       └── apiService.ts API client
├── docs/             All long-form documentation
├── scripts/          Repo-level helper scripts
└── .github/workflows/
    └── backend-deploy.yml   CI: alembic → build → push → ACA update
```

## Run it locally

```bash
# Backend (terminal 1)
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env       # then fill in DATABASE_URL, UploadThing, etc.
alembic upgrade head        # apply migrations to whatever DB you set
uvicorn main:app --reload

# Frontend (terminal 2)
cd frontend
npm install
npm run dev                 # → http://localhost:5173
```

## Deploy

The live production app is already available at https://hiring-capstone.vercel.app/.

In this personal repo, backend deployment is manual-only to avoid failed GitHub Actions runs without the original deployment credentials. To publish or run backend deploy actions from this repo, add the required GitHub Actions secrets first:

```text
DATABASE_URL
AZURE_CREDENTIALS
```

The backend may also need runtime secrets such as `JWT_SECRET_KEY`, `OPENROUTER_API_KEY`, UploadThing credentials, and SMTP credentials depending on the feature being deployed. See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for the full pipeline and [`docs/MIGRATIONS.md`](docs/MIGRATIONS.md) for how schema changes flow through.

## Documentation

| Doc | Purpose |
|---|---|
| [`docs/PHILOSOPHY.md`](docs/PHILOSOPHY.md) | North-star principles + real pain points being solved |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Production runbook, secrets, redeploy, rollback |
| [`docs/MIGRATIONS.md`](docs/MIGRATIONS.md) | How DB schema changes are made and shipped safely |
| [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) | Phased build plan with current status |
| [`docs/SETUP_GUIDE.md`](docs/SETUP_GUIDE.md) | Local-dev setup walk-through |
| [`docs/COMMANDS.md`](docs/COMMANDS.md) | Common dev / ops commands cheat-sheet |
| [`docs/CODEBASE_EXPLANATION.md`](docs/CODEBASE_EXPLANATION.md) | Tour of the code by subsystem |
| [`docs/FEATURES_ROADMAP.md`](docs/FEATURES_ROADMAP.md) | What's next |

## Tests

```bash
cd backend && pytest tests/        # 31 passing as of v0.1.0
cd frontend && npm run build       # type-checks + production build
cd frontend && npm run test:e2e    # Playwright E2E (requires both servers running)
```
