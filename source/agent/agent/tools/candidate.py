"""Look up a candidate model's claimed spec for the evaluation card.

Pure function, no AgentCore dependency. Backed by a small built-in catalog of
search / recommendation / tagging models so the demo is deterministic and
offline-safe (the AgentCore Code Interpreter sandbox may have no egress). The
returned spec is the *claimed* side — the agent later re-runs a benchmark in the
sandbox to produce the *verified* numbers.
"""
import re

# Built-in catalog of candidate models for enterprise search/rec/tagging model
# selection. Metrics here are CLAIMED (as a source material would state them);
# AlgoOps re-verifies them in the sandbox.
_CATALOG = {
    "bge-m3": {
        "name": "BGE-M3",
        "task": "search",  # dense retrieval / embeddings
        "claimed_metrics": {"Recall@10": 0.82, "NDCG@10": 0.71},
        "dataset": "MIRACL / internal query-doc relevance",
        "scenario": "Multilingual semantic search & retrieval",
        "caveats": [
            "Claimed on public benchmarks — may not match our tagged corpus.",
            "Dense retrieval needs a vector index; latency at scale unverified.",
        ],
    },
    "e5-large": {
        "name": "E5-large-v2",
        "task": "search",
        "claimed_metrics": {"Recall@10": 0.79, "NDCG@10": 0.68},
        "dataset": "BEIR (avg)",
        "scenario": "English dense retrieval",
        "caveats": ["English-centric; degrades on CJK queries."],
    },
    "sasrec": {
        "name": "SASRec",
        "task": "recommendation",  # sequential recommendation
        "claimed_metrics": {"Recall@10": 0.31, "NDCG@10": 0.18},
        "dataset": "MovieLens-1M",
        "scenario": "Sequential next-item recommendation",
        "caveats": [
            "Reported on MovieLens; sparse cold-start behavior unverified.",
            "Metric definition (leave-one-out) may differ from ours.",
        ],
    },
    "bert-tagger": {
        "name": "BERT-base tagger",
        "task": "tagging",  # multi-label classification
        "claimed_metrics": {"F1": 0.88, "Precision": 0.90, "Recall": 0.86},
        "dataset": "Internal content-tag set (vendor-reported)",
        "scenario": "Multi-label content tagging",
        "caveats": [
            "Vendor-reported F1 — threshold and label set not disclosed.",
            "Risk of train/test leakage on the reported split.",
        ],
    },
}


def slugify(text: str) -> str:
    text = re.sub(r"[^a-z0-9]+", "-", text.lower())
    return text.strip("-")


def list_candidates() -> list[dict]:
    """Return the catalog as lightweight {id, name, task} rows."""
    return [
        {"id": cid, "name": c["name"], "task": c["task"]}
        for cid, c in _CATALOG.items()
    ]


def fetch_candidate(model_id: str) -> dict:
    """Return the claimed spec for a candidate model.

    Args:
        model_id: A catalog id, e.g. "bge-m3", "sasrec", "bert-tagger".
                  Matching is case-insensitive and tolerant of spaces/underscores.
    """
    key = slugify(model_id)
    spec = _CATALOG.get(key)
    if spec is None:
        known = ", ".join(_CATALOG)
        raise ValueError(f"Unknown candidate {model_id!r}. Known: {known}")
    return {
        "id": key,
        "name": spec["name"],
        "task": spec["task"],
        "claimed_metrics": dict(spec["claimed_metrics"]),
        "dataset": spec["dataset"],
        "scenario": spec["scenario"],
        "caveats": list(spec["caveats"]),
        "slug": slugify(spec["name"]),
    }
