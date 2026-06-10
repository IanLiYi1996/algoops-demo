from agent.tools.benchmark import (
    recall_at_k,
    ndcg_at_k,
    f1_score,
    synth_retrieval,
    synth_labels,
)


def test_recall_at_k_basic():
    # one query: 2 relevant total, 1 in top-2 → recall@2 = 0.5
    assert recall_at_k([[1, 0, 1, 0]], 2) == 0.5
    # all relevant captured in top-k → 1.0
    assert recall_at_k([[1, 1, 0, 0]], 2) == 1.0


def test_ndcg_at_k_perfect_ranking_is_one():
    # relevant items already at the top → NDCG = 1.0
    assert ndcg_at_k([[1, 1, 0, 0]], 4) == 1.0
    # a worse ranking scores strictly below 1.0
    assert ndcg_at_k([[0, 1, 1, 0]], 4) < 1.0


def test_f1_score_perfect_and_partial():
    perfect = f1_score([1, 0, 1, 0], [1, 0, 1, 0])
    assert perfect["f1"] == 1.0
    partial = f1_score([1, 1, 0, 0], [1, 0, 0, 0])
    assert 0.0 < partial["f1"] < 1.0


def test_synth_retrieval_is_deterministic_and_quality_orders_metrics():
    a = synth_retrieval(seed=42)
    b = synth_retrieval(seed=42)
    assert a == b  # deterministic
    # a higher-quality retriever should score higher Recall@10
    lo = recall_at_k(synth_retrieval(quality=0.4, seed=1), 10)
    hi = recall_at_k(synth_retrieval(quality=0.9, seed=1), 10)
    assert hi >= lo


def test_synth_labels_accuracy_tracks_f1():
    y_true, y_pred = synth_labels(accuracy=0.95, seed=7)
    good = f1_score(y_true, y_pred)["f1"]
    y_true2, y_pred2 = synth_labels(accuracy=0.6, seed=7)
    poor = f1_score(y_true2, y_pred2)["f1"]
    assert good > poor
