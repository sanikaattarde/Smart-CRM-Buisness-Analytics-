"""
Synthetic training data generator for SmartCRM ML models.

Generates:
  - customers_seed.csv  (1,000 records) — churn prediction dataset
  - leads_seed.csv      (2,000 records) — lead conversion dataset

Uses vectorized NumPy operations throughout; no Python-level loops over rows.
"""

from __future__ import annotations

import pathlib
import numpy as np
import pandas as pd

RNG = np.random.default_rng(seed=42)
DATA_DIR = pathlib.Path(__file__).parents[2] / "data"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _sigmoid(x: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-x))


def _clip_round(arr: np.ndarray, low: float, high: float, decimals: int = 2) -> np.ndarray:
    return np.round(np.clip(arr, low, high), decimals)


# ---------------------------------------------------------------------------
# Customers dataset  (churn prediction)
# ---------------------------------------------------------------------------

def generate_customers(n: int = 1_000) -> pd.DataFrame:
    days_since = RNG.integers(1, 365, size=n).astype(float)          # 1–364 days
    purchase_freq = _clip_round(RNG.normal(loc=8, scale=4, size=n), 0, 30)
    total_revenue = _clip_round(
        RNG.lognormal(mean=7.5, sigma=1.1, size=n), 100, 500_000
    )
    support_tickets = RNG.integers(0, 20, size=n).astype(float)
    email_open_rate = _clip_round(
        RNG.beta(a=2, b=5, size=n), 0.0, 1.0
    )

    # Logistic churn score — deliberate causal structure:
    #   ↑ days_since          → +churn
    #   ↑ support_tickets     → +churn  (strong signal)
    #   ↑ purchase_frequency  → −churn
    #   ↑ email_open_rate     → −churn
    #   ↑ total_revenue       → slight −churn (high-value customers retained)
    logit = (
          0.015  * days_since
        + 0.22   * support_tickets
        - 0.18   * purchase_freq
        - 3.5    * email_open_rate
        - 0.0000015 * total_revenue
        + RNG.normal(0, 0.6, size=n)           # residual noise
        - 1.2                                   # base-rate intercept (~25 % churn)
    )
    churn_prob = _sigmoid(logit)
    churn_label = (RNG.random(n) < churn_prob).astype(int)

    return pd.DataFrame({
        "days_since_last_interaction": days_since.astype(int),
        "purchase_frequency":          purchase_freq,
        "total_revenue":               total_revenue,
        "support_tickets":             support_tickets.astype(int),
        "email_open_rate":             email_open_rate,
        "churn_label":                 churn_label,
    })


# ---------------------------------------------------------------------------
# Leads dataset  (conversion prediction)
# ---------------------------------------------------------------------------

_SOURCES = ["organic", "referral", "paid_ads", "cold_outreach", "event"]
_SOURCE_BIAS = np.array([0.4, 0.8, 0.1, -0.3, 0.5])   # per-source logit offset


def generate_leads(n: int = 2_000) -> pd.DataFrame:
    source_idx = RNG.integers(0, len(_SOURCES), size=n)
    source = np.array(_SOURCES)[source_idx]

    days_in_pipeline = RNG.integers(1, 180, size=n).astype(float)
    email_responses  = RNG.integers(0, 30, size=n).astype(float)
    meetings_held    = RNG.integers(0, 10, size=n).astype(float)
    deal_value       = _clip_round(
        RNG.lognormal(mean=9.0, sigma=1.3, size=n), 500, 2_000_000
    )

    # Logistic conversion score — deliberate causal structure:
    #   ↑ meetings_held    → +conversion  (strongest driver)
    #   ↑ email_responses  → +conversion
    #   ↑ deal_value       → slight −conversion (larger deals take longer)
    #   ↑ days_in_pipeline → −conversion (stale leads convert less)
    #   source             → categorical bias (referral best, cold outreach worst)
    logit = (
          0.55  * meetings_held
        + 0.12  * email_responses
        - 0.008 * days_in_pipeline
        - 0.0000008 * deal_value
        + _SOURCE_BIAS[source_idx]
        + RNG.normal(0, 0.5, size=n)           # residual noise
        - 1.8                                   # base-rate intercept (~30 % conversion)
    )
    conv_prob = _sigmoid(logit)
    converted_label = (RNG.random(n) < conv_prob).astype(int)

    return pd.DataFrame({
        "source":           source,
        "days_in_pipeline": days_in_pipeline.astype(int),
        "email_responses":  email_responses.astype(int),
        "meetings_held":    meetings_held.astype(int),
        "deal_value":       deal_value,
        "converted_label":  converted_label,
    })


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    customers = generate_customers(1_000)
    customers.to_csv(DATA_DIR / "customers_seed.csv", index=False)
    print(
        f"[data_generator] customers_seed.csv  → {len(customers):,} rows  "
        f"| churn rate: {customers['churn_label'].mean():.1%}"
    )

    leads = generate_leads(2_000)
    leads.to_csv(DATA_DIR / "leads_seed.csv", index=False)
    print(
        f"[data_generator] leads_seed.csv       → {len(leads):,} rows  "
        f"| conversion rate: {leads['converted_label'].mean():.1%}"
    )


if __name__ == "__main__":
    main()
