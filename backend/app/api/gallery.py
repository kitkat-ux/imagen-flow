from __future__ import annotations
from datetime import datetime
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.config import get_settings
from ..db.models import GeneratedImage
from ..db.session import get_db

router = APIRouter(prefix="/api/images", tags=["gallery"])


class ImageOut(BaseModel):
    id: str
    run_id: str | None
    node_id: str
    file_path: str
    thumbnail_path: str | None
    prompt: str | None
    created_at: datetime

    class Config:
        from_attributes = True


@router.get("", response_model=list[ImageOut])
async def list_images(
    db: AsyncSession = Depends(get_db),
    limit: int = Query(50, le=200),
    offset: int = 0,
    prompt: str | None = None,
):
    stmt = select(GeneratedImage).order_by(GeneratedImage.created_at.desc()).limit(limit).offset(offset)
    if prompt:
        stmt = stmt.where(GeneratedImage.prompt.ilike(f"%{prompt}%"))
    rows = (await db.execute(stmt)).scalars().all()
    return rows


@router.get("/{img_id}/file")
async def get_image_file(img_id: str, db: AsyncSession = Depends(get_db)):
    img = (await db.execute(select(GeneratedImage).where(GeneratedImage.id == img_id))).scalar_one_or_none()
    if not img:
        raise HTTPException(404, "Image không tồn tại")
    abs_path = Path(get_settings().DATA_DIR) / img.file_path
    if not abs_path.is_file():
        raise HTTPException(404, "File không tồn tại trên đĩa")
    return FileResponse(abs_path, media_type="image/png")


@router.get("/{img_id}/thumb")
async def get_image_thumb(img_id: str, db: AsyncSession = Depends(get_db)):
    img = (await db.execute(select(GeneratedImage).where(GeneratedImage.id == img_id))).scalar_one_or_none()
    if not img or not img.thumbnail_path:
        raise HTTPException(404)
    abs_path = Path(get_settings().DATA_DIR) / img.thumbnail_path
    if not abs_path.is_file():
        raise HTTPException(404)
    return FileResponse(abs_path, media_type="image/webp")


@router.delete("/{img_id}")
async def delete_image(img_id: str, db: AsyncSession = Depends(get_db)):
    img = (await db.execute(select(GeneratedImage).where(GeneratedImage.id == img_id))).scalar_one_or_none()
    if not img:
        raise HTTPException(404)
    # Xoá file
    base = Path(get_settings().DATA_DIR)
    for p in [img.file_path, img.thumbnail_path]:
        if p:
            ap = base / p
            if ap.is_file():
                try:
                    ap.unlink()
                except OSError:
                    pass
    await db.delete(img)
    await db.commit()
    return {"ok": True}
