from __future__ import annotations
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import workflows, runs, gallery, settings as settings_api, nodes as nodes_api, uploads, assets
from .core.config import get_settings
from .db.session import init_db
from .nodes.registry import load_builtins
from .ws import runs as ws_runs


@asynccontextmanager
async def lifespan(app: FastAPI):
    cfg = get_settings()
    logging.basicConfig(
        level=cfg.LOG_LEVEL,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )
    load_builtins()
    await init_db()
    yield


def create_app() -> FastAPI:
    cfg = get_settings()
    app = FastAPI(title="ImagenFlow", version="0.1.0", lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=cfg.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(workflows.router)
    app.include_router(runs.router)
    app.include_router(gallery.router)
    app.include_router(settings_api.router)
    app.include_router(nodes_api.router)
    app.include_router(uploads.router)
    app.include_router(assets.router)
    app.include_router(ws_runs.router)

    @app.get("/api/health")
    async def health():
        return {"status": "ok"}

    return app


app = create_app()
