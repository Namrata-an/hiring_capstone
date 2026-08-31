"""Main FastAPI application."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import re

from config import CORS_ORIGINS
from routers import (
    auth, jobs, candidates, interviewers, health, interviews,
    talent, communications, uploads, hr_comms,
)
# Schema is owned by Alembic — run `alembic upgrade head` instead of create_all.

app = FastAPI(
    title="Hiring Co-Pilot API",
    description="API for the Hiring Co-Pilot platform - reducing hiring friction",
    version="1.0.0"
)

# CORS middleware with pattern matching for production
def is_allowed_origin(origin: str) -> bool:
    """Check if origin is allowed (supports wildcard patterns)."""
    allowed_patterns = [
        r"^http://localhost:\d+$",  # localhost with any port
        r"^https://.*\.vercel\.app$",  # Vercel deployments
        r"^https://.*\.azurewebsites\.net$",  # Azure deployments
    ]

    # Check exact matches first
    if origin in CORS_ORIGINS:
        return True

    # Check pattern matches
    for pattern in allowed_patterns:
        if re.match(pattern, origin):
            return True

    return False

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_origin_regex=r"(https://.*\.vercel\.app|https://.*\.azurewebsites\.net)",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router)
app.include_router(auth.router, prefix="/api/v1")
app.include_router(jobs.router, prefix="/api/v1")
app.include_router(candidates.router, prefix="/api/v1")
app.include_router(interviewers.router, prefix="/api/v1")
app.include_router(interviews.router)  # Already has /api/v1 prefix
app.include_router(talent.router, prefix="/api/v1")
app.include_router(communications.router, prefix="/api/v1")
app.include_router(hr_comms.router, prefix="/api/v1")
app.include_router(uploads.router, prefix="/api/v1")


@app.get("/")
def root():
    """Root endpoint with API info."""
    return {
        "name": "Hiring Co-Pilot API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health"
    }
