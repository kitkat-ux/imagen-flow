from __future__ import annotations
import asyncio
import base64
import io
import logging
from typing import Any
import httpx

logger = logging.getLogger(__name__)

BASE_URL = "https://api.weryai.com"
DEFAULT_TIMEOUT = 60
POLL_INTERVAL = 30      # giây
POLL_MAX_WAIT = 600.0    # 10 phút


class WeryAIError(RuntimeError):
    """Lỗi từ WeryAI API."""
    def __init__(self, message: str, status: int | None = None, raw: dict | None = None):
        super().__init__(message)
        self.status = status
        self.raw = raw


class WeryAIProvider:
    """Client cho WeryAI Generation API.

    Mọi method high-level (`generate_text_to_image`, `generate_image_to_image`)
    đều trả về **base64-encoded PNG** để khớp interface với các provider khác,
    giúp node downstream (preview/save) không phải biết về URL.
    """

    def __init__(self, api_key: str):
        if not api_key:
            raise ValueError("WeryAI API key chưa cấu hình. Vào Settings để nhập.")
        self.api_key = api_key

    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.api_key}"}

    # ------------------------- low-level -------------------------

    async def submit_text_to_image(
        self,
        *,
        model: str,
        prompt: str,
        aspect_ratio: str,
        quality: str | None = None,
        negative_prompt: str | None = None,
        image_number: int = 1,
        resolution: str | None = None,
    ) -> str:
        """Trả về task_id đầu tiên."""
        payload: dict[str, Any] = {
            "model": model,
            "prompt": prompt,
            "aspect_ratio": aspect_ratio,
            "image_number": image_number,
        }
        if quality:
            payload["quality"] = quality
        if negative_prompt:
            payload["negative_prompt"] = negative_prompt
        if resolution:
            payload["resolution"] = resolution

        async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as http:
            r = await http.post(
                f"{BASE_URL}/v1/generation/text-to-image",
                headers={**self._headers(), "Content-Type": "application/json"},
                json=payload,
            )
        return self._extract_task_id(r)

    async def submit_image_to_image(
        self,
        *,
        model: str,
        prompt: str,
        images: list[str],
        aspect_ratio: str,
        quality: str | None = None,
        negative_prompt: str | None = None,
        image_number: int = 1,
        resolution: str | None = None,
    ) -> str:
        payload: dict[str, Any] = {
            "model": model,
            "prompt": prompt,
            "images": images,
            "aspect_ratio": aspect_ratio,
            "image_number": image_number,
        }
        if quality:
            payload["quality"] = quality
        if negative_prompt:
            payload["negative_prompt"] = negative_prompt
        if resolution:
            payload["resolution"] = resolution

        async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as http:
            r = await http.post(
                f"{BASE_URL}/v1/generation/image-to-image",
                headers={**self._headers(), "Content-Type": "application/json"},
                json=payload,
            )
        return self._extract_task_id(r)

    async def poll_task(self, task_id: str, *, max_wait: float = POLL_MAX_WAIT) -> dict[str, Any]:
        """Poll cho đến khi task succeed/failed. Trả về `data` object cuối cùng."""
        deadline = asyncio.get_event_loop().time() + max_wait
        async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as http:
            while True:
                r = await http.get(
                    f"{BASE_URL}/v1/generation/{task_id}/status",
                    headers=self._headers(),
                )
                body = self._json_or_raise(r)
                data = body.get("data") or {}
                ts = data.get("task_status")
                if ts == "succeed":
                    return data
                if ts == "failed":
                    raise WeryAIError(
                        f"Task {task_id} failed: {data.get('msg') or 'unknown error'}",
                        raw=body,
                    )
                if asyncio.get_event_loop().time() >= deadline:
                    raise WeryAIError(f"Task {task_id} timeout sau {max_wait}s (status={ts})")
                await asyncio.sleep(POLL_INTERVAL)

    async def upload_file(self, *, content: bytes, filename: str = "upload.png", content_type: str = "image/png") -> str:
        """Upload bytes, trả về URL public của file."""
        files = {"file": (filename, io.BytesIO(content), content_type)}
        async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT * 2) as http:
            r = await http.post(
                f"{BASE_URL}/v1/generation/upload-file",
                headers=self._headers(),
                files=files,
            )
        body = self._json_or_raise(r)
        urls = (body.get("data") or {}).get("object_url_list") or []
        if not urls:
            raise WeryAIError("Upload thành công nhưng không có URL trả về.", raw=body)
        return urls[0]

    # ------------------------- helpers -------------------------

    @staticmethod
    def _json_or_raise(r: httpx.Response) -> dict:
        try:
            body = r.json()
        except Exception:
            raise WeryAIError(f"HTTP {r.status_code}: {r.text[:300]}")
        logger.debug("WeryAI response: HTTP=%s body=%s", r.status_code, str(body)[:500])
        if r.status_code >= 400:
            msg = body.get("message") or body.get("desc") or r.text
            raise WeryAIError(f"HTTP {r.status_code}: {msg}", status=body.get("status"), raw=body)
        # Business status check - chấp nhận nhiều dạng "success"
        # (WeryAI thực tế có thể trả 0, "0", 200, "success", None, hoặc bỏ field này)
        status = body.get("status")
        SUCCESS_VALUES = (0, "0", None, 200, "200", "success", "ok", "OK", "Success")
        if status in SUCCESS_VALUES:
            return body
        # Fallback: nếu data có vẻ hợp lệ (có task_ids/task_id/images/object_url_list)
        # thì coi như success bất kể status field nói gì
        data = body.get("data") or {}
        if data.get("task_ids") or data.get("task_id") or data.get("images") or data.get("object_url_list"):
            return body
        # Còn lại mới raise
        raise WeryAIError(
            body.get("message") or body.get("desc") or f"Unknown API error (status={status})",
            status=status, raw=body,
        )

    def _extract_task_id(self, r: httpx.Response) -> str:
        body = self._json_or_raise(r)
        data = body.get("data") or {}
        task_ids = data.get("task_ids") or []
        if not task_ids:
            raise WeryAIError("Không nhận được task_id từ WeryAI.", raw=body)
        return task_ids[0]

    @staticmethod
    def _is_url(s: str) -> bool:
        return isinstance(s, str) and (s.startswith("http://") or s.startswith("https://"))

    async def _materialize_input_as_url(self, image_value: str) -> str:
        """Nhận base64 hoặc URL, trả về URL (upload nếu cần)."""
        if self._is_url(image_value):
            return image_value
        if image_value.startswith("data:image/") and "," in image_value:
            image_value = image_value.split(",", 1)[1]
        try:
            raw = base64.b64decode(image_value, validate=True)
        except Exception as exc:
            raise WeryAIError(
                "Reference Image phai la output image hoac URL anh, khong phai text prompt."
            ) from exc
        return await self.upload_file(content=raw)

    async def _download_as_base64(self, url: str) -> str:
        async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT * 2) as http:
            r = await http.get(url)
            r.raise_for_status()
            return base64.b64encode(r.content).decode("ascii")

    # ------------------------- high-level -------------------------

    async def generate_text_to_image(
        self,
        *,
        model: str = "GPT_IMAGE_2",
        prompt: str,
        aspect_ratio: str = "1:1",
        quality: str | None = "medium",
        negative_prompt: str | None = None,
    ) -> str:
        """Submit → poll → download → return base64 PNG."""
        result = await self.generate_text_to_image_result(
            model=model,
            prompt=prompt,
            aspect_ratio=aspect_ratio,
            quality=quality,
            negative_prompt=negative_prompt,
        )
        return result["b64"]

    async def generate_text_to_image_result(
        self,
        *,
        model: str = "GPT_IMAGE_2",
        prompt: str,
        aspect_ratio: str = "1:1",
        quality: str | None = "medium",
        negative_prompt: str | None = None,
    ) -> dict[str, str]:
        task_id = await self.submit_text_to_image(
            model=model,
            prompt=prompt,
            aspect_ratio=aspect_ratio,
            quality=quality,
            negative_prompt=negative_prompt,
            image_number=1,
        )
        logger.info("WeryAI text2image submitted task_id=%s", task_id)
        data = await self.poll_task(task_id)
        images = data.get("images") or []
        if not images:
            raise WeryAIError("Task succeed nhưng không có ảnh trả về.", raw=data)
        return {"url": images[0], "b64": await self._download_as_base64(images[0])}

    async def generate_image_to_image(
        self,
        *,
        model: str = "GPT_IMAGE_2",
        prompt: str,
        image_input: str | list[str],         # base64/URL or list of references
        aspect_ratio: str = "1:1",
        quality: str | None = "medium",
        negative_prompt: str | None = None,
    ) -> str:
        result = await self.generate_image_to_image_result(
            model=model,
            prompt=prompt,
            image_input=image_input,
            aspect_ratio=aspect_ratio,
            quality=quality,
            negative_prompt=negative_prompt,
        )
        return result["b64"]

    async def generate_image_to_image_result(
        self,
        *,
        model: str = "GPT_IMAGE_2",
        prompt: str,
        image_input: str | list[str],
        aspect_ratio: str = "1:1",
        quality: str | None = "medium",
        negative_prompt: str | None = None,
    ) -> dict[str, str]:
        image_inputs = image_input if isinstance(image_input, list) else [image_input]
        ref_urls = [
            await self._materialize_input_as_url(str(item))
            for item in image_inputs
            if item
        ]
        if not ref_urls:
            raise WeryAIError("I2I requires at least one reference image.")
        task_id = await self.submit_image_to_image(
            model=model,
            prompt=prompt,
            images=ref_urls,
            aspect_ratio=aspect_ratio,
            quality=quality,
            negative_prompt=negative_prompt,
            image_number=1,
        )
        logger.info("WeryAI image2image submitted task_id=%s", task_id)
        data = await self.poll_task(task_id)
        images = data.get("images") or []
        if not images:
            raise WeryAIError("Task succeed nhưng không có ảnh trả về.", raw=data)
        return {"url": images[0], "b64": await self._download_as_base64(images[0])}
