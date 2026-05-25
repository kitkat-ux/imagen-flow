from __future__ import annotations
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


# === Port types ===
# Đơn giản hoá: STRING, NUMBER, IMAGE, ANY. FE dùng để validate edge connection.
PORT_STRING = "string"
PORT_NUMBER = "number"
PORT_IMAGE = "image"   # base64 PNG bytes-as-string hoặc đường dẫn file
PORT_ANY = "any"


@dataclass
class PortSpec:
    name: str
    type: str
    label: str | None = None
    optional: bool = False


@dataclass
class ParamSpec:
    name: str
    type: str  # "string" | "number" | "select" | "textarea" | "boolean"
    label: str
    default: Any = None
    options: list[str] | None = None  # cho select
    placeholder: str | None = None
    min: float | None = None
    max: float | None = None


@dataclass
class NodeSpec:
    type: str            # unique id, vd "openai.image.generate"
    category: str        # "input" | "generator" | "processing" | "logic" | "output"
    label: str
    description: str = ""
    inputs: list[PortSpec] = field(default_factory=list)
    outputs: list[PortSpec] = field(default_factory=list)
    params: list[ParamSpec] = field(default_factory=list)


class BaseNode(ABC):
    """Subclass và set class-level `spec: NodeSpec`."""
    spec: NodeSpec

    @abstractmethod
    async def execute(self, params: dict[str, Any], inputs: dict[str, Any], ctx: "ExecutionContext") -> dict[str, Any]:
        """Return dict mapping output port name -> value."""
        ...


# Forward ref
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from ..executor.context import ExecutionContext
