#!/usr/bin/env bash
# Runs one real eval case against POST /api/ai/spec on a local dev server
# (assumes `pnpm dev` is already up with the env vars of the variant under test).
#
# Usage: run_eval_case.sh <prompt> <output-file> [base-url]

set -euo pipefail

PROMPT="${1:?prompt required}"
OUTPUT_FILE="${2:?output-file required}"
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

echo "Case written to ${OUTPUT_FILE} (status ${HTTP_STATUS}, ${DURATION_MS}ms)" >&2
