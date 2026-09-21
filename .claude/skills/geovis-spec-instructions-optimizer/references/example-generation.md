# Exemplo Prático: Geração de Full-Evalued vs Runtime-Captured

Walkthrough completo com dados reais do repo cozsolidarias.

---

## Cenário

Você está otimizando `INSTRUCTIONS` em `src/app/api/ai/spec/instructions.ts` e quer medir se uma poda de linhas quebra alguma robustez. Precisa:

1. Gerar golden corpus (full-evalued)
2. Desenhar eval cases (evals.json)
3. Capturar output do agente (runtime-captured)
4. Comparar contra golden

---

## Passo 1: Gerar Full-Evalued Specs

### Comando

```bash
cd /home/triangulos/Documentos/repos/cozsolidarias

node --experimental-strip-types \
  ~/.claude/skills/geovis-spec-instructions-optimizer/scripts/dump_golden_specs.mjs
```

### O Que Acontece

Script roda `buildSpec()` de verdade da produção, gerando um JSON por `MapMode`:

```
src/app/(features)/mapas/specs/full-evalued/
├── coropletico.json              ← mapa coroplético genérico
├── coropletico-idhm.json         ← IDHM (educação, saúde, renda, longevidade)
├── coropletico-ivs.json          ← Vulnerabilidade Social (3 subíndices)
├── coropletico-cafs-percentual.json
├── coropletico-cadinsan-com-pbf.json
├── coropletico-cadinsan-sem-pbf.json
├── coropletico-cadunico.json
├── circulos.json                 ← Bolhas (point+sizeBy)
├── pontos.json                   ← Pontos (categórico)
├── assentamentos.json
├── cafs.json
├── cafs-hexbin.json
└── manifest.json                 ← Provenance
```

### Manifest (Exemplo Real)

```json
{
  "generatedAt": "2026-09-20T16:48:10.909Z",
  "generator": "geovis-spec-instructions-optimizer/scripts/dump_golden_specs.mjs",
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

**Significado:**
- `gitSha`: commit que gerou isto — se mudou, specs envelheceram
- `dataRowsElided: false`: dados brutos **não foram** removidos (passou `--full`)
- `datasets`: quantidades de linhas reais de cada dataset
- `modes`: lista de MapModes testados (23 total, 14 únicos)

### Estrutura de Um Golden Spec

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

## Passo 2: Extrair Delta (Estrutura Comparável)

Script identifica o que varia entre specs de produção — isto é, **o que é responsabilidade do agente**.

```bash
node scripts/project_spec.mjs extract-delta \
  src/app/\(features\)/mapas/specs/full-evalued/coropletico-cafs-percentual.json
```

**Output (exemplo):**

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

**Chave: este é o delta — a coisa que o agente precisa produzir corretamente.**

---

## Passo 3: Desenhar Eval Cases e Evals.json

Cria um prompt **a partir do delta**, nunca do arquivo JSON:

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

**Arquivo:** `runs/2026-09-18T14-03-11Z--poda-legend/evals/evals.json`

---

## Passo 4: Capturar Runtime-Captured Specs

### Setup Pré-Eval

```bash
# 1. Provisionar agente de teste (uma vez)
~/.claude/skills/geovis-spec-instructions-optimizer/scripts/provision_test_agent.sh create

# Resultado: variants/test-agent.json com agentId

# 2. Suba dev server com agente de teste
ANTHROPIC_AGENT_ID=$(jq -r '.agentId' variants/test-agent.json) pnpm dev

# 3. Crie versioning snapshot
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

### Rodar Um Caso

```bash
scripts/run_eval_case.sh \
  "mapa coroplético do percentual de estabelecimentos com CAF por município" \
  "runs/2026-09-18T14-03-11Z--poda-legend/evals/cafs-percentual/output.json"
```

**Output (runtime-captured gerado):**

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

**Nota:** `data` é placeholder — route handler injeta dados reais server-side. O que importa é a **estrutura de binding**.

### Rodar Todos os Casos

```bash
for CASE in $(jq -r '.cases[].name' evals/evals.json); do
  PROMPT=$(jq -r ".cases[] | select(.name == \"$CASE\") | .prompt" evals/evals.json)
  scripts/run_eval_case.sh "$PROMPT" "evals/$CASE/output.json"
  sleep 1  # Evita rate limiting
done
```

**Resultado:** `evals/cafs-percentual/output.json`, `evals/idhm-educacao/output.json`, etc. — tudo runtime-captured.

---

## Passo 5: Comparar Full-Evalued ↔ Runtime-Captured

### Comparação Estrutural

```bash
# Para o caso "cafs-percentual":
node scripts/project_spec.mjs compare \
  <(node scripts/project_spec.mjs extract-delta \
    src/app/\(features\)/mapas/specs/full-evalued/coropletico-cafs-percentual.json) \
  runs/2026-09-18T14-03-11Z--poda-legend/evals/cafs-percentual/output.json
```

**Output (scores por eixo):**

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

### Gate de Cobertura

Para cada caso de coverage (`coverageRuleId`):

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

Se qualquer caso com `coverageRuleId` retorna `pass: false`, variante é descartada.

---

## Passo 6: Consolidar Resultados

```bash
node ../../skill-creator/scripts/aggregate_benchmark.py \
  runs/2026-09-18T14-03-11Z--poda-legend/evals/*/output.json \
  > runs/2026-09-18T14-03-11Z--poda-legend/benchmark.json
```

**Exemplo (benchmark.json):**

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

## Estrutura Final

```
runs/2026-09-18T14-03-11Z--poda-legend/
├── versions.json                     ← Manifesto (versions.ts, skill, schema)
├── evals/
│   ├── evals.json                    ← Definição de casos
│   ├── cafs-percentual/
│   │   └── output.json               ← runtime-captured (agente gerou)
│   ├── idhm-educacao/
│   │   └── output.json               ← runtime-captured
│   └── ... (mais 13 casos)
├── benchmark.json                    ← Agregado de pontuação
├── benchmark.md                      ← Human-readable
├── coverage-gate.json                ← Por R-*, passou/falhou
├── proposed-patch-generic-agent.md   ← Diff pro agente (se aprovado)
└── proposed-patch-instructions.diff  ← Diff pro INSTRUCTIONS (se aprovado)
```

---

## Decisão: Aceitar ou Rejeitar

**Critério de Aceitação:**

1. ✅ Gate de cobertura: 100% de casos R-* passam
2. ✅ Fidelidade: 90%+ de casos golden com geometry/form/legendScale = 1.0
3. ✅ Eficiência: tokens de input reduzidos sem regressão
4. ✅ Review: aprovação do usuário após explicação

**Se rejeitar:** Volta pra drawing board, tenta outra variante.

**Se aceitar:** Aplica patch via `geovis-spec-agent-creator` (agente genérico) ou merge PR (INSTRUCTIONS).

---

## Checklist Completo

- [ ] `node dump_golden_specs.mjs` rodou com sucesso
- [ ] `manifest.json` contém git SHA esperado
- [ ] `evals.json` preenchido (casos golden + coverage)
- [ ] Agente de teste provisionado (`variants/test-agent.json`)
- [ ] `pnpm dev` rodando com `ANTHROPIC_AGENT_ID=<test-agent-id>`
- [ ] Todos os casos de eval capturados (`output.json`)
- [ ] Gate de cobertura: 100% de R-* passam
- [ ] Todos os scores consolidados (`benchmark.json`)
- [ ] Recomendação documentada em `runs/<runId>/`
- [ ] Pronto pra entrega (ou rejeição com justificativa)
