from __future__ import annotations
from datetime import datetime
from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.models import Workflow, WorkflowVersion
from ..db.session import get_db

router = APIRouter(prefix="/api/workflows", tags=["workflows"])


class WorkflowIn(BaseModel):
    name: str = Field(default="Untitled", max_length=200)
    description: str | None = None
    graph_json: dict[str, Any] = Field(default_factory=dict)


class WorkflowOut(BaseModel):
    id: str
    name: str
    description: str | None
    graph_json: dict
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class WorkflowVersionOut(BaseModel):
    id: str
    workflow_id: str
    version: int
    name: str
    description: str | None
    graph_json: dict
    created_at: datetime

    class Config:
        from_attributes = True


async def _next_version_number(db: AsyncSession, workflow_id: str) -> int:
    latest = (
        await db.execute(
            select(func.max(WorkflowVersion.version)).where(WorkflowVersion.workflow_id == workflow_id)
        )
    ).scalar_one_or_none()
    return int(latest or 0) + 1


async def _create_version(db: AsyncSession, wf: Workflow) -> WorkflowVersion:
    version = WorkflowVersion(
        workflow_id=wf.id,
        version=await _next_version_number(db, wf.id),
        name=wf.name,
        description=wf.description,
        graph_json=wf.graph_json,
    )
    db.add(version)
    return version


@router.get("", response_model=list[WorkflowOut])
async def list_workflows(db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(Workflow).order_by(Workflow.updated_at.desc()))).scalars().all()
    return rows


@router.post("", response_model=WorkflowOut)
async def create_workflow(payload: WorkflowIn, db: AsyncSession = Depends(get_db)):
    wf = Workflow(name=payload.name, description=payload.description, graph_json=payload.graph_json)
    db.add(wf)
    await db.flush()
    await _create_version(db, wf)
    await db.commit()
    await db.refresh(wf)
    return wf


@router.get("/{wf_id}", response_model=WorkflowOut)
async def get_workflow(wf_id: str, db: AsyncSession = Depends(get_db)):
    wf = (await db.execute(select(Workflow).where(Workflow.id == wf_id))).scalar_one_or_none()
    if not wf:
        raise HTTPException(404, "Workflow không tồn tại")
    return wf


@router.put("/{wf_id}", response_model=WorkflowOut)
async def update_workflow(wf_id: str, payload: WorkflowIn, db: AsyncSession = Depends(get_db)):
    wf = (await db.execute(select(Workflow).where(Workflow.id == wf_id))).scalar_one_or_none()
    if not wf:
        raise HTTPException(404, "Workflow không tồn tại")
    wf.name = payload.name
    wf.description = payload.description
    wf.graph_json = payload.graph_json
    await _create_version(db, wf)
    await db.commit()
    await db.refresh(wf)
    return wf


@router.post("/{wf_id}/duplicate", response_model=WorkflowOut)
async def duplicate_workflow(wf_id: str, db: AsyncSession = Depends(get_db)):
    source = (await db.execute(select(Workflow).where(Workflow.id == wf_id))).scalar_one_or_none()
    if not source:
        raise HTTPException(404, "Workflow khong ton tai")
    wf = Workflow(
        name=f"{source.name} copy",
        description=source.description,
        graph_json=source.graph_json,
    )
    db.add(wf)
    await db.flush()
    await _create_version(db, wf)
    await db.commit()
    await db.refresh(wf)
    return wf


@router.get("/{wf_id}/versions", response_model=list[WorkflowVersionOut])
async def list_workflow_versions(wf_id: str, db: AsyncSession = Depends(get_db)):
    wf = (await db.execute(select(Workflow).where(Workflow.id == wf_id))).scalar_one_or_none()
    if not wf:
        raise HTTPException(404, "Workflow khong ton tai")
    rows = (
        await db.execute(
            select(WorkflowVersion)
            .where(WorkflowVersion.workflow_id == wf_id)
            .order_by(WorkflowVersion.version.desc())
        )
    ).scalars().all()
    return rows


@router.post("/{wf_id}/versions/{version_id}/restore", response_model=WorkflowOut)
async def restore_workflow_version(wf_id: str, version_id: str, db: AsyncSession = Depends(get_db)):
    wf = (await db.execute(select(Workflow).where(Workflow.id == wf_id))).scalar_one_or_none()
    if not wf:
        raise HTTPException(404, "Workflow khong ton tai")
    version = (
        await db.execute(
            select(WorkflowVersion).where(
                WorkflowVersion.id == version_id,
                WorkflowVersion.workflow_id == wf_id,
            )
        )
    ).scalar_one_or_none()
    if not version:
        raise HTTPException(404, "Version khong ton tai")
    wf.name = version.name
    wf.description = version.description
    wf.graph_json = version.graph_json
    await _create_version(db, wf)
    await db.commit()
    await db.refresh(wf)
    return wf


@router.delete("/{wf_id}")
async def delete_workflow(wf_id: str, db: AsyncSession = Depends(get_db)):
    wf = (await db.execute(select(Workflow).where(Workflow.id == wf_id))).scalar_one_or_none()
    if not wf:
        raise HTTPException(404, "Workflow không tồn tại")
    await db.execute(delete(WorkflowVersion).where(WorkflowVersion.workflow_id == wf_id))
    await db.delete(wf)
    await db.commit()
    return {"ok": True}
