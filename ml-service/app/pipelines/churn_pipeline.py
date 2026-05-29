"""
Churn prediction pipeline.

Model  : RandomForestClassifier (class_weight='balanced')
Target : churn_label (binary)
Output : churn probability ∈ [0, 1]
"""

from __future__ import annotations

import logging
import pathlib

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, f1_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

logger = logging.getLogger(__name__)

_BASE = pathlib.Path(__file__).parents[2]
_DATA_PATH = _BASE / "data" / "customers_seed.csv"
_MODEL_DIR = _BASE / "app" / "models"
_MODEL_PATH = _MODEL_DIR / "churn_model.pkl"

FEATURES = [
    "days_since_last_interaction",
    "purchase_frequency",
    "total_revenue",
    "support_tickets",
    "email_open_rate",
]
TARGET = "churn_label"
_TOLERANCE = 0.05  # new model must be within 5% of incumbent


def _load_incumbent_score() -> float | None:
    """Return the F1 score stored alongside the incumbent model, or None."""
    meta_path = _MODEL_PATH.with_suffix(".meta.npy")
    if meta_path.exists():
        return float(np.load(meta_path))
    return None


def _save_model(pipeline: Pipeline, score: float) -> None:
    _MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipeline, _MODEL_PATH)
    np.save(_MODEL_PATH.with_suffix(".meta.npy"), score)
    logger.info("Saved churn model → %s  (F1=%.4f)", _MODEL_PATH, score)


def train_model() -> Pipeline:
    """Train, evaluate, and conditionally persist the churn model."""
    df = pd.read_csv(_DATA_PATH)
    X = df[FEATURES]
    y = df[TARGET]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y,
    )

    preprocessor = ColumnTransformer(
        transformers=[("num", StandardScaler(), FEATURES)],
        remainder="drop",
    )

    pipe = Pipeline([
        ("pre", preprocessor),
        ("clf", RandomForestClassifier(
            n_estimators=200,
            max_depth=12,
            min_samples_leaf=5,
            class_weight="balanced",
            random_state=42,
            n_jobs=-1,
        )),
    ])

    pipe.fit(X_train, y_train)
    y_pred = pipe.predict(X_test)
    new_f1 = f1_score(y_test, y_pred, average="weighted")

    logger.info("Churn model evaluation:\n%s", classification_report(y_test, y_pred))

    # ---- evaluation guard ----
    incumbent_f1 = _load_incumbent_score()
    if incumbent_f1 is not None and new_f1 < incumbent_f1 - _TOLERANCE:
        logger.warning(
            "New churn model F1 (%.4f) underperforms incumbent (%.4f) by > %.0f%% tolerance. "
            "Skipping save.",
            new_f1, incumbent_f1, _TOLERANCE * 100,
        )
        return pipe

    _save_model(pipe, new_f1)
    return pipe


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")
    train_model()
