from __future__ import annotations
from typing import Any

from .base import BaseNode, NodeSpec, PortSpec, ParamSpec, PORT_STRING, PORT_IMAGE
from .registry import register


# Aspect ratios hỗ trợ bởi GPT_IMAGE_2 cho text-to-image (đầy đủ)
GPT_IMAGE_2_T2I_RATIOS = [
    "1:1", "2:3", "3:4", "3:2", "4:3", "4:5", "5:4",
    "16:9(1k)", "16:9(2k)", "16:9(4k)",
    "9:16(1k)", "9:16(2k)", "9:16(4k)",
]

# Aspect ratios hỗ trợ bởi GPT_IMAGE_2 cho image-to-image (không có 4:5, 5:4)
GPT_IMAGE_2_I2I_RATIOS = [
    "1:1", "2:3", "3:4", "3:2", "4:3",
    "16:9(1k)", "16:9(2k)", "16:9(4k)",
    "9:16(1k)", "9:16(2k)", "9:16(4k)",
]

GPT_IMAGE_2_QUALITY = ["low", "medium", "high"]


@register
class WeryAIGptImage2T2INode(BaseNode):
    """Sinh ảnh bằng WeryAI GPT_IMAGE_2 (text-to-image)."""
    spec = NodeSpec(
        type="weryai.gpt_image_2.text2image",
        category="generator",
        label="WeryAI · GPT Image 2 (T2I)",
        description="Text-to-image qua WeryAI, model GPT_IMAGE_2.",
        inputs=[
            PortSpec(name="prompt", type=PORT_STRING, label="Prompt"),
        ],
        outputs=[
            PortSpec(name="image", type=PORT_IMAGE, label="Image"),
        ],
        params=[
            ParamSpec(
                name="aspect_ratio", type="select", label="Aspect Ratio",
                default="1:1", options=GPT_IMAGE_2_T2I_RATIOS,
            ),
            ParamSpec(
                name="quality", type="select", label="Quality",
                default="medium", options=GPT_IMAGE_2_QUALITY,
            ),
            ParamSpec(
                name="negative_prompt", type="textarea", label="Negative Prompt",
                default="", placeholder="(tuỳ chọn) các yếu tố muốn loại trừ",
            ),
        ],
    )

    async def execute(self, params: dict[str, Any], inputs: dict[str, Any], ctx) -> dict[str, Any]:
        prompt = (inputs.get("prompt") or "").strip()
        if not prompt:
            raise ValueError("Prompt rỗng — nối node text vào input 'prompt'.")
        provider = await ctx.get_weryai_provider()
        result = await provider.generate_text_to_image_result(
            model="GPT_IMAGE_2",
            prompt=prompt,
            aspect_ratio=params.get("aspect_ratio") or "1:1",
            quality=params.get("quality") or "medium",
            negative_prompt=(params.get("negative_prompt") or "").strip() or None,
        )
        return {"image": result["url"], "_preview_b64": result["b64"]}


@register
class WeryAIGptImage2I2INode(BaseNode):
    """Image-to-image bằng WeryAI GPT_IMAGE_2.

    Input `image` chấp nhận cả:
    - base64 PNG (vd từ output của một node generator trước đó)
    - URL ảnh (vd từ node `input.image_url`)

    Provider sẽ tự upload base64 lên WeryAI để lấy URL trước khi submit task.
    """
    spec = NodeSpec(
        type="weryai.gpt_image_2.image2image",
        category="generator",
        label="WeryAI · GPT Image 2 (I2I)",
        description="Image-to-image qua WeryAI, model GPT_IMAGE_2. Supports multiple reference images.",
        inputs=[
            PortSpec(name="prompt", type=PORT_STRING, label="Prompt"),
            PortSpec(name="image", type=PORT_IMAGE, label="Reference Image 1"),
            PortSpec(name="image_2", type=PORT_IMAGE, label="Reference Image 2", optional=True),
            PortSpec(name="image_3", type=PORT_IMAGE, label="Reference Image 3", optional=True),
            PortSpec(name="image_4", type=PORT_IMAGE, label="Reference Image 4", optional=True),
        ],
        outputs=[
            PortSpec(name="image", type=PORT_IMAGE, label="Image"),
        ],
        params=[
            ParamSpec(
                name="aspect_ratio", type="select", label="Aspect Ratio",
                default="1:1", options=GPT_IMAGE_2_I2I_RATIOS,
            ),
            ParamSpec(
                name="quality", type="select", label="Quality",
                default="medium", options=GPT_IMAGE_2_QUALITY,
            ),
            ParamSpec(
                name="negative_prompt", type="textarea", label="Negative Prompt",
                default="", placeholder="(tuỳ chọn) các yếu tố muốn loại trừ",
            ),
        ],
    )

    async def execute(self, params: dict[str, Any], inputs: dict[str, Any], ctx) -> dict[str, Any]:
        prompt = (inputs.get("prompt") or "").strip()
        if not prompt:
            raise ValueError("Prompt rỗng — nối node text vào input 'prompt'.")
        image_inputs: list[Any] = []
        for name in ("image", "image_2", "image_3", "image_4"):
            value = inputs.get(name)
            if isinstance(value, list):
                image_inputs.extend([item for item in value if item])
            elif value:
                image_inputs.append(value)
        if not image_inputs:
            raise ValueError("Thieu reference image - noi it nhat 1 input image.")
        provider = await ctx.get_weryai_provider()
        result = await provider.generate_image_to_image_result(
            model="GPT_IMAGE_2",
            prompt=prompt,
            image_input=image_inputs,
            aspect_ratio=params.get("aspect_ratio") or "1:1",
            quality=params.get("quality") or "medium",
            negative_prompt=(params.get("negative_prompt") or "").strip() or None,
        )
        return {"image": result["url"], "_preview_b64": result["b64"]}
