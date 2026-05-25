from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.config import get_settings
from ..db.models import Asset
from ..db.session import get_db

router = APIRouter(prefix="/api/uploads", tags=["uploads"])

MAX_IMAGE_BYTES = 15 * 1024 * 1024


@router.post("/image")
async def upload_image(file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    cfg = get_settings()
    if cfg.STORAGE_PROVIDER.lower() != "cloudinary":
        raise HTTPException(
            400,
            "Image upload storage is not configured. Set STORAGE_PROVIDER=cloudinary.",
        )
    if not cfg.CLOUDINARY_CLOUD_NAME or not cfg.CLOUDINARY_UPLOAD_PRESET:
        raise HTTPException(
            400,
            "Cloudinary upload is missing CLOUDINARY_CLOUD_NAME or CLOUDINARY_UPLOAD_PRESET.",
        )
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(400, "Only image files are supported.")

    content = await file.read()
    if len(content) > MAX_IMAGE_BYTES:
        raise HTTPException(400, "Image file is too large. Max size is 15MB.")

    data = {"upload_preset": cfg.CLOUDINARY_UPLOAD_PRESET}
    if cfg.CLOUDINARY_FOLDER:
        data["folder"] = cfg.CLOUDINARY_FOLDER
    files = {
        "file": (
            file.filename or "upload.png",
            content,
            file.content_type or "application/octet-stream",
        )
    }

    async with httpx.AsyncClient(timeout=120) as http:
        r = await http.post(
            f"https://api.cloudinary.com/v1_1/{cfg.CLOUDINARY_CLOUD_NAME}/image/upload",
            data=data,
            files=files,
        )

    try:
        body = r.json()
    except Exception as exc:
        raise HTTPException(502, f"Cloudinary returned non-JSON response: {r.text[:200]}") from exc

    if r.status_code >= 400:
        msg = (body.get("error") or {}).get("message") or r.text[:200]
        raise HTTPException(r.status_code, msg)

    url = body.get("secure_url") or body.get("url")
    if not url:
        raise HTTPException(502, "Cloudinary upload succeeded but did not return a URL.")

    asset = Asset(
        source="upload",
        provider="cloudinary",
        url=url,
        filename=file.filename,
        content_type=file.content_type,
        asset_metadata={
            "public_id": body.get("public_id"),
            "width": body.get("width"),
            "height": body.get("height"),
            "format": body.get("format"),
            "bytes": body.get("bytes"),
        },
    )
    db.add(asset)
    await db.commit()
    await db.refresh(asset)

    return {"url": url, "asset_id": asset.id}
