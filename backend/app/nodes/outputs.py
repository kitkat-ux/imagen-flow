from __future__ import annotations
import base64
import io
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

import httpx
from PIL import Image

from ..core.config import get_settings
from ..db.models import GeneratedImage
from .base import BaseNode, NodeSpec, PortSpec, ParamSpec, PORT_IMAGE
from .registry import register


def _is_url(value: str) -> bool:
    return isinstance(value, str) and (value.startswith("http://") or value.startswith("https://"))


async def _image_value_to_b64(image_value: str) -> str:
    if _is_url(image_value):
        async with httpx.AsyncClient(timeout=120) as http:
            r = await http.get(image_value)
            r.raise_for_status()
            return base64.b64encode(r.content).decode("ascii")
    if image_value.startswith("data:image/") and "," in image_value:
        return image_value.split(",", 1)[1]
    return image_value


def _save_image_to_disk(image_b64: str, ctx) -> tuple[str, str]:
    """Decode base64 -> PNG + thumbnail. Return (relative_image_path, relative_thumb_path)."""
    settings = get_settings()
    raw = base64.b64decode(image_b64)
    img = Image.open(io.BytesIO(raw))

    now = datetime.utcnow()
    sub = f"{now:%Y/%m}"
    img_dir = settings.data_dir_path / "images" / sub
    thumb_dir = settings.data_dir_path / "thumbnails" / sub
    img_dir.mkdir(parents=True, exist_ok=True)
    thumb_dir.mkdir(parents=True, exist_ok=True)

    file_id = str(uuid.uuid4())
    img_path = img_dir / f"{file_id}.png"
    thumb_path = thumb_dir / f"{file_id}.webp"

    img.save(img_path, format="PNG")
    thumb = img.copy()
    thumb.thumbnail((512, 512))
    thumb.save(thumb_path, format="WEBP", quality=85)

    # store relative paths under DATA_DIR
    return (
        str(img_path.relative_to(settings.data_dir_path)).replace("\\", "/"),
        str(thumb_path.relative_to(settings.data_dir_path)).replace("\\", "/"),
    )


@register
class PreviewImageNode(BaseNode):
    """Hiển thị ảnh trên UI mà KHÔNG lưu vào gallery."""
    spec = NodeSpec(
        type="output.preview",
        category="output",
        label="Preview",
        description="Hiển thị ảnh trên canvas, không lưu vào gallery.",
        inputs=[PortSpec(name="image", type=PORT_IMAGE, label="Image")],
        outputs=[PortSpec(name="image", type=PORT_IMAGE, label="Pass-through")],
        params=[],
    )

    async def execute(self, params: dict[str, Any], inputs: dict[str, Any], ctx) -> dict[str, Any]:
        image_value = inputs.get("image")
        if not image_value:
            raise ValueError("Không có ảnh input.")
        # Pass through
        image_b64 = await _image_value_to_b64(image_value)
        return {"image": image_value, "_preview_b64": image_b64}


@register
class SaveImageNode(BaseNode):
    """Lưu ảnh vào filesystem + DB (gallery)."""
    spec = NodeSpec(
        type="output.save",
        category="output",
        label="Save Image",
        description="Lưu ảnh vào filesystem và gallery.",
        inputs=[
            PortSpec(name="image", type=PORT_IMAGE, label="Image"),
            PortSpec(name="prompt", type="string", label="Prompt (optional)", optional=True),
        ],
        outputs=[
            PortSpec(name="image_id", type="string", label="Image ID"),
        ],
        params=[],
    )

    async def execute(self, params: dict[str, Any], inputs: dict[str, Any], ctx) -> dict[str, Any]:
        image_value = inputs.get("image")
        if not image_value:
            raise ValueError("Không có ảnh input.")
        image_b64 = await _image_value_to_b64(image_value)
        rel_img, rel_thumb = _save_image_to_disk(image_b64, ctx)

        gi = GeneratedImage(
            run_id=ctx.run_id,
            node_id=ctx.current_node_id or "",
            file_path=rel_img,
            thumbnail_path=rel_thumb,
            prompt=inputs.get("prompt"),
            params_json=params,
        )
        ctx.db.add(gi)
        await ctx.db.flush()
        return {"image_id": gi.id, "_preview_b64": image_b64}
