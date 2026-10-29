#!/usr/bin/env bash
# Runs every case of an evals.variations.json against the dev server and scores axis (e).
# Sequential by design (single agent). Run from the cozsolidarias repo root.
#
# Goldens: `golden` is relative to GEOVIS_GOLDEN_DIR (default tmp/specs/full/verifield);
# when it starts with `references/`, it is relative to the skill root.
#
# Usage: run_variations.sh <evals.variations.json> <out-dir> [base-url]

set -euo pipefail

# Suspended by default: runs only with GEOVIS_RUN_VARIATIONS=1 (explicit user request).
if [[ "${GEOVIS_RUN_VARIATIONS:-}" != "1" ]]; then
  echo "run_variations.sh is suspended by default; set GEOVIS_RUN_VARIATIONS=1 to run." >&2
  exit 1
fi

EVALS="${1:?evals.variations.json required}"
OUT="${2:?out-dir required}"
BASE_URL="${3:-http://localhost:3000}"
HERE="$(cd "$(dirname "$0")" && pwd)"
GOLDEN_DIR="${GEOVIS_GOLDEN_DIR:-tmp/specs/full/verifield}"
case "$GOLDEN_DIR" in /*) ;; *) GOLDEN_DIR="$PWD/$GOLDEN_DIR" ;; esac

mkdir -p "$OUT"

node -e 'for (const c of require(process.argv[1]).cases) console.log(JSON.stringify(c))' "$(realpath "$EVALS")" |
while IFS= read -r CASE; do
  ID="$(node -e 'console.log(JSON.parse(process.argv[1]).id)' "$CASE")"
  PROMPT="$(node -e 'console.log(JSON.parse(process.argv[1]).prompt)' "$CASE")"
  "$HERE/run_eval_case.sh" "$PROMPT" "$OUT/$ID.output.json" "$BASE_URL"

  node -e '
    const { execFileSync } = require("child_process");
    const fs = require("fs");
    const path = require("path");
    const [caseJson, outFile, scoreFile, goldenDir, scorer, skillDir] = process.argv.slice(1);
    const c = JSON.parse(caseJson);
    const out = JSON.parse(fs.readFileSync(outFile, "utf8"));
    let result;
    if (c.kind === "clarify") {
      const golden = JSON.parse(fs.readFileSync(path.join(skillDir, c.golden), "utf8")).response.clarify;
      const got = out.response?.clarify;
      result = { kind: "clarify", httpStatus: out.httpStatus, gotSpec: Boolean(out.response?.spec), pass: out.httpStatus === 200 && !out.response?.spec && got?.facet === golden.facet && got?.default === golden.default };
    } else if (c.kind === "refusal") {
      const spec = out.response?.spec;
      const refused = out.httpStatus === 422 && !out.response?.issues?.some((i) => i.code !== "missing_data" && i.code !== "ambiguous_request" && i.code !== "unsupported_map_type" && i.code !== "unsupported-dataset");
      result = { kind: "refusal", pass: out.httpStatus !== 200, refusedCleanly: refused, httpStatus: out.httpStatus, message: out.response?.message ?? null, gotSpec: Boolean(spec) };
    } else {
      const goldenPath = c.golden.startsWith("references/") ? path.join(skillDir, c.golden) : path.join(goldenDir, c.golden);
      const args = ["score", goldenPath, outFile, ...(c.dropFlatFill ? ["--drop-flat-fill"] : [])];
      result = { kind: "variation", httpStatus: out.httpStatus, ...JSON.parse(execFileSync("node", [scorer, ...args]).toString()) };
    }
    fs.writeFileSync(scoreFile, JSON.stringify({ id: c.id, mapMode: c.mapMode, durationMs: out.durationMs, ...result }, null, 2));
  ' "$CASE" "$OUT/$ID.output.json" "$OUT/$ID.score.json" "$GOLDEN_DIR" "$HERE/minimal_spec.mjs" "$HERE/.."
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
