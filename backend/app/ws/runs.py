from __future__ import annotations
import asyncio
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..executor.runner import broadcaster

router = APIRouter()


@router.websocket("/ws/runs/{run_id}")
async def run_ws(websocket: WebSocket, run_id: str):
    await websocket.accept()
    q = broadcaster.subscribe(run_id)
    try:
        while True:
            try:
                event = await asyncio.wait_for(q.get(), timeout=30.0)
                await websocket.send_text(json.dumps(event))
                if event.get("type") == "run_finished":
                    # cho client biết là kết thúc nhưng giữ kết nối 1 giây để flush
                    await asyncio.sleep(0.5)
                    break
            except asyncio.TimeoutError:
                # ping để giữ kết nối
                await websocket.send_text(json.dumps({"type": "ping"}))
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        broadcaster.unsubscribe(run_id, q)
        try:
            await websocket.close()
        except Exception:
            pass
