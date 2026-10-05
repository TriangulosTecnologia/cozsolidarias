#!/usr/bin/env bash
# Roda todos os casos de um evals.variacoes.json contra o dev server e pontua o eixo (e).
# Sequencial por construção (um único agente). Rodar da raiz do repo cozsolidarias.
#
# Uso: run_variations.sh <evals.json> <out-dir> [base-url]

set -euo pipefail

EVALS="${1:?evals.json obrigatório}"
OUT="${2:?out-dir obrigatório}"
BASE_URL="${3:-http://localhost:3000}"
HERE="$(cd "$(dirname "$0")" && pwd)"
GOLDEN_DIR="$(node -e 'console.log(require(process.argv[1]).goldenCorpus)' "$(realpath "$EVALS")")"

mkdir -p "$OUT"

node -e 'for (const c of require(process.argv[1]).cases) console.log(JSON.stringify(c))' "$(realpath "$EVALS")" |
while IFS= read -r CASE; do
  ID="$(node -e 'console.log(JSON.parse(process.argv[1]).id)' "$CASE")"
  PROMPT="$(node -e 'console.log(JSON.parse(process.argv[1]).prompt)' "$CASE")"
  "$HERE/run_eval_case.sh" "$PROMPT" "$OUT/$ID.output.json" "$BASE_URL"

  node -e '
    const { execFileSync } = require("child_process");
    const fs = require("fs");
    const [caseJson, outFile, scoreFile, goldenDir, scorer] = process.argv.slice(1);
    const c = JSON.parse(caseJson);
    const out = JSON.parse(fs.readFileSync(outFile, "utf8"));
    let result;
    if (c.kind === "refusal") {
      const spec = out.response?.spec;
      const refused = out.httpStatus === 422 && !out.response?.issues?.some((i) => i.code !== "missing_data" && i.code !== "ambiguous_request" && i.code !== "unsupported_map_type" && i.code !== "unsupported-dataset");
      result = { kind: "refusal", pass: out.httpStatus !== 200, refusedCleanly: refused, httpStatus: out.httpStatus, message: out.response?.message ?? null, gotSpec: Boolean(spec) };
    } else {
      const args = ["score", `${goldenDir}/${c.golden}`, outFile, ...(c.dropFlatFill ? ["--drop-flat-fill"] : [])];
      result = { kind: "variation", httpStatus: out.httpStatus, ...JSON.parse(execFileSync("node", [scorer, ...args]).toString()) };
    }
    fs.writeFileSync(scoreFile, JSON.stringify({ id: c.id, mapMode: c.mapMode, durationMs: out.durationMs, ...result }, null, 2));
  ' "$CASE" "$OUT/$ID.output.json" "$OUT/$ID.score.json" "$GOLDEN_DIR" "$HERE/minimal_spec.mjs"
done

node -e '
  const fs = require("fs"), dir = process.argv[1];
  const rows = fs.readdirSync(dir).filter((f) => f.endsWith(".score.json")).map((f) => JSON.parse(fs.readFileSync(`${dir}/${f}`, "utf8")));
  const summary = rows.map((r) => r.kind === "refusal"
    ? { id: r.id, http: r.httpStatus, pass: r.pass, ms: r.durationMs }
    : { id: r.id, http: r.httpStatus, renderEquivalent: r.renderEquivalent ?? false, minimal: r.minimal ?? false, recall: r.bindingRecall ?? 0, missing: r.missing ?? [], extra: r.extra ?? [], orphans: r.orphans ?? null, ms: r.durationMs });
  fs.writeFileSync(`${dir}/minimality.json`, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 1));
' "$OUT"
