#!/usr/bin/env bash
# smoke.sh — post-deploy sanity checks for AlgoOps. Requires RUNTIME_ARN set.
set -euo pipefail
: "${RUNTIME_ARN:?set RUNTIME_ARN}"
HERE="$(cd "$(dirname "$0")" && pwd)"

echo "== 1. assess a candidate (evaluation card) =="
"$HERE/demo.sh" "Evaluate candidate model bge-m3: produce its evaluation card and store the conclusion." "smoke-A" | tee /tmp/smoke1.txt
grep -iq "bge-m3\|recall\|ndcg\|evaluation" /tmp/smoke1.txt && echo "PASS assess" || { echo "FAIL assess"; exit 1; }

echo "== 2. memory recall in a NEW session =="
"$HERE/demo.sh" "Based on your memory, which models have we already evaluated for search/rec/tagging?" "smoke-B" | tee /tmp/smoke2.txt
grep -iq "bge-m3\|sasrec\|bert-tagger\|recall" /tmp/smoke2.txt && echo "PASS recall" || { echo "FAIL recall"; exit 1; }

echo "== 3. verify claimed metric in sandbox =="
"$HERE/demo.sh" "Verify bge-m3's claimed Recall@10 by running a benchmark in the code interpreter and show the actual numbers." "smoke-C" | tee /tmp/smoke3.txt
grep -Eiq "recall@10|ndcg|[0-9]+\.[0-9]+|verified" /tmp/smoke3.txt && echo "PASS verify" || { echo "FAIL verify"; exit 1; }

echo "ALL SMOKE CHECKS PASSED"
