from __future__ import annotations
import asyncio
import logging
from datetime import datetime
from typing import Any
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.models import Run, NodeExecution
from ..nodes.registry import get_node_class
from .context import ExecutionContext
from .graph import ParsedGraph, parse_graph, topological_levels

logger = logging.getLogger(__name__)


class RunBroadcaster:
    """Pub/sub đơn giản: mỗi run có 1 list các queue (mỗi WS client 1 queue)."""

    def __init__(self) -> None:
        self._subs: dict[str, list[asyncio.Queue]] = {}

    def subscribe(self, run_id: str) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=1000)
        self._subs.setdefault(run_id, []).append(q)
        return q

    def unsubscribe(self, run_id: str, q: asyncio.Queue) -> None:
        if run_id in self._subs and q in self._subs[run_id]:
            self._subs[run_id].remove(q)

    async def publish(self, run_id: str, event: dict[str, Any]) -> None:
        for q in self._subs.get(run_id, []):
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:
                pass


# Singleton dùng cho cả app
broadcaster = RunBroadcaster()


async def _run_single_node(
    node_id: str,
    parsed: ParsedGraph,
    outputs_store: dict[str, dict[str, Any]],
    ctx: ExecutionContext,
    db: AsyncSession,
) -> None:
    gnode = parsed.nodes[node_id]
    NodeCls = get_node_class(gnode.type)
    if NodeCls is None:
        raise ValueError(f"Node type không tồn tại: {gnode.type}")

    # Tạo NodeExecution record
    ne = NodeExecution(
        run_id=ctx.run_id, node_id=node_id, node_type=gnode.type,
        status="running", started_at=datetime.utcnow(),
    )
    db.add(ne)
    await db.flush()
    await db.commit()

    await broadcaster.publish(ctx.run_id, {
        "type": "node_started", "node_id": node_id, "node_type": gnode.type,
    })

    # Gom inputs từ edges
    inputs: dict[str, Any] = {}
    for (port, src_id, src_port) in parsed.incoming.get(node_id, []):
        src_out = outputs_store.get(src_id, {})
        if src_port in src_out:
            value = src_out[src_port]
            if port in inputs:
                if isinstance(inputs[port], list):
                    inputs[port].append(value)
                else:
                    inputs[port] = [inputs[port], value]
            else:
                inputs[port] = value

    try:
        ctx.current_node_id = node_id
        node = NodeCls()
        outputs = await node.execute(gnode.params, inputs, ctx)
        outputs_store[node_id] = outputs

        # Tách preview nếu có
        preview = outputs.get("_preview_b64")
        if not preview:
            image_output = outputs.get("image")
            if isinstance(image_output, str) and len(image_output) > 1000:
                preview = image_output

        ne.status = "success"
        ne.finished_at = datetime.utcnow()
        # Chỉ lưu metadata, không lưu base64 ảnh dài dòng vào DB
        safe_outputs = {
            k: (f"<image:{len(v)} bytes>" if isinstance(v, str) and len(v) > 1000 else v)
            for k, v in outputs.items()
            if k != "_preview_b64"
        }
        ne.outputs_json = safe_outputs
        await db.flush()
        await db.commit()

        evt: dict[str, Any] = {
            "type": "node_finished",
            "node_id": node_id,
            "status": "success",
            "outputs": safe_outputs,
        }
        if preview:
            evt["preview_b64"] = preview
        await broadcaster.publish(ctx.run_id, evt)

    except Exception as e:
        logger.exception("Node %s failed", node_id)
        ne.status = "failed"
        ne.error = str(e)
        ne.finished_at = datetime.utcnow()
        await db.flush()
        await db.commit()
        await broadcaster.publish(ctx.run_id, {
            "type": "node_finished", "node_id": node_id, "status": "failed", "error": str(e),
        })
        raise


async def execute_run(run_id: str, graph_json: dict, db: AsyncSession) -> None:
    """Thực thi một run. Cập nhật Run record + publish events qua broadcaster."""
    # Update run -> running
    run = (await db.execute(select(Run).where(Run.id == run_id))).scalar_one()
    run.status = "running"
    run.started_at = datetime.utcnow()
    await db.commit()
    await broadcaster.publish(run_id, {"type": "run_started", "run_id": run_id})

    ctx = ExecutionContext(db=db, run_id=run_id, broadcaster=broadcaster)
    outputs_store: dict[str, dict[str, Any]] = {}

    try:
        parsed = parse_graph(graph_json)
        if not parsed.nodes:
            raise ValueError("Graph rỗng.")
        levels = topological_levels(parsed)

        for level in levels:
            # Chạy song song trong cùng 1 level
            for nid in level:
                await _run_single_node(nid, parsed, outputs_store, ctx, db)
            await db.commit()  # commit sau mỗi level

        run.status = "success"
        run.finished_at = datetime.utcnow()
        await db.commit()
        await broadcaster.publish(run_id, {"type": "run_finished", "status": "success"})

    except Exception as e:
        logger.exception("Run %s failed", run_id)
        run.status = "failed"
        run.error = str(e)
        run.finished_at = datetime.utcnow()
        await db.commit()
        await broadcaster.publish(run_id, {"type": "run_finished", "status": "failed", "error": str(e)})
