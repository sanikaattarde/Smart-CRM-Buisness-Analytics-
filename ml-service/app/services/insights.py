"""
Rule-and-model hybrid insight engine for SmartCRM.

Evaluates business state snapshots against threshold rules and model outputs
to surface actionable insights for CRM operators.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Threshold constants
# ---------------------------------------------------------------------------

CHURN_PROB_THRESHOLD = 0.70
CHURN_DAYS_THRESHOLD = 30
REVENUE_GROWTH_THRESHOLD = 0.15  # 15 %


# ---------------------------------------------------------------------------
# Data contracts
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class CustomerState:
    customer_id: str
    churn_probability: float
    days_since_last_interaction: int
    current_revenue: float
    projected_revenue: float


@dataclass(frozen=True)
class LeadSegment:
    segment_name: str
    total_leads: int
    converted_leads: int

    @property
    def conversion_rate(self) -> float:
        return self.converted_leads / max(self.total_leads, 1)


# ---------------------------------------------------------------------------
# Insight generators (rule-based + model-informed)
# ---------------------------------------------------------------------------

def _churn_insights(customers: list[CustomerState]) -> list[str]:
    """Flag customers with high churn probability AND prolonged inactivity."""
    insights: list[str] = []
    at_risk = [
        c for c in customers
        if c.churn_probability > CHURN_PROB_THRESHOLD
        and c.days_since_last_interaction > CHURN_DAYS_THRESHOLD
    ]
    if not at_risk:
        return insights

    insights.append(
        f"⚠️  {len(at_risk)} customer(s) flagged as HIGH CHURN RISK "
        f"(probability > {CHURN_PROB_THRESHOLD:.0%}, inactive > {CHURN_DAYS_THRESHOLD} days)."
    )
    # Top 5 most critical
    for c in sorted(at_risk, key=lambda x: x.churn_probability, reverse=True)[:5]:
        insights.append(
            f"   → Customer {c.customer_id}: "
            f"churn prob {c.churn_probability:.1%}, "
            f"inactive {c.days_since_last_interaction}d, "
            f"revenue ${c.current_revenue:,.0f}"
        )
    return insights


def _revenue_insights(customers: list[CustomerState]) -> list[str]:
    """Surface customers where projected revenue growth exceeds threshold."""
    insights: list[str] = []
    growth_candidates = []
    for c in customers:
        if c.current_revenue <= 0:
            continue
        growth = (c.projected_revenue - c.current_revenue) / c.current_revenue
        if growth > REVENUE_GROWTH_THRESHOLD:
            growth_candidates.append((c, growth))

    if not growth_candidates:
        return insights

    growth_candidates.sort(key=lambda x: x[1], reverse=True)
    insights.append(
        f"📈 {len(growth_candidates)} customer(s) show projected revenue growth "
        f"> {REVENUE_GROWTH_THRESHOLD:.0%}."
    )
    for c, g in growth_candidates[:5]:
        insights.append(
            f"   → Customer {c.customer_id}: "
            f"${c.current_revenue:,.0f} → ${c.projected_revenue:,.0f} "
            f"(+{g:.1%})"
        )
    return insights


def _lead_segment_insights(segments: list[LeadSegment]) -> list[str]:
    """Compare conversion rates across lead segments; surface deltas."""
    if len(segments) < 2:
        return []

    insights: list[str] = []
    sorted_segs = sorted(segments, key=lambda s: s.conversion_rate, reverse=True)
    best = sorted_segs[0]
    worst = sorted_segs[-1]

    delta = best.conversion_rate - worst.conversion_rate
    if delta > 0.05:  # only report if > 5pp spread
        insights.append(
            f"🎯 Lead segment conversion spread: "
            f"'{best.segment_name}' converts at {best.conversion_rate:.1%} vs. "
            f"'{worst.segment_name}' at {worst.conversion_rate:.1%} "
            f"(Δ {delta:.1%})."
        )

    # Flag any segment below 20 % conversion
    for seg in sorted_segs:
        if seg.conversion_rate < 0.20 and seg.total_leads >= 10:
            insights.append(
                f"   ⚡ '{seg.segment_name}' has low conversion ({seg.conversion_rate:.1%} "
                f"across {seg.total_leads} leads) — review targeting or disqualification criteria."
            )
    return insights


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def generate_insights(
    customers: list[CustomerState],
    lead_segments: list[LeadSegment],
) -> list[str]:
    """
    Evaluate mock/real business states against thresholds and return
    a list of formatted insight strings.
    """
    insights: list[str] = []
    insights.extend(_churn_insights(customers))
    insights.extend(_revenue_insights(customers))
    insights.extend(_lead_segment_insights(lead_segments))

    if not insights:
        insights.append("✅ No critical insights at this time — all metrics within normal range.")

    logger.info("Generated %d insight(s)", len(insights))
    return insights


# ---------------------------------------------------------------------------
# Convenience: build states from model outputs
# ---------------------------------------------------------------------------

def build_customer_states_from_predictions(
    df: pd.DataFrame,
    churn_proba: np.ndarray,
    revenue_predictions: np.ndarray,
) -> list[CustomerState]:
    """
    Assemble CustomerState objects from a customer DataFrame and
    pre-computed model predictions.
    """
    states: list[CustomerState] = []
    for i, row in df.iterrows():
        states.append(CustomerState(
            customer_id=f"CUST-{i:04d}",
            churn_probability=float(churn_proba[i]),
            days_since_last_interaction=int(row["days_since_last_interaction"]),
            current_revenue=float(row["total_revenue"]),
            projected_revenue=float(revenue_predictions[i]),
        ))
    return states


def build_lead_segments_from_data(df: pd.DataFrame) -> list[LeadSegment]:
    """Group leads by source and compute segment-level conversion."""
    segments: list[LeadSegment] = []
    for source, group in df.groupby("source"):
        segments.append(LeadSegment(
            segment_name=str(source),
            total_leads=len(group),
            converted_leads=int(group["converted_label"].sum()),
        ))
    return segments
