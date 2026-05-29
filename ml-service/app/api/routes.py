"""
FastAPI route definitions for SmartCRM ML prediction endpoints.

Endpoints:
  POST /predict/churn       — churn risk probability
  POST /predict/revenue     — revenue forecast + confidence interval
  POST /predict/lead-score  — 0-100 score with tier
  GET  /insights/generate   — rule-and-model hybrid insights
"""

from __future__ import annotations

import logging
import pathlib
from typing import Any
from uuid import UUID

import numpy as np
import pandas as pd
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from app.pipelines.churn_pipeline import FEATURES as CHURN_FEATURES
from app.pipelines.lead_scorer_pipeline import (
    ALL_FEATURES as LEAD_FEATURES,
    score_leads,
)
from app.pipelines.revenue_pipeline import FEATURES as REVENUE_FEATURES, predict_with_interval
from app.services.insights import (
    CustomerState,
    LeadSegment,
    build_customer_states_from_predictions,
    build_lead_segments_from_data,
    generate_insights,
)

logger = logging.getLogger(__name__)

_DATA_DIR = pathlib.Path(__file__).parents[2] / "data"

router = APIRouter()


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

# -- Churn --

class ChurnRequest(BaseModel):
    customer_id: UUID
    features: dict[str, Any] = Field(
        ...,
        examples=[{
            "days_since_last_interaction": 90,
            "purchase_frequency": 3.5,
            "total_revenue": 12000.0,
            "support_tickets": 8,
            "email_open_rate": 0.15,
        }],
    )


class ChurnResponse(BaseModel):
    churn_risk: float
    confidence: float


# -- Revenue --

class RevenueRequest(BaseModel):
    features: dict[str, Any] = Field(
        ...,
        examples=[{
            "avg_monthly_revenue": 5000.0,
            "pipeline_value": 42000.0,
            "headcount": 45,
        }],
    )


class RevenueResponse(BaseModel):
    forecast: float
    range: list[float] = Field(..., min_length=2, max_length=2)


# -- Lead Score --

class LeadScoreRequest(BaseModel):
    lead_id: UUID
    features: dict[str, Any] = Field(
        ...,
        examples=[{
            "source": "referral",
            "days_in_pipeline": 22,
            "email_responses": 12,
            "meetings_held": 4,
            "deal_value": 35000.0,
        }],
    )


class LeadScoreResponse(BaseModel):
    score: int
    tier: str


# -- Insights --

class InsightsResponse(BaseModel):
    insights: list[str]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_model(request: Request, key: str) -> Any:
    models = getattr(request.app.state, "models", {})
    model = models.get(key)
    if model is None:
        raise HTTPException(
            status_code=503,
            detail=f"Model '{key}' is not loaded. Service may be starting up or model file is missing.",
        )
    return model


def _features_to_df(features: dict[str, Any], expected_cols: list[str]) -> pd.DataFrame:
    missing = [c for c in expected_cols if c not in features]
    if missing:
        raise HTTPException(
            status_code=422,
            detail=f"Missing required feature(s): {missing}",
        )
    return pd.DataFrame([{col: features[col] for col in expected_cols}])


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/predict/churn", response_model=ChurnResponse, tags=["predictions"])
async def predict_churn(body: ChurnRequest, request: Request) -> ChurnResponse:
    pipeline = _get_model(request, "churn")
    X = _features_to_df(body.features, CHURN_FEATURES)

    proba = pipeline.predict_proba(X)[0]
    churn_prob = float(proba[1])
    confidence = float(max(proba))

    logger.info(
        "churn prediction customer_id=%s churn_risk=%.4f confidence=%.4f",
        body.customer_id, churn_prob, confidence,
    )
    return ChurnResponse(churn_risk=round(churn_prob, 4), confidence=round(confidence, 4))


@router.post("/predict/revenue", response_model=RevenueResponse, tags=["predictions"])
async def predict_revenue(body: RevenueRequest, request: Request) -> RevenueResponse:
    bundle = _get_model(request, "revenue")
    X = _features_to_df(body.features, REVENUE_FEATURES)

    result = predict_with_interval(bundle, X, z=1.0)
    row = result.iloc[0]

    logger.info(
        "revenue forecast=%.2f range=[%.2f, %.2f]",
        row["prediction"], row["lower"], row["upper"],
    )
    return RevenueResponse(
        forecast=round(float(row["prediction"]), 2),
        range=[round(float(row["lower"]), 2), round(float(row["upper"]), 2)],
    )


@router.post("/predict/lead-score", response_model=LeadScoreResponse, tags=["predictions"])
async def predict_lead_score(body: LeadScoreRequest, request: Request) -> LeadScoreResponse:
    pipeline = _get_model(request, "lead_scorer")
    X = _features_to_df(body.features, LEAD_FEATURES)

    scores_df = score_leads(pipeline, X)
    row = scores_df.iloc[0]

    logger.info(
        "lead score lead_id=%s score=%.1f tier=%s",
        body.lead_id, row["score"], row["tier"],
    )
    return LeadScoreResponse(score=int(row["score"]), tier=str(row["tier"]))


@router.get("/insights/generate", response_model=InsightsResponse, tags=["insights"])
async def get_insights(request: Request) -> InsightsResponse:
    churn_model = _get_model(request, "churn")
    revenue_bundle = _get_model(request, "revenue")

    # Load seed data as mock business state
    customers_path = _DATA_DIR / "customers_seed.csv"
    leads_path = _DATA_DIR / "leads_seed.csv"

    if not customers_path.exists() or not leads_path.exists():
        raise HTTPException(status_code=503, detail="Seed data files not found.")

    customers_df = pd.read_csv(customers_path)
    leads_df = pd.read_csv(leads_path)

    # Run churn predictions across all customers
    churn_features = customers_df[CHURN_FEATURES]
    churn_proba = churn_model.predict_proba(churn_features)[:, 1]

    # Run revenue predictions
    rev_pipe = revenue_bundle["pipeline"]
    rev_sigma = revenue_bundle["residual_std"]

    # Build revenue features from customer data (same derivation as training)
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
    revenue_predictions = rev_pipe.predict(rev_X)

    # Assemble states
    customer_states = build_customer_states_from_predictions(
        customers_df, churn_proba, revenue_predictions,
    )
    lead_segments = build_lead_segments_from_data(leads_df)

    insights = generate_insights(customer_states, lead_segments)

    return InsightsResponse(insights=insights)
