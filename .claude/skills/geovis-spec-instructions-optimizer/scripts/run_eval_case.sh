#!/usr/bin/env bash
# Roda um caso de eval de verdade contra POST /api/ai/spec de um dev server local
# (assume que `pnpm dev` já está de pé com as env vars da variante sob teste).
#
# Uso: run_eval_case.sh <prompt> <output-file> [base-url]

set -euo pipefail

PROMPT="${1:?prompt obrigatório}"
OUTPUT_FILE="${2:?output-file obrigatório}"
BASE_URL="${3:-http://localhost:3000}"

mkdir -p "$(dirname "$OUTPUT_FILE")"

START_MS="$(date +%s%3N)"

BODY="$(node -e 'console.log(JSON.stringify({ prompt: process.argv[1] }))' "$PROMPT")"

HTTP_STATUS="$(curl -sS -o "${OUTPUT_FILE}.body" -w '%{http_code}' \
  -X POST "${BASE_URL}/api/ai/spec" \
  -H 'Content-Type: application/json' \
  -d "$BODY")"

END_MS="$(date +%s%3N)"
DURATION_MS=$((END_MS - START_MS))

node -e '
  const fs = require("fs");
  const [bodyFile, outFile, status, durationMs, prompt] = process.argv.slice(1);
  let body;
  try {
    body = JSON.parse(fs.readFileSync(bodyFile, "utf8"));
  } catch (err) {
    body = { parseError: String(err), raw: fs.readFileSync(bodyFile, "utf8") };
  }
  fs.writeFileSync(outFile, JSON.stringify({
    prompt,
    httpStatus: Number(status),
    durationMs: Number(durationMs),
    response: body,
  }, null, 2));
  fs.unlinkSync(bodyFile);
' "${OUTPUT_FILE}.body" "$OUTPUT_FILE" "$HTTP_STATUS" "$DURATION_MS" "$PROMPT"

echo "Caso gravado em ${OUTPUT_FILE} (status ${HTTP_STATUS}, ${DURATION_MS}ms)" >&2
