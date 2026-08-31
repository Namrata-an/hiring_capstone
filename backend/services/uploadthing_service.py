"""UploadThing integration — uploads PDFs through UploadThing's v7 REST API.

The backend acts as a proxy so the secret key never reaches the browser.
"""
import logging
from typing import Optional

import httpx

from config import UPLOADTHING_SECRET_KEY

logger = logging.getLogger(__name__)

UT_API_BASE = "https://api.uploadthing.com"


class UploadThingError(RuntimeError):
    """Raised when the UploadThing REST API rejects an upload."""


async def upload_pdf(content: bytes, filename: str) -> dict:
    """Upload a PDF to UploadThing CDN. Returns its public url and storage key.

    Two-step protocol:
      1. POST /v7/prepareUpload → presigned ingest URL
      2. PUT bytes to that URL
    """
    if not UPLOADTHING_SECRET_KEY:
        raise UploadThingError("UPLOADTHING_SECRET_KEY is not configured")

    headers = {
        "x-uploadthing-api-key": UPLOADTHING_SECRET_KEY,
        "Content-Type": "application/json",
    }
    prep_body = {
        "fileName": filename,
        "fileSize": len(content),
        "fileType": "application/pdf",
        "acl": "public-read",
        "contentDisposition": "inline",
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        prep = await client.post(
            f"{UT_API_BASE}/v7/prepareUpload", headers=headers, json=prep_body
        )
        if prep.status_code >= 400:
            logger.error("UploadThing prepare failed: %s %s", prep.status_code, prep.text)
            raise UploadThingError(f"prepare failed: {prep.status_code} {prep.text[:200]}")
        slot = prep.json()
        presigned_url: Optional[str] = slot.get("url")
        file_key: Optional[str] = slot.get("key")
        if not presigned_url or not file_key:
            raise UploadThingError(f"unexpected prepareUpload response: {slot}")

        # Ingest endpoint expects multipart/form-data with a `file` field.
        files = {"file": (filename, content, "application/pdf")}
        put = await client.put(presigned_url, files=files)
        if put.status_code >= 400:
            logger.error("UploadThing PUT failed: %s %s", put.status_code, put.text)
            raise UploadThingError(f"upload failed: {put.status_code} {put.text[:200]}")
        result = put.json() if put.headers.get("content-type", "").startswith("application/json") else {}

    file_url: Optional[str] = result.get("url") or f"https://utfs.io/f/{file_key}"
    return {"url": file_url, "key": file_key}


async def download_pdf(url: str) -> bytes:
    """Fetch a PDF from a previously-uploaded URL (or any HTTPS URL)."""
    async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        return resp.content
