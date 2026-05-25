from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.models import Asset
from ..db.session import get_db

router = APIRouter(prefix="/api/assets", tags=["assets"])


class AssetOut(BaseModel):
    id: str
    source: str
    provider: str
    url: str
    filename: str | None
    content_type: str | None
    asset_metadata: dict[str, Any] | None
    created_at: datetime

    class Config:
        from_attributes = True


@router.get("", response_model=list[AssetOut])
async def list_assets(
    db: AsyncSession = Depends(get_db),
    limit: int = Query(100, le=300),
    offset: int = 0,
):
    rows = (await db.execute(
        select(Asset).order_by(Asset.created_at.desc()).limit(limit).offset(offset)
    )).scalars().all()
    return rows
