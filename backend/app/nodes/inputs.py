from __future__ import annotations
from typing import Any

from .base import BaseNode, NodeSpec, PortSpec, ParamSpec, PORT_STRING, PORT_NUMBER, PORT_IMAGE
from .registry import register


@register
class TextPromptNode(BaseNode):
    spec = NodeSpec(
        type="input.text",
        category="input",
        label="Text Prompt",
        description="Nhập text prompt thủ công.",
        inputs=[],
        outputs=[PortSpec(name="text", type=PORT_STRING, label="Text")],
        params=[
            ParamSpec(
                name="value", type="textarea", label="Prompt",
                default="A serene mountain landscape at sunrise, ultra realistic",
                placeholder="Nhập prompt của bạn ở đây..."
            ),
        ],
    )

    async def execute(self, params: dict[str, Any], inputs: dict[str, Any], ctx) -> dict[str, Any]:
        return {"text": params.get("value", "")}


@register
class PromptVariationsNode(BaseNode):
    spec = NodeSpec(
        type="input.prompt_variations",
        category="input",
        label="Prompt Variations",
        description="Enter multiple prompt lines for batch generation.",
        inputs=[],
        outputs=[PortSpec(name="text", type=PORT_STRING, label="Text")],
        params=[
            ParamSpec(
                name="values",
                type="textarea",
                label="Prompts",
                default="A cinematic portrait, soft window light\nA cinematic portrait, neon city night\nA cinematic portrait, studio fashion lighting",
                placeholder="One prompt per line",
            ),
            ParamSpec(name="index", type="number", label="Active Index", default=0, min=0, max=999),
        ],
    )

    async def execute(self, params: dict[str, Any], inputs: dict[str, Any], ctx) -> dict[str, Any]:
        lines = [
            line.strip()
            for line in str(params.get("values") or "").splitlines()
            if line.strip()
        ]
        if not lines:
            raise ValueError("Prompt Variations is empty.")
        try:
            index = int(float(params.get("index") or 0))
        except (TypeError, ValueError):
            index = 0
        index = max(0, min(index, len(lines) - 1))
        return {"text": lines[index]}


@register
class NumberNode(BaseNode):
    spec = NodeSpec(
        type="input.number",
        category="input",
        label="Number",
        description="Hằng số kiểu số.",
        inputs=[],
        outputs=[PortSpec(name="value", type=PORT_NUMBER, label="Value")],
        params=[
            ParamSpec(name="value", type="number", label="Value", default=1, min=-999999, max=999999),
        ],
    )

    async def execute(self, params: dict[str, Any], inputs: dict[str, Any], ctx) -> dict[str, Any]:
        try:
            return {"value": float(params.get("value", 0))}
        except (TypeError, ValueError):
            return {"value": 0.0}


@register
class ImageUrlNode(BaseNode):
    """Nhập trực tiếp URL ảnh để dùng làm reference cho các node image-to-image.

    Output là string (URL), nhưng được khai báo type 'image' để có thể nối thẳng
    vào các node nhận PORT_IMAGE. Provider sẽ tự xử lý URL vs base64.
    """
    spec = NodeSpec(
        type="input.image_url",
        category="input",
        label="Image URL",
        description="Paste URL ảnh (jpg/png/webp) để làm reference.",
        inputs=[],
        outputs=[PortSpec(name="image", type=PORT_IMAGE, label="Image (URL)")],
        params=[
            ParamSpec(
                name="url", type="string", label="URL",
                default="",
                placeholder="https://example.com/photo.jpg",
            ),
        ],
    )

    async def execute(self, params: dict[str, Any], inputs: dict[str, Any], ctx) -> dict[str, Any]:
        url = (params.get("url") or "").strip()
        if not url:
            raise ValueError("URL rỗng — paste link ảnh vào trường URL.")
        if not (url.startswith("http://") or url.startswith("https://")):
            raise ValueError("URL phải bắt đầu bằng http:// hoặc https://")
        return {"image": url}


@register
class LocalImageNode(BaseNode):
    """Image input uploaded by the app to public storage."""
    spec = NodeSpec(
        type="input.local_image",
        category="input",
        label="Local Image",
        description="Upload local image to storage and output a public image URL.",
        inputs=[],
        outputs=[PortSpec(name="image", type=PORT_IMAGE, label="Image (URL)")],
        params=[
            ParamSpec(
                name="url",
                type="file",
                label="Image File",
                default="",
                placeholder="Upload an image file",
            ),
        ],
    )

    async def execute(self, params: dict[str, Any], inputs: dict[str, Any], ctx) -> dict[str, Any]:
        url = (params.get("url") or "").strip()
        if not url:
            raise ValueError("No uploaded image URL. Choose an image file first.")
        if not (url.startswith("http://") or url.startswith("https://")):
            raise ValueError("Uploaded image must resolve to a public http(s) URL.")
        return {"image": url}
