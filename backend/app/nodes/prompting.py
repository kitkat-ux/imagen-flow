from __future__ import annotations
from typing import Any

from .base import BaseNode, NodeSpec, PortSpec, ParamSpec, PORT_STRING
from .registry import register


STYLE_PRESETS: dict[str, str] = {
    "realistic": "photorealistic, natural lighting, true-to-life details, high dynamic range",
    "cinematic": "cinematic lighting, dramatic composition, film still, rich contrast, shallow depth of field",
    "product_photo": "premium product photography, clean studio background, commercial lighting, crisp details",
    "fashion_editorial": "fashion editorial, polished styling, premium magazine look, elegant pose and lighting",
    "anime": "anime illustration, clean line art, expressive character design, vibrant colors",
    "interior": "interior design photography, balanced composition, architectural details, soft daylight",
    "food": "professional food photography, appetizing texture, soft side light, editorial plating",
    "minimal": "minimal composition, clean negative space, refined color palette, elegant simplicity",
}

NEGATIVE_PRESETS: dict[str, str] = {
    "none": "",
    "general": "low quality, blurry, noisy, distorted, deformed, watermark, text artifacts",
    "people": "bad anatomy, distorted hands, extra fingers, unnatural face, crossed eyes, bad proportions",
    "product": "warped logo, misspelled text, broken geometry, reflections with artifacts, dirty background",
}


@register
class StylePresetNode(BaseNode):
    spec = NodeSpec(
        type="prompt.style_preset",
        category="processing",
        label="Style Preset",
        description="Select a reusable visual style phrase for prompt composition.",
        inputs=[],
        outputs=[PortSpec(name="style", type=PORT_STRING, label="Style")],
        params=[
            ParamSpec(
                name="style",
                type="select",
                label="Style",
                default="cinematic",
                options=list(STYLE_PRESETS.keys()),
            ),
            ParamSpec(
                name="custom",
                type="textarea",
                label="Custom Style",
                default="",
                placeholder="Optional custom style text. Overrides selected style when filled.",
            ),
        ],
    )

    async def execute(self, params: dict[str, Any], inputs: dict[str, Any], ctx) -> dict[str, Any]:
        custom = (params.get("custom") or "").strip()
        if custom:
            return {"style": custom}
        style_key = params.get("style") or "cinematic"
        return {"style": STYLE_PRESETS.get(style_key, STYLE_PRESETS["cinematic"])}


@register
class PromptComposerNode(BaseNode):
    spec = NodeSpec(
        type="prompt.composer",
        category="processing",
        label="Prompt Composer",
        description="Combine subject, style, details, and negative preset into generator-ready prompts.",
        inputs=[
            PortSpec(name="subject", type=PORT_STRING, label="Subject"),
            PortSpec(name="style", type=PORT_STRING, label="Style", optional=True),
            PortSpec(name="details", type=PORT_STRING, label="Details", optional=True),
        ],
        outputs=[
            PortSpec(name="prompt", type=PORT_STRING, label="Prompt"),
            PortSpec(name="negative_prompt", type=PORT_STRING, label="Negative Prompt"),
        ],
        params=[
            ParamSpec(
                name="prefix",
                type="textarea",
                label="Prefix",
                default="",
                placeholder="Optional text to put before the subject.",
            ),
            ParamSpec(
                name="suffix",
                type="textarea",
                label="Suffix",
                default="high quality, detailed, professional",
                placeholder="Optional text to append to the prompt.",
            ),
            ParamSpec(
                name="negative_preset",
                type="select",
                label="Negative Preset",
                default="general",
                options=list(NEGATIVE_PRESETS.keys()),
            ),
            ParamSpec(
                name="negative_extra",
                type="textarea",
                label="Negative Extra",
                default="",
                placeholder="Optional extra negative prompt terms.",
            ),
        ],
    )

    async def execute(self, params: dict[str, Any], inputs: dict[str, Any], ctx) -> dict[str, Any]:
        subject = (inputs.get("subject") or "").strip()
        if not subject:
            raise ValueError("Subject is empty - connect a Text Prompt node to subject.")

        parts = [
            (params.get("prefix") or "").strip(),
            subject,
            (inputs.get("style") or "").strip(),
            (inputs.get("details") or "").strip(),
            (params.get("suffix") or "").strip(),
        ]
        prompt = ", ".join(part for part in parts if part)

        negative_parts = [
            NEGATIVE_PRESETS.get(params.get("negative_preset") or "general", ""),
            (params.get("negative_extra") or "").strip(),
        ]
        negative_prompt = ", ".join(part for part in negative_parts if part)

        return {"prompt": prompt, "negative_prompt": negative_prompt}
