#!/usr/bin/env bash
# demo.sh — booth driver. Invokes the deployed AgentCore runtime over the CLI.
#
# Usage:
#   export RUNTIME_ARN=arn:aws:bedrock-agentcore:us-west-2:ACCT:runtime/xxxx
#   ./scripts/demo.sh "evaluate candidate model bge-m3 and verify its claimed Recall@10" booth-1
set -euo pipefail

PROMPT="${1:-evaluate candidate model bge-m3: produce its evaluation card and store the conclusion}"
SESSION="${2:-booth-1}"
REGION="${AWS_REGION:-us-west-2}"
: "${RUNTIME_ARN:?set RUNTIME_ARN to the deployed runtime ARN (cdk output RuntimeArn)}"

# Session id must be >= 33 chars.
SESSION_ID=$(printf '%s' "$SESSION" | sed 's/[^a-zA-Z0-9_-]//g')
while [ "${#SESSION_ID}" -lt 33 ]; do SESSION_ID="${SESSION_ID}0"; done

BOLD=$(tput bold 2>/dev/null || true); RESET=$(tput sgr0 2>/dev/null || true)
echo "${BOLD}▶ prompt:${RESET} $PROMPT"
echo "${BOLD}▶ session:${RESET} $SESSION_ID"
echo "${BOLD}▶ invoking runtime...${RESET}"

# AWS CLI v2 treats --payload as base64 by default; raw-in-base64-out lets us
# pass the JSON string directly and get the response bytes back decoded.
aws bedrock-agentcore invoke-agent-runtime \
  --agent-runtime-arn "$RUNTIME_ARN" \
  --runtime-session-id "$SESSION_ID" \
  --payload "$(printf '{"prompt": %s, "session_id": "%s"}' "$(printf '%s' "$PROMPT" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')" "$SESSION")" \
  --content-type "application/json" \
  --cli-binary-format raw-in-base64-out \
  --region "$REGION" \
  /dev/stdout
echo
echo "${BOLD}✓ done${RESET}"
