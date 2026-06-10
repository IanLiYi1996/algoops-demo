import pytest
from agent.tools.candidate import fetch_candidate, list_candidates, slugify


def test_slugify_lowercases_and_hyphenates():
    assert slugify("BGE-M3 Retriever!") == "bge-m3-retriever"


def test_list_candidates_covers_three_tasks():
    tasks = {c["task"] for c in list_candidates()}
    assert {"search", "recommendation", "tagging"} <= tasks


def test_fetch_candidate_returns_claimed_spec():
    c = fetch_candidate("bge-m3")
    assert c["id"] == "bge-m3"
    assert c["task"] == "search"
    assert c["claimed_metrics"]["Recall@10"] == 0.82
    assert "scenario" in c and c["caveats"]


def test_fetch_candidate_is_tolerant_of_formatting():
    # underscores / caps / spaces all normalize to the same id
    assert fetch_candidate("BERT_tagger")["id"] == "bert-tagger"


def test_unknown_candidate_raises():
    with pytest.raises(ValueError):
        fetch_candidate("gpt-does-not-exist")
