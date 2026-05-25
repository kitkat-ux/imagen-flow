from __future__ import annotations
from dataclasses import asdict
from typing import Type

from .base import BaseNode, NodeSpec


_REGISTRY: dict[str, Type[BaseNode]] = {}


def register(node_cls: Type[BaseNode]) -> Type[BaseNode]:
    if not hasattr(node_cls, "spec"):
        raise ValueError(f"{node_cls.__name__} must define `spec: NodeSpec`")
    _REGISTRY[node_cls.spec.type] = node_cls
    return node_cls


def get_node_class(node_type: str) -> Type[BaseNode] | None:
    return _REGISTRY.get(node_type)


def all_specs() -> list[dict]:
    return [asdict(cls.spec) for cls in _REGISTRY.values()]


def load_builtins() -> None:
    """Import để decorator @register chạy."""
    from . import inputs, generators, outputs, prompting, weryai  # noqa: F401
