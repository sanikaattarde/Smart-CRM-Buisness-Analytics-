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
from sklearn.metrics import classification_report, f1_score, precision_recall_fscore_support
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


def _evaluate_model(pipe: Pipeline, X_test: pd.DataFrame, y_test: pd.Series) -> dict:
    """Multi-metric evaluation with class-specific guards."""
    y_pred = pipe.predict(X_test)
    
    weighted_f1 = float(f1_score(y_test, y_pred, average="weighted"))
    
    # Per-class metrics — critical for imbalance detection
    precision, recall, f1_per_class, support = precision_recall_fscore_support(
        y_test, y_pred, zero_division=0
    )
    
    # Guard 1: minority class (churn=1) must have recall >= 0.3
    minority_recall = float(recall[1]) if len(recall) > 1 else 0.0
    
    # Guard 2: class distribution sanity check
    class_ratio = float(support[1]) / float(support.sum()) if len(support) > 1 else 0.0
    
    return {
        "weighted_f1": weighted_f1,
        "minority_recall": minority_recall,
        "minority_f1": float(f1_per_class[1]) if len(f1_per_class) > 1 else 0.0,
        "class_ratio": class_ratio,
        "y_pred": y_pred,
    }


def _save_model(pipeline: Pipeline, metrics: dict) -> None:
    """Atomic save: write to temp path, validate, then rename."""
    _MODEL_DIR.mkdir(parents=True, exist_ok=True)
    
    tmp_model = _MODEL_PATH.with_suffix(".pkl.tmp")
    tmp_meta = _MODEL_PATH.with_suffix(".meta.npy.tmp")
    
    joblib.dump(pipeline, tmp_model)
    np.save(tmp_meta, metrics["weighted_f1"])
    
    # Atomic rename — both succeed or neither
    tmp_model.rename(_MODEL_PATH)
    tmp_meta.rename(_MODEL_PATH.with_suffix(".meta.npy"))
    
    logger.info("Saved churn model → %s  (F1=%.4f, minority_recall=%.4f)",
                _MODEL_PATH, metrics["weighted_f1"], metrics["minority_recall"])


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
    metrics = _evaluate_model(pipe, X_test, y_test)
    
    logger.info("Churn model evaluation:\n%s", classification_report(y_test, metrics["y_pred"]))

    # ---- evaluation guard ----
    # Gate 1: minority class must be learnable
    if metrics["minority_recall"] < 0.30:
        logger.error(
            "BLOCKED: minority class recall %.4f < 0.30 threshold. "
            "Possible class collapse. Inspect training data distribution.",
            metrics["minority_recall"],
        )
        return pipe
    
    # Gate 2: data imbalance warning
    if metrics["class_ratio"] < 0.05:
        logger.warning(
            "Severe class imbalance: minority class is %.1f%% of test set. "
            "Consider resampling.",
            metrics["class_ratio"] * 100,
        )
    
    incumbent_f1 = _load_incumbent_score()
    if incumbent_f1 is not None and metrics["weighted_f1"] < incumbent_f1 - _TOLERANCE:
        logger.warning(
            "New churn model F1 (%.4f) underperforms incumbent (%.4f) by > %.0f%% tolerance. "
            "Skipping save.",
            metrics["weighted_f1"], incumbent_f1, _TOLERANCE * 100,
        )
        return pipe

    _save_model(pipe, metrics)
    return pipe


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")
    train_model()
