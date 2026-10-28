#!/usr/bin/env bash
# Runs every eval case in `evals/evals.json` against the local dev server,
# sequentially, writing one output per case to <run-dir>/cases/.
#
# Retries once on timeout (502 "demorou demais"): the route's polling ceiling
# is 60s (MAX_POLL_ATTEMPTS × POLL_INTERVAL_MS) and typical latency with effort
# high is ~45s, so an occasional overrun is measurement noise, not signal.
# A case that overruns TWICE is recorded as a real timeout.
#
# Usage: run_campaign.sh <run-dir> [base-url]
set -uo pipefail

RUN_DIR="${1:?run-dir required}"
BASE_URL="${2:-http://localhost:3000}"
SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EVALS="$SKILL_DIR/evals/evals.json"

mkdir -p "$RUN_DIR/cases"

mapfile -t IDS < <(node -p "require('$EVALS').cases.map(c=>c.id).join('\n')")
TOTAL=${#IDS[@]}
i=0

for ID in "${IDS[@]}"; do
  i=$((i + 1))
  OUT="$RUN_DIR/cases/${ID}.json"
  if [[ -f "$OUT" ]] && node -e "process.exit(require('$OUT').httpStatus===200||require('$OUT').httpStatus===422?0:1)" 2>/dev/null; then
    echo "[$i/$TOTAL] $ID — already exists, skipping" >&2
    continue
  fi
  PROMPT="$(node -p "require('$EVALS').cases.find(c=>c.id==='$ID').prompt")"
  for attempt in 1 2; do
    bash "$SKILL_DIR/scripts/run_eval_case.sh" "$PROMPT" "$OUT" "$BASE_URL" >/dev/null 2>&1
    STATUS="$(node -p "require('$OUT').httpStatus" 2>/dev/null || echo 0)"
    MS="$(node -p "require('$OUT').durationMs" 2>/dev/null || echo 0)"
    if [[ "$STATUS" != "502" ]]; then break; fi
    echo "[$i/$TOTAL] $ID — 502 on attempt $attempt (${MS}ms)" >&2
  done
  echo "[$i/$TOTAL] $ID — status $STATUS (${MS}ms)" >&2
done

echo "campaign finished: $TOTAL cases in $RUN_DIR/cases/" >&2
