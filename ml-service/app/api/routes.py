"""
FastAPI route definitions for SmartCRM ML prediction endpoints.

Endpoints:
  POST /predict/churn       — churn risk probability
  POST /predict/revenue     — revenue forecast + confidence interval
  POST /predict/lead-score  — 0-100 score with tier
  GET  /insights/generate   — rule-and-model hybrid insights
  POST /retrain             — fail-fast control-plane endpoint
"""

from __future__ import annotations

import logging
import pathlib
from uuid import UUID

import asyncio
from functools import partial

import numpy as np
import pandas as pd
from fastapi import APIRouter, HTTPException, Request, status
from pydantic import AliasChoices, BaseModel, ConfigDict, Field

from app.pipelines.churn_pipeline import FEATURES as CHURN_FEATURES
from app.pipelines.lead_scorer_pipeline import (
    ALL_FEATURES as LEAD_FEATURES,
    score_leads,
)
from app.pipelines.revenue_pipeline import FEATURES as REVENUE_FEATURES, predict_with_interval
from app.services.insights import (
    build_customer_states_from_predictions,
    build_lead_segments_from_data,
    generate_insights,
)

logger = logging.getLogger(__name__)

_DATA_DIR = pathlib.Path(__file__).parents[2] / "data"
_SUPPORTED_SCHEMA_VERSION = "1.0"

router = APIRouter()


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class ChurnFeatures(StrictModel):
    days_since_last_interaction: float = Field(
        ...,
        ge=0,
        validation_alias=AliasChoices("days_since_last_interaction", "days_since_last_contact"),
    )
    purchase_frequency: float = Field(
        ...,
        ge=0,
        validation_alias=AliasChoices("purchase_frequency", "purchase_freq"),
    )
    total_revenue: float = Field(
        ...,
        ge=0,
        validation_alias=AliasChoices("total_revenue", "lifetime_revenue"),
    )
    support_tickets: int = Field(
        ...,
        ge=0,
        validation_alias=AliasChoices("support_tickets", "support_ticket_count"),
    )
    email_open_rate: float = Field(
        ...,
        ge=0,
        le=1,
        validation_alias=AliasChoices("email_open_rate", "email_engagement_rate"),
    )


class RevenueFeatures(StrictModel):
    avg_monthly_revenue: float = Field(
        ...,
        ge=0,
        validation_alias=AliasChoices("avg_monthly_revenue", "avg_mrr"),
    )
    pipeline_value: float = Field(
        ...,
        ge=0,
        validation_alias=AliasChoices("pipeline_value", "pipeline_amount"),
    )
    headcount: int = Field(
        ...,
        ge=1,
        validation_alias=AliasChoices("headcount", "team_size"),
    )


class LeadScoreFeatures(StrictModel):
    source: str = Field(..., min_length=1, max_length=100)
    days_in_pipeline: int = Field(
        ...,
        ge=0,
        validation_alias=AliasChoices("days_in_pipeline", "days_open"),
    )
    email_responses: int = Field(
        ...,
        ge=0,
        validation_alias=AliasChoices("email_responses", "email_reply_count"),
    )
    meetings_held: int = Field(
        ...,
        ge=0,
        validation_alias=AliasChoices("meetings_held", "meetings_count"),
    )
    deal_value: float = Field(
        ...,
        ge=0,
        validation_alias=AliasChoices("deal_value", "opportunity_value"),
    )


class ChurnRequest(StrictModel):
    schema_version: str = Field(default=_SUPPORTED_SCHEMA_VERSION)
    customer_id: UUID
    features: ChurnFeatures


class ChurnResponse(StrictModel):
    churn_risk: float
    confidence: float


class RevenueRequest(StrictModel):
    schema_version: str = Field(default=_SUPPORTED_SCHEMA_VERSION)
    features: RevenueFeatures


class RevenueResponse(StrictModel):
    forecast: float
    range: list[float] = Field(..., min_length=2, max_length=2)


class LeadScoreRequest(StrictModel):
    schema_version: str = Field(default=_SUPPORTED_SCHEMA_VERSION)
    lead_id: UUID
    features: LeadScoreFeatures


class LeadScoreResponse(StrictModel):
    score: int
    tier: str


class InsightsResponse(StrictModel):
    insights: list[str]


class RetrainRequest(StrictModel):
    triggered_by: str = Field(default="scheduler", min_length=1, max_length=64)
    job_id: str | None = Field(default=None, max_length=128)


class RetrainResponse(StrictModel):
    accepted: bool
    detail: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_model(request: Request, key: str):
    models = getattr(request.app.state, "models", {})
    model = models.get(key)
    if model is None:
        raise HTTPException(
            status_code=503,
            detail=f"Model '{key}' is not loaded. Service may be starting up or model file is missing.",
        )
    return model


def _log_schema_version(endpoint: str, schema_version: str) -> None:
    if schema_version != _SUPPORTED_SCHEMA_VERSION:
        logger.warning(
            "schema drift signal endpoint=%s schema_version=%s supported=%s",
            endpoint,
            schema_version,
            _SUPPORTED_SCHEMA_VERSION,
        )
    else:
        logger.debug("schema accepted endpoint=%s schema_version=%s", endpoint, schema_version)


