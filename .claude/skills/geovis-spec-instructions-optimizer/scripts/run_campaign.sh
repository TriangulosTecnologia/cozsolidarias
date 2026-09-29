#!/usr/bin/env bash
# Roda todos os eval cases de `evals/evals.json` contra o dev server local,
# sequencialmente, gravando um output por caso em <run-dir>/cases/.
#
# Retenta uma vez em timeout (502 "demorou demais"): o teto de polling da rota
# é 60s (MAX_POLL_ATTEMPTS × POLL_INTERVAL_MS) e a latência típica com effort
# high fica em ~45s, então um estouro ocasional é ruído de medição, não sinal.
# Um caso que estoura DUAS vezes é registrado como timeout de verdade.
#
# Uso: run_campaign.sh <run-dir> [base-url]
set -uo pipefail

RUN_DIR="${1:?run-dir obrigatório}"
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
    echo "[$i/$TOTAL] $ID — já existe, pulando" >&2
    continue
  fi
  PROMPT="$(node -p "require('$EVALS').cases.find(c=>c.id==='$ID').prompt")"
  for attempt in 1 2; do
    bash "$SKILL_DIR/scripts/run_eval_case.sh" "$PROMPT" "$OUT" "$BASE_URL" >/dev/null 2>&1
    STATUS="$(node -p "require('$OUT').httpStatus" 2>/dev/null || echo 0)"
    MS="$(node -p "require('$OUT').durationMs" 2>/dev/null || echo 0)"
    if [[ "$STATUS" != "502" ]]; then break; fi
    echo "[$i/$TOTAL] $ID — 502 na tentativa $attempt (${MS}ms)" >&2
  done
  echo "[$i/$TOTAL] $ID — status $STATUS (${MS}ms)" >&2
done

echo "campanha concluída: $TOTAL casos em $RUN_DIR/cases/" >&2
