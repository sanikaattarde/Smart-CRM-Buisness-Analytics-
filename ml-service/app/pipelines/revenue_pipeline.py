"""
Revenue forecasting pipeline.

Model  : LinearRegression
Target : forecasted_revenue (continuous)
Output : point prediction + confidence interval (±1 std-dev of residuals)

The customers_seed.csv does not contain explicit monthly-revenue time series,
so we engineer proxy features from the available columns:
  - avg_monthly_revenue  = total_revenue / max(months_active, 1)
  - pipeline_value       ≈ purchase_frequency × avg_monthly_revenue (proxy)
  - headcount            ≈ bucketed from total_revenue (proxy tier)
"""

from __future__ import annotations

import logging
import pathlib

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

logger = logging.getLogger(__name__)

_BASE = pathlib.Path(__file__).parents[2]
_DATA_PATH = _BASE / "data" / "customers_seed.csv"
_MODEL_DIR = _BASE / "app" / "models"
_MODEL_PATH = _MODEL_DIR / "revenue_model.pkl"

FEATURES = [
    "avg_monthly_revenue",
    "pipeline_value",
    "headcount",
]
TARGET = "forecasted_revenue"
_TOLERANCE = 0.05


# ---------------------------------------------------------------------------
# Feature engineering
# ---------------------------------------------------------------------------

def _build_revenue_dataset(df: pd.DataFrame, rng: np.random.Generator) -> pd.DataFrame:
    """Derive regression features + synthetic target from the customer seed."""
    n = len(df)

    months_active = np.clip(
        (365 - df["days_since_last_interaction"].values) / 30.0, 1, 12
    )
    avg_monthly_revenue = df["total_revenue"].values / months_active

    pipeline_value = df["purchase_frequency"].values * avg_monthly_revenue

    # Headcount proxy: bucket by total_revenue quantiles
    revenue_arr = df["total_revenue"].values
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

    # Synthetic target with realistic linear relationship + noise
    forecasted_revenue = (
        0.85 * avg_monthly_revenue
        + 0.10 * pipeline_value
        + 150.0 * headcount
        + rng.normal(0, avg_monthly_revenue * 0.15, size=n)
    )
    forecasted_revenue = np.clip(forecasted_revenue, 0, None)

    return pd.DataFrame({
        "avg_monthly_revenue": np.round(avg_monthly_revenue, 2),
        "pipeline_value":      np.round(pipeline_value, 2),
        "headcount":           headcount.astype(int),
        TARGET:                np.round(forecasted_revenue, 2),
    })


# ---------------------------------------------------------------------------
# Model persistence helpers
# ---------------------------------------------------------------------------

def _load_incumbent_score() -> float | None:
    meta_path = _MODEL_PATH.with_suffix(".meta.npy")
    if meta_path.exists():
        return float(np.load(meta_path))
    return None


def _save_model(pipeline: Pipeline, r2: float, residual_std: float) -> None:
    _MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump({"pipeline": pipeline, "residual_std": residual_std}, _MODEL_PATH)
    np.save(_MODEL_PATH.with_suffix(".meta.npy"), r2)
    logger.info("Saved revenue model → %s  (R²=%.4f, σ=%.2f)", _MODEL_PATH, r2, residual_std)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def predict_with_interval(
    model_bundle: dict, X: pd.DataFrame, z: float = 1.0,
) -> pd.DataFrame:
    """Return point prediction with ±z*σ confidence band."""
    pipe = model_bundle["pipeline"]
    sigma = model_bundle["residual_std"]
    pred = pipe.predict(X)
    return pd.DataFrame({
        "prediction": np.round(pred, 2),
        "lower":      np.round(pred - z * sigma, 2),
        "upper":      np.round(pred + z * sigma, 2),
    })


def train_model() -> dict:
    """Train, evaluate, and conditionally persist the revenue model."""
    rng = np.random.default_rng(42)
    raw = pd.read_csv(_DATA_PATH)
    df = _build_revenue_dataset(raw, rng)

    X = df[FEATURES]
    y = df[TARGET]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42,
    )

    preprocessor = ColumnTransformer(
        transformers=[("num", StandardScaler(), FEATURES)],
        remainder="drop",
    )

    pipe = Pipeline([
        ("pre", preprocessor),
        ("reg", LinearRegression()),
    ])

    pipe.fit(X_train, y_train)
    y_pred = pipe.predict(X_test)

    r2 = r2_score(y_test, y_pred)
    mae = mean_absolute_error(y_test, y_pred)
    residual_std = float(np.std(y_test - y_pred))

    logger.info("Revenue model — R²=%.4f  MAE=%.2f  residual_σ=%.2f", r2, mae, residual_std)

    bundle = {"pipeline": pipe, "residual_std": residual_std}

    # ---- evaluation guard ----
    incumbent_r2 = _load_incumbent_score()
    if incumbent_r2 is not None and r2 < incumbent_r2 - _TOLERANCE:
        logger.warning(
            "New revenue model R² (%.4f) underperforms incumbent (%.4f) by > %.0f%% tolerance. "
            "Skipping save.",
            r2, incumbent_r2, _TOLERANCE * 100,
        )
        return bundle

    _save_model(pipe, r2, residual_std)
    return bundle


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")
    train_model()
