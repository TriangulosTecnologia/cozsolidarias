# Practical Example: Full-Evalued Generation vs Runtime-Captured

> **Outdated (audit of 2026-10-27).** The examples below use `full-evalued/` and the old transport formation. For the current execution, follow `SKILL.md` (Steps 0 to 6). The paths and the manifest output in this file do not match the current checkout.

Complete walkthrough with real data from the cozsolidarias repo.

---

## Scenario

You are optimizing `INSTRUCTIONS` in `src/app/api/ai/spec/instructions.ts` and want to measure whether pruning some lines breaks any robustness. You need to:

1. Generate the golden corpus (full-evalued)
2. Design the eval cases (evals.json)
3. Capture the agent's output (runtime-captured)
4. Compare against the golden

---

## Step 1: Generate Full-Evalued Specs

### Command

```bash
cd /home/triangulos/Documentos/repos/cozsolidarias

node --experimental-strip-types \
  ~/.claude/skills/geovis-spec-gate-optimizer/scripts/dump_golden_specs.mjs
```

### What Happens

The script runs the real production `buildSpec()`, generating one JSON per `MapMode`:

```
src/app/(features)/mapas/specs/full-evalued/
├── coropletico.json              ← generic choropleth map
├── coropletico-idhm.json         ← IDHM (education, health, income, longevity)
├── coropletico-ivs.json          ← Social Vulnerability (3 sub-indices)
├── coropletico-cafs-percentual.json
├── coropletico-cadinsan-com-pbf.json
├── coropletico-cadinsan-sem-pbf.json
├── coropletico-cadunico.json
├── circulos.json                 ← Bubbles (point+sizeBy)
├── pontos.json                   ← Points (categorical)
├── assentamentos.json
├── cafs.json
├── cafs-hexbin.json
└── manifest.json                 ← Provenance
```

### Manifest (Real Example)

```json
{
  "generatedAt": "2026-09-20T16:48:10.909Z",
  "generator": "geovis-spec-gate-optimizer/scripts/dump_golden_specs.mjs",
  "source": "src/app/(features)/mapas/geovisSpec.ts#buildSpec",
  "gitSha": "b68d3147d8ca04134a03a95880870b1713883108",
  "geovisVersion": "0.21.1",
  "dataRowsElided": false,
  "datasets": {
    "cozinhasPorMunicipio": { "rows": 347 },
    "ivsPorMunicipio": { "rows": 5565 },
    "cafsPorMunicipio": { "rows": 5524 },
    "cadinsanPorMunicipio": { "rows": 5570 },
    "cafHexbin": { "present": true },
    "cafPontosPorUf": { "present": true }
  },
  "modes": [
    { "mode": "coropletico", "datasetId": "cozinhasPorMunicipio", "status": "ok" },
    { "mode": "pontos", "datasetId": "cozinhasPorMunicipio", "status": "ok" },
    ...
  ]
}
```

**Meaning:**
- `gitSha`: the commit that generated this — if it changed, the specs have aged
- `dataRowsElided: false`: raw data was **not** removed (`--full` was passed)
- `datasets`: row counts of each real dataset
- `modes`: list of MapModes tested (23 total, 14 unique)

### Structure of a Golden Spec

```json
{
  "schemaVersion": 2,
  "mapData": [
    {
      "id": "cozinhas-por-municipio",
      "data": [
        { "id": "3500308", "value": 12.5 },
        { "id": "3500407", "value": 18.3 },
        ...
      ]
    }
  ],
  "layers": [
    {
      "id": "municipios-fill",
      "type": "fill",
      "source": "geometria-municipios",
      "paint": { "fill-color": ["case", [...], "#ffffff"] }
    }
  ],
  "legends": [
    {
      "id": "municipios-legend",
      "title": "Estabelecimentos",
      "scale": "quantitative",
      "stops": [
        { "value": 0, "label": "0", "color": "#f7fbff" },
        { "value": 25, "label": "25+", "color": "#08519c" }
      ]
    }
  ],
  "basemapStyle": "https://api.mapbox.com/styles/v1/mapbox/light-v10"
}
```

---

## Step 2: Extract the Delta (Comparable Structure)

The script identifies what varies between production specs — that is, **what is the agent's responsibility**.

```bash
node scripts/project_spec.mjs extract-delta \
  src/app/\(features\)/mapas/specs/full-evalued/coropletico-cafs-percentual.json
```

**Output (example):**

