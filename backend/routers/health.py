"""Health check endpoint."""
from fastapi import APIRouter

router = APIRouter(tags=["Health"])


@router.get("/health")
def health_check():
    """Simple health check endpoint."""
    return {"status": "healthy", "service": "hiring-copilot"}
