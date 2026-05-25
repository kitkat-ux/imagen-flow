from __future__ import annotations
import json
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.security import encrypt_value, decrypt_value
from ..db.models import Setting
from ..db.session import get_db

router = APIRouter(prefix="/api/settings", tags=["settings"])


class ProviderKeyIn(BaseModel):
    api_key: str


class ProviderKeyStatus(BaseModel):
    configured: bool
    masked: str | None = None


class ProviderKeysStatus(BaseModel):
    configured: bool
    masked: list[str] = []
    count: int = 0


class ProviderKeyDeleteIn(BaseModel):
    index: int


# Map ngắn từ URL slug -> setting key trong DB
_PROVIDER_KEYS = {
    "openai": "openai.api_key",
    "weryai": "weryai.api_key",
}


def _mask(val: str) -> str:
    return val[:3] + "..." + val[-4:] if len(val) > 8 else "***"


def _load_key_list(raw: str | None) -> list[str]:
    if not raw:
        return []
    raw = raw.strip()
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, list):
            return [str(item).strip() for item in parsed if str(item).strip()]
    except Exception:
        pass
    return [raw]


async def _get_setting_value(key: str, db: AsyncSession) -> str | None:
    s = (await db.execute(select(Setting).where(Setting.key == key))).scalar_one_or_none()
    if not s:
        return None
    try:
        return decrypt_value(s.value_encrypted)
    except Exception:
        return None


async def _set_setting_value(key: str, value: str, db: AsyncSession) -> None:
    enc = encrypt_value(value)
    s = (await db.execute(select(Setting).where(Setting.key == key))).scalar_one_or_none()
    if s:
        s.value_encrypted = enc
    else:
        db.add(Setting(key=key, value_encrypted=enc))


async def _get_status(provider: str, db: AsyncSession) -> ProviderKeyStatus:
    key = _PROVIDER_KEYS.get(provider)
    if not key:
        raise HTTPException(404, f"Provider không hỗ trợ: {provider}")
    s = (await db.execute(select(Setting).where(Setting.key == key))).scalar_one_or_none()
    if not s:
        return ProviderKeyStatus(configured=False)
    try:
        val = decrypt_value(s.value_encrypted)
        return ProviderKeyStatus(configured=True, masked=_mask(val))
    except Exception:
        return ProviderKeyStatus(configured=False)


async def _set_key(provider: str, api_key: str, db: AsyncSession) -> ProviderKeyStatus:
    key = _PROVIDER_KEYS.get(provider)
    if not key:
        raise HTTPException(404, f"Provider không hỗ trợ: {provider}")
    api_key = api_key.strip()
    if not api_key:
        raise HTTPException(400, "api_key không được rỗng")
    enc = encrypt_value(api_key)
    s = (await db.execute(select(Setting).where(Setting.key == key))).scalar_one_or_none()
    if s:
        s.value_encrypted = enc
    else:
        s = Setting(key=key, value_encrypted=enc)
        db.add(s)
    await db.commit()
    return ProviderKeyStatus(configured=True, masked=_mask(api_key))


async def _delete_key(provider: str, db: AsyncSession) -> dict:
    key = _PROVIDER_KEYS.get(provider)
    if not key:
        raise HTTPException(404, f"Provider không hỗ trợ: {provider}")
    s = (await db.execute(select(Setting).where(Setting.key == key))).scalar_one_or_none()
    if s:
        await db.delete(s)
        await db.commit()
    return {"ok": True}


# ---------- OpenAI (giữ URL cũ cho tương thích) ----------

@router.get("/openai", response_model=ProviderKeyStatus)
async def get_openai_status(db: AsyncSession = Depends(get_db)):
    return await _get_status("openai", db)


@router.put("/openai", response_model=ProviderKeyStatus)
async def set_openai_key(payload: ProviderKeyIn, db: AsyncSession = Depends(get_db)):
    return await _set_key("openai", payload.api_key, db)


@router.delete("/openai")
async def delete_openai_key(db: AsyncSession = Depends(get_db)):
    return await _delete_key("openai", db)


# ---------- WeryAI ----------

@router.get("/weryai", response_model=ProviderKeysStatus)
async def get_weryai_status(db: AsyncSession = Depends(get_db)):
    raw = await _get_setting_value("weryai.api_keys", db)
    keys = _load_key_list(raw)
    if not keys:
        legacy = await _get_setting_value("weryai.api_key", db)
        keys = _load_key_list(legacy)
    return ProviderKeysStatus(configured=bool(keys), masked=[_mask(key) for key in keys], count=len(keys))


@router.put("/weryai", response_model=ProviderKeysStatus)
async def set_weryai_key(payload: ProviderKeyIn, db: AsyncSession = Depends(get_db)):
    api_key = payload.api_key.strip()
    if not api_key:
        raise HTTPException(400, "api_key khong duoc rong")
    raw = await _get_setting_value("weryai.api_keys", db)
    keys = _load_key_list(raw)
    if not keys:
        legacy = await _get_setting_value("weryai.api_key", db)
        keys = _load_key_list(legacy)
    if api_key not in keys:
        keys.append(api_key)
    await _set_setting_value("weryai.api_keys", json.dumps(keys), db)
    await db.commit()
    return ProviderKeysStatus(configured=True, masked=[_mask(key) for key in keys], count=len(keys))


@router.delete("/weryai")
async def delete_weryai_key(db: AsyncSession = Depends(get_db)):
    for key in ("weryai.api_keys", "weryai.api_key"):
        s = (await db.execute(select(Setting).where(Setting.key == key))).scalar_one_or_none()
        if s:
            await db.delete(s)
    await db.commit()
    return {"ok": True}


@router.delete("/weryai/key")
async def delete_one_weryai_key(payload: ProviderKeyDeleteIn, db: AsyncSession = Depends(get_db)):
    raw = await _get_setting_value("weryai.api_keys", db)
    keys = _load_key_list(raw)
    if not keys:
        legacy = await _get_setting_value("weryai.api_key", db)
        keys = _load_key_list(legacy)
    if payload.index < 0 or payload.index >= len(keys):
        raise HTTPException(400, "index khong hop le")
    keys.pop(payload.index)
    if keys:
        await _set_setting_value("weryai.api_keys", json.dumps(keys), db)
    else:
        for key in ("weryai.api_keys", "weryai.api_key"):
            s = (await db.execute(select(Setting).where(Setting.key == key))).scalar_one_or_none()
            if s:
                await db.delete(s)
    await db.commit()
    return ProviderKeysStatus(configured=bool(keys), masked=[_mask(key) for key in keys], count=len(keys))