```json
{
  "geometry": {
    "source": "geometria-municipios",
    "geoJsonUrl": "/geo/geojs-100-mun.json",
    "geometryType": "polygon"
  },
  "form": "choropleth",
  "legendScale": "quantitative",
  "dataset": {
    "id": "cozinhas-por-municipio",
    "rowCount": 347,
    "valueKind": "quantitative",
    "sample": [
      { "id": "3500308", "value": 12.5 },
      { "id": "3500407", "value": 18.3 }
    ]
  }
}
```

**Key: this is the delta — the thing the agent needs to produce correctly.**

---

## Step 3: Design Eval Cases and evals.json

Create a prompt **from the delta**, never from the JSON file:

```json
{
  "cases": [
    {
      "name": "cafs-percentual",
      "prompt": "mapa coroplético do percentual de estabelecimentos com CAF por município",
      "golden": "coropletico-cafs-percentual.json",
      "coverageRuleId": "R-choropleth-cafs",
      "expectedStatus": 200
    },
    {
      "name": "idhm-educacao",
      "prompt": "mapa coroplético do IDHM educação (escolaridade média) por município",
      "golden": "coropletico-idhm-educacao.json",
      "coverageRuleId": "R-choropleth-idhm",
      "expectedStatus": 200
    },
    {
      "name": "geometry-error",
      "prompt": "mapa com geometria impossível (estado-por-regiao)",
      "golden": null,
      "coverageRuleId": "R-geometry-must-exist",
      "expectedStatus": 422
    },
    ...
  ]
}
```

**File:** `runs/2026-09-18T14-03-11Z--poda-legend/evals/evals.json`

The prompts above are test inputs in pt-BR, kept verbatim: "mapa coroplético do percentual de estabelecimentos com CAF por município" (choropleth map of the percentage of establishments with CAF per municipality), "mapa coroplético do IDHM educação (escolaridade média) por município" (choropleth map of IDHM education, average schooling, per municipality), "mapa com geometria impossível (estado-por-regiao)" (map with impossible geometry, state-by-region).

---

## Step 4: Capture Runtime-Captured Specs

### Pre-Eval Setup

```bash
# 1. Provision the test agent (once)
~/.claude/skills/geovis-spec-gate-optimizer/scripts/provision_test_agent.sh create

# Result: variants/test-agent.json with agentId

# 2. Start the dev server with the test agent
ANTHROPIC_AGENT_ID=$(jq -r '.agentId' variants/test-agent.json) pnpm dev

# 3. Create the versioning snapshot
mkdir -p runs/2026-09-18T14-03-11Z--poda-legend
cat > runs/2026-09-18T14-03-11Z--poda-legend/versions.json <<'EOF'
{
  "runId": "2026-09-18T14-03-11Z--poda-legend",
  "skillVersion": "1.4.0",
  "sources": {
    "agentSystemPrompt": { "path": "~/geovis-spec-generator.md", "sha256": "..." },
    "instructions": { "path": "src/app/api/ai/spec/instructions.ts", "gitSha": "b68d314...", "sha256": "..." }
  },
  "spec": { "schemaVersion": 2, "libSchemaVersion": 1, "geovisPackageVersion": "0.21.1" }
}
EOF
```

### Running One Case

```bash
scripts/run_eval_case.sh \
  "mapa coroplético do percentual de estabelecimentos com CAF por município" \
  "runs/2026-09-18T14-03-11Z--poda-legend/evals/cafs-percentual/output.json"
```

**Output (runtime-captured generated):**

```json
{
  "prompt": "mapa coroplético do percentual de estabelecimentos com CAF por município",
  "httpStatus": 200,
  "durationMs": 2847,
  "response": {
    "schemaVersion": 2,
    "mapData": [
      {
        "id": "cozinhas-por-municipio",
        "data": { "__placeholder__": "real data injected server-side" }
      }
    ],
    "layers": [
      {
        "id": "municipios-fill",
        "type": "fill",
        "source": "geometria-municipios",
        "paint": { "fill-color": [...] }
      }
    ],
    "legends": [
      {
        "id": "municipios-legend",
        "title": "Estabelecimentos CAF",
        "scale": "quantitative",
        "stops": [
          { "value": 0, "label": "0", "color": "#f7fbff" },
          { "value": 25, "label": "25+", "color": "#08519c" }
        ]
      }
    ]
  }
}
```

**Note:** `data` is a placeholder — the route handler injects the real data server-side. What matters is the **binding structure**.

### Running All Cases

```bash
for CASE in $(jq -r '.cases[].name' evals/evals.json); do
  PROMPT=$(jq -r ".cases[] | select(.name == \"$CASE\") | .prompt" evals/evals.json)
  scripts/run_eval_case.sh "$PROMPT" "evals/$CASE/output.json"
  sleep 1  # Avoids rate limiting
done
```

