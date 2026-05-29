"""
Lead scoring pipeline.

Model  : GradientBoostingClassifier
Target : converted_label (binary)
Output : score 0–100 mapped to tier ("hot" / "warm" / "cold")
"""

from __future__ import annotations

import logging
import pathlib

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.metrics import classification_report, f1_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

logger = logging.getLogger(__name__)

_BASE = pathlib.Path(__file__).parents[2]
_DATA_PATH = _BASE / "data" / "leads_seed.csv"
_MODEL_DIR = _BASE / "app" / "models"
_MODEL_PATH = _MODEL_DIR / "lead_scorer_model.pkl"

NUMERIC_FEATURES = [
    "days_in_pipeline",
    "email_responses",
    "meetings_held",
    "deal_value",
]
CATEGORICAL_FEATURES = ["source"]
ALL_FEATURES = CATEGORICAL_FEATURES + NUMERIC_FEATURES
TARGET = "converted_label"
_TOLERANCE = 0.05

# Tier boundaries (applied to 0–100 score)
_HOT_THRESHOLD = 70
_WARM_THRESHOLD = 40


# ---------------------------------------------------------------------------
# Scoring helpers
# ---------------------------------------------------------------------------

def score_leads(pipeline: Pipeline, X: pd.DataFrame) -> pd.DataFrame:
    """Return a DataFrame with score (0–100) and tier for each lead."""
    proba = pipeline.predict_proba(X)[:, 1]
    score = np.round(proba * 100, 1)
    tier = np.where(
        score >= _HOT_THRESHOLD, "hot",
        np.where(score >= _WARM_THRESHOLD, "warm", "cold"),
    )
    return pd.DataFrame({"score": score, "tier": tier})


# ---------------------------------------------------------------------------
# Model persistence helpers
# ---------------------------------------------------------------------------

def _load_incumbent_score() -> float | None:
    meta_path = _MODEL_PATH.with_suffix(".meta.npy")
    if meta_path.exists():
        return float(np.load(meta_path))
    return None


def _save_model(pipeline: Pipeline, score: float) -> None:
    _MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipeline, _MODEL_PATH)
    np.save(_MODEL_PATH.with_suffix(".meta.npy"), score)
    logger.info("Saved lead scorer model → %s  (F1=%.4f)", _MODEL_PATH, score)


# ---------------------------------------------------------------------------
# Training
# ---------------------------------------------------------------------------

def train_model() -> Pipeline:
    """Train, evaluate, and conditionally persist the lead scoring model."""
    df = pd.read_csv(_DATA_PATH)
    X = df[ALL_FEATURES]
    y = df[TARGET]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y,
    )

    preprocessor = ColumnTransformer(
        transformers=[
            ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), CATEGORICAL_FEATURES),
            ("num", StandardScaler(), NUMERIC_FEATURES),
        ],
        remainder="drop",
    )

    pipe = Pipeline([
        ("pre", preprocessor),
        ("clf", GradientBoostingClassifier(
            n_estimators=200,
            max_depth=5,
            learning_rate=0.1,
            subsample=0.8,
            min_samples_leaf=10,
            random_state=42,
        )),
    ])

    pipe.fit(X_train, y_train)
    y_pred = pipe.predict(X_test)
    new_f1 = f1_score(y_test, y_pred, average="weighted")

    logger.info("Lead scorer evaluation:\n%s", classification_report(y_test, y_pred))

    # Score distribution on test set
    scores_df = score_leads(pipe, X_test)
    tier_dist = scores_df["tier"].value_counts().to_dict()
    logger.info("Test-set tier distribution: %s", tier_dist)

    # ---- evaluation guard ----
    incumbent_f1 = _load_incumbent_score()
    if incumbent_f1 is not None and new_f1 < incumbent_f1 - _TOLERANCE:
        logger.warning(
            "New lead scorer F1 (%.4f) underperforms incumbent (%.4f) by > %.0f%% tolerance. "
            "Skipping save.",
            new_f1, incumbent_f1, _TOLERANCE * 100,
        )
        return pipe

    _save_model(pipe, new_f1)
    return pipe


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")
    train_model()
