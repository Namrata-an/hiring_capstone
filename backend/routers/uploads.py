"""File upload endpoints — proxies the upload to UploadThing CDN."""
import logging

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status

from config import MAX_UPLOAD_SIZE_MB
from models import User
from services.auth_service import get_current_user
from services.uploadthing_service import upload_pdf, UploadThingError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/uploads", tags=["Uploads"])


@router.post("/resume")
async def upload_resume(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """Upload a PDF resume to UploadThing CDN. Returns the public file URL."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are supported",
        )

    content = await file.read()
    if len(content) > MAX_UPLOAD_SIZE_MB * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File size exceeds {MAX_UPLOAD_SIZE_MB}MB limit",
        )

    try:
        result = await upload_pdf(content, file.filename)
    except UploadThingError as e:
        logger.exception("UploadThing upload failed")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Resume CDN upload failed: {e}",
        ) from e

    return {"url": result["url"], "key": result.get("key")}
