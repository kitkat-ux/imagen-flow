from __future__ import annotations
import base64
from openai import AsyncOpenAI


class OpenAIProvider:
    def __init__(self, api_key: str):
        if not api_key:
            raise ValueError("OpenAI API key chưa được cấu hình. Vào Settings để nhập.")
        self.client = AsyncOpenAI(api_key=api_key)

    async def generate_image(
        self,
        *,
        prompt: str,
        model: str = "gpt-image-1",
        size: str = "1024x1024",
        quality: str = "medium",
        n: int = 1,
    ) -> str:
        """Return base64-encoded PNG of the first image."""
        kwargs: dict = {
            "model": model,
            "prompt": prompt,
            "size": size,
            "n": n,
        }
        # Quality param chỉ áp dụng cho gpt-image-*; với dall-e-3 dùng giá trị khác
        if model.startswith("gpt-image"):
            kwargs["quality"] = quality
        elif model == "dall-e-3":
            kwargs["quality"] = "hd" if quality in ("high", "auto") else "standard"

        resp = await self.client.images.generate(**kwargs)
        data = resp.data[0]
        # OpenAI mặc định trả b64_json cho gpt-image-1; với dall-e-3 mặc định trả url
        if getattr(data, "b64_json", None):
            return data.b64_json
        if getattr(data, "url", None):
            # tải về và encode base64
            import httpx
            async with httpx.AsyncClient(timeout=60) as http:
                r = await http.get(data.url)
                r.raise_for_status()
                return base64.b64encode(r.content).decode("ascii")
        raise RuntimeError("OpenAI response không có b64_json hoặc url.")