def _features_to_df(features: BaseModel, expected_cols: list[str]) -> pd.DataFrame:
    raw = features.model_dump()
    missing = [c for c in expected_cols if c not in raw]
    if missing:
        raise HTTPException(
            status_code=422,
            detail=f"Missing required feature(s): {missing}",
        )

    return pd.DataFrame([{col: raw[col] for col in expected_cols}])


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/predict/churn", response_model=ChurnResponse, tags=["predictions"])
async def predict_churn(body: ChurnRequest, request: Request) -> ChurnResponse:
    _log_schema_version("predict/churn", body.schema_version)
    pipeline = _get_model(request, "churn")
    X = _features_to_df(body.features, CHURN_FEATURES)

    loop = asyncio.get_event_loop()
    proba_all = await loop.run_in_executor(None, partial(pipeline.predict_proba, X))
    proba = proba_all[0]
    churn_prob = float(proba[1])
    confidence = float(max(proba))

    logger.info(
        "churn prediction customer_id=%s churn_risk=%.4f confidence=%.4f",
        body.customer_id,
        churn_prob,
        confidence,
    )
    return ChurnResponse(churn_risk=round(churn_prob, 4), confidence=round(confidence, 4))


@router.post("/predict/revenue", response_model=RevenueResponse, tags=["predictions"])
async def predict_revenue(body: RevenueRequest, request: Request) -> RevenueResponse:
    _log_schema_version("predict/revenue", body.schema_version)
    bundle = _get_model(request, "revenue")
    X = _features_to_df(body.features, REVENUE_FEATURES)

    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, partial(predict_with_interval, bundle, X, z=1.0))
    row = result.iloc[0]

    logger.info(
        "revenue forecast=%.2f range=[%.2f, %.2f]",
        row["prediction"],
        row["lower"],
        row["upper"],
    )
    return RevenueResponse(
        forecast=round(float(row["prediction"]), 2),
        range=[round(float(row["lower"]), 2), round(float(row["upper"]), 2)],
    )


@router.post("/predict/lead-score", response_model=LeadScoreResponse, tags=["predictions"])
async def predict_lead_score(body: LeadScoreRequest, request: Request) -> LeadScoreResponse:
    _log_schema_version("predict/lead-score", body.schema_version)
    pipeline = _get_model(request, "lead_scorer")
    X = _features_to_df(body.features, LEAD_FEATURES)

    loop = asyncio.get_event_loop()
    scores_df = await loop.run_in_executor(None, partial(score_leads, pipeline, X))
    row = scores_df.iloc[0]

    logger.info(
        "lead score lead_id=%s score=%.1f tier=%s",
        body.lead_id,
        row["score"],
        row["tier"],
    )
    return LeadScoreResponse(score=int(row["score"]), tier=str(row["tier"]))


@router.get("/insights/generate", response_model=InsightsResponse, tags=["insights"])
async def get_insights(request: Request) -> InsightsResponse:
    churn_model = _get_model(request, "churn")
    revenue_bundle = _get_model(request, "revenue")

    customers_path = _DATA_DIR / "customers_seed.csv"
    leads_path = _DATA_DIR / "leads_seed.csv"

    if not customers_path.exists() or not leads_path.exists():
        raise HTTPException(status_code=503, detail="Seed data files not found.")

    customers_df = pd.read_csv(customers_path)
    leads_df = pd.read_csv(leads_path)

    churn_features = customers_df[CHURN_FEATURES]
    loop = asyncio.get_event_loop()
    churn_proba_full = await loop.run_in_executor(None, partial(churn_model.predict_proba, churn_features))
    churn_proba = churn_proba_full[:, 1]

    rev_pipe = revenue_bundle["pipeline"]

    days = customers_df["days_since_last_interaction"].values
    months_active = np.clip((365 - days) / 30.0, 1, 12)
    avg_monthly = customers_df["total_revenue"].values / months_active
    pipeline_val = customers_df["purchase_frequency"].values * avg_monthly
    revenue_arr = customers_df["total_revenue"].values
    rng = np.random.default_rng(0)
    n = len(customers_df)
    headcount = np.where(
        revenue_arr < np.percentile(revenue_arr, 25), rng.integers(5, 20, n),
        np.where(
            revenue_arr < np.percentile(revenue_arr, 50), rng.integers(20, 60, n),
            np.where(
                revenue_arr < np.percentile(revenue_arr, 75), rng.integers(60, 120, n),
                rng.integers(120, 200, n),
            ),
        ),
    ).astype(float)

    rev_X = pd.DataFrame({
        "avg_monthly_revenue": np.round(avg_monthly, 2),
        "pipeline_value": np.round(pipeline_val, 2),
        "headcount": headcount.astype(int),
    })
    revenue_predictions = await loop.run_in_executor(None, partial(rev_pipe.predict, rev_X))

    customer_states = build_customer_states_from_predictions(
        customers_df, churn_proba, revenue_predictions
    )
    lead_segments = build_lead_segments_from_data(leads_df)
    insights = generate_insights(customer_states, lead_segments)

    return InsightsResponse(insights=insights)


@router.post("/retrain", response_model=RetrainResponse, tags=["ops"])
async def retrain_models(body: RetrainRequest) -> RetrainResponse:
    logger.error(
        "Rejected retrain request triggered_by=%s job_id=%s: trainer not deployed",
        body.triggered_by,
        body.job_id,
    )
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail=(
            "Retraining is disabled on inference pods. Deploy a dedicated trainer worker "
            "and trigger retraining there."
        ),
    )
