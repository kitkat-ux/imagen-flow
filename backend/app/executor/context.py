from __future__ import annotations
import json
import random
from typing import TYPE_CHECKING
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.security import decrypt_value
from ..db.models import Setting
from ..providers.openai_provider import OpenAIProvider
from ..providers.weryai_provider import WeryAIProvider

if TYPE_CHECKING:
    from .runner import RunBroadcaster


class ExecutionContext:
    def __init__(self, db: AsyncSession, run_id: str, broadcaster: "RunBroadcaster | None" = None):
        self.db = db
        self.run_id = run_id
        self.broadcaster = broadcaster
        self.current_node_id: str | None = None
        self._openai: OpenAIProvider | None = None
        self._weryai: WeryAIProvider | None = None

    async def get_api_key(self, key: str) -> str | None:
        result = await self.db.execute(select(Setting).where(Setting.key == key))
        setting = result.scalar_one_or_none()
        if not setting:
            return None
        try:
            return decrypt_value(setting.value_encrypted)
        except Exception:
            return None

    async def get_api_keys(self, key: str) -> list[str]:
        raw = await self.get_api_key(key)
        if not raw:
            return []
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, list):
                return [str(item).strip() for item in parsed if str(item).strip()]
        except Exception:
            pass
        raw = raw.strip()
        return [raw] if raw else []

    async def get_openai_provider(self) -> OpenAIProvider:
        if self._openai is None:
            api_key = await self.get_api_key("openai.api_key")
            if not api_key:
                raise ValueError("Chưa cấu hình OpenAI API key. Vào trang Settings để nhập.")
            self._openai = OpenAIProvider(api_key)
        return self._openai

    async def get_weryai_provider(self) -> WeryAIProvider:
        if self._weryai is None:
            api_keys = await self.get_api_keys("weryai.api_keys")
            if not api_keys:
                legacy_key = await self.get_api_key("weryai.api_key")
                api_keys = [legacy_key] if legacy_key else []
            if not api_keys:
                raise ValueError("Chưa cấu hình WeryAI API key. Vào trang Settings để nhập.")
            api_key = random.choice(api_keys)
            self._weryai = WeryAIProvider(api_key)
        return self._weryai
