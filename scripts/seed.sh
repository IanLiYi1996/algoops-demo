#!/usr/bin/env bash
# seed.sh — pre-seed Memory with a few model-selection conclusions.
# Run once before the booth opens so cross-session recall has content.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
# Candidate models (search / recommendation / tagging) to evaluate & remember.
CANDIDATES=("bge-m3" "sasrec" "bert-tagger")

for id in "${CANDIDATES[@]}"; do
  echo "Seeding evaluation of $id ..."
  "$HERE/demo.sh" "Evaluate candidate model $id: produce its evaluation card and store the selection conclusion." "seed-session" || true
  sleep 2
done
echo "Seed complete."
