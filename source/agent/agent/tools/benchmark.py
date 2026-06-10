"""Reference benchmark implementations for AlgoOps verification.

These are the metrics AlgoOps re-runs *in the sandbox* to verify a model's
claimed numbers (search → Recall@K/NDCG@K, tagging → F1). Pure-Python (stdlib
math + random), so they run deterministically in the AgentCore Code Interpreter
with no external data or network.

The agent typically sends a small script that builds a synthetic dataset with a
fixed seed, scores it with these functions, and prints the numbers — proving the
metric end-to-end rather than trusting a claimed value.
"""
import math
import random


def recall_at_k(ranked_relevances: list[list[int]], k: int) -> float:
    """Mean Recall@K over queries.

    ranked_relevances[q] is the 0/1 relevance of each result for query q, in
    ranked order. Recall@K = (#relevant in top-K) / (#relevant total).
    """
    vals = []
    for rels in ranked_relevances:
        total = sum(rels)
        if total == 0:
            continue
        hit = sum(rels[:k])
        vals.append(hit / total)
    return sum(vals) / len(vals) if vals else 0.0


def ndcg_at_k(ranked_relevances: list[list[int]], k: int) -> float:
    """Mean NDCG@K over queries (binary relevance)."""
    def dcg(rels):
        return sum(r / math.log2(i + 2) for i, r in enumerate(rels[:k]))

    vals = []
    for rels in ranked_relevances:
        ideal = sorted(rels, reverse=True)
        idcg = dcg(ideal)
        if idcg == 0:
            continue
        vals.append(dcg(rels) / idcg)
    return sum(vals) / len(vals) if vals else 0.0


def f1_score(y_true: list[int], y_pred: list[int]) -> dict:
    """Binary precision / recall / F1 over flat label lists."""
    tp = sum(1 for t, p in zip(y_true, y_pred) if t == 1 and p == 1)
    fp = sum(1 for t, p in zip(y_true, y_pred) if t == 0 and p == 1)
    fn = sum(1 for t, p in zip(y_true, y_pred) if t == 1 and p == 0)
    precision = tp / (tp + fp) if (tp + fp) else 0.0
    recall = tp / (tp + fn) if (tp + fn) else 0.0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) else 0.0
    return {"precision": precision, "recall": recall, "f1": f1}


def synth_retrieval(n_queries=200, depth=20, p_rel=0.15, quality=0.7, seed=42):
    """Build a synthetic ranked-relevance set for a retriever of given quality.

    quality in [0,1] biases relevant docs toward the top of each ranking, so a
    "better" model yields higher Recall@K / NDCG@K — a controllable stand-in for
    a real eval set.
    """
    rng = random.Random(seed)
    out = []
    for _ in range(n_queries):
        rels = [1 if rng.random() < p_rel else 0 for _ in range(depth)]
        # Pull relevant items up with probability ~quality (stable sort by key).
        keyed = sorted(
            range(depth),
            key=lambda i: (-(rels[i]) * (rng.random() < quality), rng.random()),
        )
        out.append([rels[i] for i in keyed])
    return out


def synth_labels(n=500, p_pos=0.3, accuracy=0.85, seed=42):
    """Synthetic ground-truth + predictions for a tagger of given accuracy."""
    rng = random.Random(seed)
    y_true, y_pred = [], []
    for _ in range(n):
        t = 1 if rng.random() < p_pos else 0
        p = t if rng.random() < accuracy else 1 - t
        y_true.append(t)
        y_pred.append(p)
    return y_true, y_pred
