from __future__ import annotations
from typing import Any

from .base import BaseNode, NodeSpec, PortSpec, ParamSpec, PORT_STRING, PORT_IMAGE
from .registry import register


@register
class OpenAIImageNode(BaseNode):
    """Sinh ảnh từ text prompt qua OpenAI image API.

    Tên model để CONFIG bằng param `model`, mặc định 'gpt-image-1'.
    Khi OpenAI release model mới hơn (gpt-image-2...), chỉ cần đổi trong inspector.
    """
    spec = NodeSpec(
        type="openai.image.generate",
        category="generator",
        label="OpenAI Image",
        description="Sinh ảnh bằng OpenAI image model.",
        inputs=[
            PortSpec(name="prompt", type=PORT_STRING, label="Prompt"),
        ],
        outputs=[
            PortSpec(name="image", type=PORT_IMAGE, label="Image"),
        ],
        params=[
            ParamSpec(
                name="model", type="select", label="Model",
                default="gpt-image-1",
                options=["gpt-image-1", "gpt-image-2", "dall-e-3"],
            ),
            ParamSpec(
                name="size", type="select", label="Size",
                default="1024x1024",
                options=["1024x1024", "1024x1536", "1536x1024", "auto"],
            ),
            ParamSpec(
                name="quality", type="select", label="Quality",
                default="medium",
                options=["low", "medium", "high", "auto"],
            ),
            ParamSpec(
                name="n", type="number", label="Số ảnh", default=1, min=1, max=4,
            ),
        ],
    )

    async def execute(self, params: dict[str, Any], inputs: dict[str, Any], ctx) -> dict[str, Any]:
        prompt = inputs.get("prompt") or ""
        if not prompt:
            raise ValueError("Prompt rỗng - kết nối một node text vào input 'prompt'.")
        provider = await ctx.get_openai_provider()
        image_b64 = await provider.generate_image(
            prompt=prompt,
            model=params.get("model", "gpt-image-1"),
            size=params.get("size", "1024x1024"),
            quality=params.get("quality", "medium"),
            n=int(params.get("n", 1) or 1),
        )
        return {"image": image_b64}