**Result:** `evals/cafs-percentual/output.json`, `evals/idhm-educacao/output.json`, etc. — all runtime-captured.

---

## Step 5: Compare Full-Evalued ↔ Runtime-Captured

### Structural Comparison

```bash
# For the "cafs-percentual" case:
node scripts/project_spec.mjs compare \
  <(node scripts/project_spec.mjs extract-delta \
    src/app/\(features\)/mapas/specs/full-evalued/coropletico-cafs-percentual.json) \
  runs/2026-09-18T14-03-11Z--poda-legend/evals/cafs-percentual/output.json
```

**Output (scores per axis):**

```json
{
  "geometry": {
    "expected": "geometria-municipios:/geo/geojs-100-mun.json[polygon]",
    "actual": "geometria-municipios:/geo/geojs-100-mun.json[polygon]",
    "score": 1.0,
    "match": true
  },
  "form": {
    "expected": "choropleth",
    "actual": "choropleth",
    "score": 1.0,
    "match": true
  },
  "legendScale": {
    "expected": "quantitative",
    "actual": "quantitative",
    "score": 1.0,
    "match": true
  },
  "dataset": {
    "note": "semantic — delegated to grader.md",
    "score": null,
    "match": "pending"
  }
}
```

### Coverage Gate

For each coverage case (`coverageRuleId`):

```bash
node scripts/score_case.mjs \
  runs/2026-09-18T14-03-11Z--poda-legend/evals/cafs-percentual/output.json
```

**Output:**

```json
{
  "case": "cafs-percentual",
  "coverageRuleId": "R-choropleth-cafs",
  "httpStatus": 200,
  "validated": true,
  "errors": [],
  "pass": true
}
```

If any case with a `coverageRuleId` returns `pass: false`, the variant is discarded.

---

## Step 6: Consolidate Results

```bash
node ../../skill-creator/scripts/aggregate_benchmark.py \
  runs/2026-09-18T14-03-11Z--poda-legend/evals/*/output.json \
  > runs/2026-09-18T14-03-11Z--poda-legend/benchmark.json
```

**Example (benchmark.json):**

```json
{
  "runId": "2026-09-18T14-03-11Z--poda-legend",
  "summary": {
    "totalCases": 15,
    "passingCases": 15,
    "coverageGate": "pass",
    "avgDurationMs": 2847,
    "tokensSaved": 234
  },
  "byCase": [
    {
      "name": "cafs-percentual",
      "prompt": "mapa coroplético...",
      "status": 200,
      "durationMs": 2847,
      "geometry": 1.0,
      "form": 1.0,
      "legendScale": 1.0,
      "dataset": "pending"
    },
    ...
  ]
}
```

---

## Final Structure

```
runs/2026-09-18T14-03-11Z--poda-legend/
├── versions.json                     ← Manifest (versions.ts, skill, schema)
├── evals/
│   ├── evals.json                    ← Case definitions
│   ├── cafs-percentual/
│   │   └── output.json               ← runtime-captured (generated by the agent)
│   ├── idhm-educacao/
│   │   └── output.json               ← runtime-captured
│   └── ... (13 more cases)
├── benchmark.json                    ← Score aggregate
├── benchmark.md                      ← Human-readable
├── coverage-gate.json                ← Per R-*, passed/failed
├── proposed-patch-generic-agent.md   ← Diff for the agent (if approved)
└── proposed-patch-instructions.diff  ← Diff for INSTRUCTIONS (if approved)
```

---

## Decision: Accept or Reject

**Acceptance criteria:**

1. ✅ Coverage gate: 100% of R-* cases pass
2. ✅ Fidelity: 90%+ of golden cases with geometry/form/legendScale = 1.0
3. ✅ Efficiency: input tokens reduced without regression
4. ✅ Review: user approval after explanation

**If rejected:** back to the drawing board, try another variant.

**If accepted:** apply the patch via `geovis-spec-agent-creator` (generic agent) or merge a PR (INSTRUCTIONS).

---

## Full Checklist

- [ ] `node dump_golden_specs.mjs` ran successfully
- [ ] `manifest.json` contains the expected git SHA
- [ ] `evals.json` filled in (golden + coverage cases)
- [ ] Test agent provisioned (`variants/test-agent.json`)
- [ ] `pnpm dev` running with `ANTHROPIC_AGENT_ID=<test-agent-id>`
- [ ] All eval cases captured (`output.json`)
- [ ] Coverage gate: 100% of R-* pass
- [ ] All scores consolidated (`benchmark.json`)
- [ ] Recommendation documented in `runs/<runId>/`
- [ ] Ready for delivery (or rejection with justification)
