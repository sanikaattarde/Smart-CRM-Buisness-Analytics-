from __future__ import annotations

import logging
import pathlib
from contextlib import asynccontextmanager
from typing import Any, AsyncGenerator

import joblib
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router as ml_router

logger = logging.getLogger(__name__)

_MODEL_DIR = pathlib.Path(__file__).parent / "models"

_MODEL_MANIFEST: dict[str, str] = {
    "churn":        "churn_model.pkl",
    "revenue":      "revenue_model.pkl",
    "lead_scorer":  "lead_scorer_model.pkl",
}


# ---------------------------------------------------------------------------
# Lifespan — load serialized models on startup
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    models: dict[str, Any] = {}
    for key, filename in _MODEL_MANIFEST.items():
        path = _MODEL_DIR / filename
        if path.exists():
            try:
                models[key] = joblib.load(path)
                logger.info("Loaded model '%s' from %s", key, path)
            except Exception as exc:
                logger.warning(
                    "Failed to load model '%s' from %s — skipping. "
                    "Re-train and replace the .pkl file. Error: %s",
                    key, path, exc,
                )
        else:
            logger.warning("Model file not found: %s — '%s' will be unavailable", path, key)

    app.state.models = models
    yield
    # Release references on shutdown
    app.state.models = {}


# ---------------------------------------------------------------------------
# Application factory
# ---------------------------------------------------------------------------

def create_app() -> FastAPI:
    app = FastAPI(
        title="SmartCRM ML Service",
        version="0.1.0",
        docs_url="/docs",
        redoc_url=None,
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://backend:3000", "http://localhost:3000"],
        allow_credentials=True,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type", "Authorization"],
    )

    # ------------------------------------------------------------------
    # Routes
    # ------------------------------------------------------------------

    app.include_router(ml_router)

    @app.get("/health", tags=["ops"])
    async def health() -> dict[str, Any]:
        models: dict[str, Any] = getattr(app.state, "models", {})
        loaded = list(models.keys())
        missing = [k for k in _MODEL_MANIFEST if k not in models]

        if missing:
            return {
                "status": "degraded",
                "models_loaded": loaded,
                "models_missing": missing,
            }
        return {"status": "ok", "models_loaded": loaded}

    return app


app = create_app()
