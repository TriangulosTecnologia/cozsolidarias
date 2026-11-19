#!/usr/bin/env bash
# Runs every eval case in `evals/evals.json` against the local dev server by default
# (base-url: the host root, POST <base-url>/api/ai/spec; /ia is only the UI page),
# sequentially, writing one output per case to <run-dir>/cases/. Progress goes
# to stderr and <run-dir>/campaign.log; report_run.mjs then writes
# eval-report.json and SUMMARY.md.
#
# Retries once on timeout (502 "demorou demais"): the route's polling ceiling
# is 60s (MAX_POLL_ATTEMPTS × POLL_INTERVAL_MS) and typical latency with effort
# high is ~45s, so an occasional overrun is measurement noise, not signal.
# A case that overruns TWICE is recorded as a real timeout.
#
# Optional filter: comma-separated case ids or globs (`*` wildcard), taken from
# the third argument or $CASES. Empty or `*` runs every case.
#
# Usage: run_campaign.sh <run-dir> [base-url] [filter]
# Example: run_campaign.sh runs/ivs-idhm https://host '*ivs*,*idhm*'
set -uo pipefail

FILTER="${3:-${CASES:-*}}"
SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="${1:-$SKILL_DIR/runs/$(date -u +%Y%m%dT%H%M%SZ)--campaign}"
BASE_URL="${2:-http://localhost:3000}"
EVALS="$SKILL_DIR/evals/evals.json"

mkdir -p "$RUN_DIR/cases"
exec 2> >(tee -a "$RUN_DIR/campaign.log" >&2)
TEE_PID=$!

# Here-string, not `< <(...)`: a later process substitution makes bash forget TEE_PID.
mapfile -t IDS <<< "$(node -e "
  const globs = process.argv[1].split(',').map((g) => g.trim()).filter(Boolean);
  const res = globs.map((g) => new RegExp('^' + g.split('*').map((s) => s.replace(/[.+?^\${}()|[\]\\\\]/g, '\\\\$&')).join('.*') + '$'));
  require('$EVALS').cases.map((c) => c.id).filter((id) => res.some((r) => r.test(id))).forEach((id) => console.log(id));
" "$FILTER")"
[[ -z "${IDS[*]}" ]] && IDS=()
TOTAL=${#IDS[@]}
if [[ "$TOTAL" -eq 0 ]]; then
  echo "no case matches filter '$FILTER'" >&2
  exit 1
fi
i=0

for ID in "${IDS[@]}"; do
  i=$((i + 1))
  OUT="$RUN_DIR/cases/${ID}.json"
  if ! NEEDS="$(node -e "const env=require('$EVALS').cases.find(c=>c.id==='$ID').env??{};if(!Object.entries(env).every(([k,v])=>(process.env[k]==='true')===v)){console.log(JSON.stringify(env));process.exit(1)}")"; then
    echo "[$i/$TOTAL] $ID — skipped: needs server env $NEEDS" >&2
    continue
  fi
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
  node "$SKILL_DIR/scripts/score_case.mjs" "$OUT" "$SKILL_DIR/../../.." --case="$ID" >&2 || true
done

echo "campaign finished: $TOTAL cases in $RUN_DIR/cases/" >&2
node "$SKILL_DIR/scripts/report_run.mjs" "$RUN_DIR" >&2
exec 2>&-
wait "$TEE_PID" # flush campaign.log before returning
