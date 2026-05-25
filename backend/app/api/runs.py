from __future__ import annotations
import asyncio
from datetime import datetime
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.models import Run, NodeExecution
from ..db.session import get_db, AsyncSessionLocal
from ..executor.runner import execute_run

router = APIRouter(prefix="/api/runs", tags=["runs"])

_run_queue: asyncio.Queue[tuple[str, dict[str, Any]]] | None = None
_worker_task: asyncio.Task | None = None


class RunCreate(BaseModel):
    workflow_id: str | None = None
    graph_json: dict[str, Any] = Field(default_factory=dict)


class NodeExecOut(BaseModel):
    node_id: str
    node_type: str
    status: str
    started_at: datetime | None
    finished_at: datetime | None
    error: str | None
    outputs_json: dict[str, Any] | None = None

    class Config:
        from_attributes = True


class RunOut(BaseModel):
    id: str
    workflow_id: str | None
    status: str
    started_at: datetime | None
    finished_at: datetime | None
    error: str | None
    created_at: datetime
    graph_snapshot: dict[str, Any] = Field(default_factory=dict)
    node_executions: list[NodeExecOut] = []


def _to_run_out(run: Run, node_execs: list[NodeExecution] | None = None) -> RunOut:
    """Build RunOut thủ công để TRÁNH Pydantic lazy-load relationship trong async context."""
    return RunOut(
        id=run.id,
        workflow_id=run.workflow_id,
        status=run.status,
        started_at=run.started_at,
        finished_at=run.finished_at,
        error=run.error,
        created_at=run.created_at,
        graph_snapshot=run.graph_snapshot or {},
        node_executions=[NodeExecOut.model_validate(n) for n in (node_execs or [])],
    )


async def _run_in_background(run_id: str, graph_json: dict):
    """Tạo session mới (độc lập với request session) để chạy trong background."""
    async with AsyncSessionLocal() as db:
        try:
            await execute_run(run_id, graph_json, db)
        except Exception:
            pass  # đã được log + lưu trong execute_run


async def _run_worker():
    if _run_queue is None:
        return
    while True:
        run_id, graph_json = await _run_queue.get()
        try:
            await _run_in_background(run_id, graph_json)
        finally:
            _run_queue.task_done()


def _enqueue_run(run_id: str, graph_json: dict[str, Any]) -> None:
    global _run_queue, _worker_task
    if _run_queue is None:
        _run_queue = asyncio.Queue()
    if _worker_task is None or _worker_task.done():
        _worker_task = asyncio.create_task(_run_worker())
    _run_queue.put_nowait((run_id, graph_json))


@router.post("", response_model=RunOut)
async def create_run(payload: RunCreate, db: AsyncSession = Depends(get_db)):
    if not payload.graph_json or not payload.graph_json.get("nodes"):
        raise HTTPException(400, "graph_json phải có ít nhất 1 node.")
    run = Run(
        workflow_id=payload.workflow_id,
        graph_snapshot=payload.graph_json,
        status="pending",
        created_at=datetime.utcnow(),
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)

    # Chạy nền (không block response)
    _enqueue_run(run.id, payload.graph_json)
    return _to_run_out(run)


@router.get("", response_model=list[RunOut])
async def list_runs(
    db: AsyncSession = Depends(get_db),
    limit: int = Query(50, le=200),
    offset: int = 0,
):
    rows = (
        await db.execute(select(Run).order_by(Run.created_at.desc()).limit(limit).offset(offset))
    ).scalars().all()
    run_ids = [run.id for run in rows]
    node_execs_by_run: dict[str, list[NodeExecution]] = {run_id: [] for run_id in run_ids}
    if run_ids:
        node_execs = (await db.execute(
            select(NodeExecution)
            .where(NodeExecution.run_id.in_(run_ids))
            .order_by(NodeExecution.started_at)
        )).scalars().all()
        for node_exec in node_execs:
            node_execs_by_run.setdefault(node_exec.run_id, []).append(node_exec)
    return [_to_run_out(run, node_execs_by_run.get(run.id, [])) for run in rows]


@router.get("/{run_id}", response_model=RunOut)
async def get_run(run_id: str, db: AsyncSession = Depends(get_db)):
    run = (await db.execute(select(Run).where(Run.id == run_id))).scalar_one_or_none()
    if not run:
        raise HTTPException(404, "Run không tồn tại")
    nes = (await db.execute(
        select(NodeExecution).where(NodeExecution.run_id == run_id).order_by(NodeExecution.started_at)
    )).scalars().all()
    return _to_run_out(run, list(nes))


@router.post("/{run_id}/retry", response_model=RunOut)
async def retry_run(run_id: str, db: AsyncSession = Depends(get_db)):
    source = (await db.execute(select(Run).where(Run.id == run_id))).scalar_one_or_none()
    if not source:
        raise HTTPException(404, "Run khong ton tai")
    graph_json = source.graph_snapshot or {}
    if not graph_json.get("nodes"):
        raise HTTPException(400, "Run khong co graph snapshot de retry.")

    run = Run(
        workflow_id=source.workflow_id,
        graph_snapshot=graph_json,
        status="pending",
        created_at=datetime.utcnow(),
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)

    _enqueue_run(run.id, graph_json)
    return _to_run_out(run)
