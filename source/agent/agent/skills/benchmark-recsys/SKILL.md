---
name: benchmark-recsys
description: Use in the Verify stage to actually re-run a search/recommendation/tagging benchmark (Recall@K, NDCG@K, F1) in the Code Interpreter sandbox on a small synthetic dataset, and compare verified numbers against the claimed ones.
---

# Benchmark & Verify Methodology ("AI verifies AI")

Re-run the metric yourself in the sandbox — do not trust the claimed number.
Use a small **synthetic** dataset (seeded) so the run is deterministic and needs
no network or external data.

## Procedure

1. Pick the metric that matches the candidate's task:
   - **search / retrieval** → `Recall@K`, `NDCG@K`
   - **recommendation** → `Recall@K`, `NDCG@K` (ranked relevances)
   - **tagging / classification** → `F1` (precision / recall)
2. Build a seeded synthetic dataset whose difficulty/quality you control, so a
   "better" model scores higher — a transparent stand-in for a real eval set.
3. Run it in the Code Interpreter sandbox and print the ACTUAL numbers.
4. Compare **VERIFIED** vs **CLAIMED**; call out any gap and whether the claim
   survives.

## Reference implementation (copy into the sandbox)

Pure stdlib — runs as-is in the AgentCore Code Interpreter:

```python
import math, random

def recall_at_k(ranked, k):
    vals=[]
    for rels in ranked:
        tot=sum(rels)
        if tot: vals.append(sum(rels[:k])/tot)
    return sum(vals)/len(vals) if vals else 0.0

def ndcg_at_k(ranked, k):
    dcg=lambda r: sum(x/math.log2(i+2) for i,x in enumerate(r[:k]))
    vals=[]
    for rels in ranked:
        idcg=dcg(sorted(rels,reverse=True))
        if idcg: vals.append(dcg(rels)/idcg)
    return sum(vals)/len(vals) if vals else 0.0

def f1(y_true,y_pred):
    tp=sum(t==1 and p==1 for t,p in zip(y_true,y_pred))
    fp=sum(t==0 and p==1 for t,p in zip(y_true,y_pred))
    fn=sum(t==1 and p==0 for t,p in zip(y_true,y_pred))
    P=tp/(tp+fp) if tp+fp else 0.0; R=tp/(tp+fn) if tp+fn else 0.0
    return 2*P*R/(P+R) if P+R else 0.0

# synthetic retrieval eval for a model of given `quality` in [0,1]
rng=random.Random(42); ranked=[]
for _ in range(200):
    rels=[1 if rng.random()<0.15 else 0 for _ in range(20)]
    order=sorted(range(20), key=lambda i:(-(rels[i])*(rng.random()<0.7), rng.random()))
    ranked.append([rels[i] for i in order])
print("VERIFIED Recall@10 =", round(recall_at_k(ranked,10),4))
print("VERIFIED NDCG@10   =", round(ndcg_at_k(ranked,10),4))
```

## Rules

- Print both the numbers AND keep the code visible — the proof is the run.
- State the dataset is synthetic; the point is the *verification methodology*,
  not the absolute value.
- If verified << claimed, that is the headline: "claim does not survive
  re-run under our protocol."
