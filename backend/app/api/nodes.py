from __future__ import annotations
from fastapi import APIRouter

from ..nodes.registry import all_specs

router = APIRouter(prefix="/api/nodes", tags=["nodes"])


@router.get("/registry")
async def get_registry():
    return {"nodes": all_specs()}
