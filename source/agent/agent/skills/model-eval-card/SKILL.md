---
name: model-eval-card
description: Use in the Assess stage to turn a candidate model's source material into a structured evaluation card for enterprise search / recommendation / tagging model selection. Separates claimed from to-be-verified.
---

# Evaluation Card Methodology

Produce a concise, structured **evaluation card** for one candidate model. The
card is decision-support for model selection — it must make the
"looks-great-offline-breaks-in-production" risks explicit.

Fill these sections:

1. **Candidate** — name, task (search / recommendation / tagging), intended scenario.
2. **Claimed metrics** — exactly as the source material states them
   (e.g. `Recall@10=0.82`, `NDCG@10=0.71`, `F1=0.88`). Label them **CLAIMED**.
3. **Dataset & protocol** — what benchmark/dataset and metric definition the
   claim used. Flag mismatches with our own corpus / metric definition.
4. **Risks** — data leakage, undisclosed thresholds, scenario gap (e.g. English
   benchmark vs CJK queries), latency/cost unverified at our scale.
5. **To verify** — the single most important number to re-run in the sandbox,
   and on what (synthetic stand-in is fine for the demo).

## Rules

- Always label numbers **CLAIMED** vs **VERIFIED**. Never present a claimed
  number as if you confirmed it.
- One card = one candidate. To compare models, produce one card each, then a
  short verdict.
- Prefer the metric that matches the production scenario (retrieval → Recall@K /
  NDCG@K; tagging → F1), not whatever the vendor reported.
