# Quick Reference: Full-Evalued vs Runtime-Captured

Referência rápida — não substitui `spec-generation-pipeline.md`, mas resume os pontos essenciais.

---

## Geração de Full-Evalued Specs

**O quê:** Golden corpus (23 arquivos) do que o app realmente publica.  
**Quando:** No início de cada campanha de otimização.  
**Quem:** Script `dump_golden_specs.mjs`.

```bash
# Do repo root:
node --experimental-strip-types \
  ~/.claude/skills/geovis-spec-instructions-optimizer/scripts/dump_golden_specs.mjs

# Opcional: keep dados brutos (14MB+):
# ... --full
```

**Saída:** `src/app/(features)/mapas/specs/full-evalued/`
- `<mode>.json` — um por MapMode (coropletico, pontos, etc.)
- `manifest.json` — git SHA, geovis version, provenance

**Características:**
- Determinístico (sempre o mesmo output para um git SHA)
- Nunca editado à mão
- Dados brutos elididos por defaul
- Apenas 14 semanticamente distintos dos 23 arquivos
- Apenas 5 alcançáveis pelo agente

**Quando atualizar:** Toda campanha (antes de rodar eval de variantes).

---

## Captura de Runtime-Captured Specs

**O quê:** Specs gerados pelo agente em resposta a prompts durante eval.  
**Quando:** Durante avaliação de variantes.  
**Quem:** Script `run_eval_case.sh`.

```bash
# Pré-requisito: pnpm dev rodando em http://localhost:3000
# Com env var: ANTHROPIC_AGENT_ID=<test-agent-id>

# Rodar um caso:
scripts/run_eval_case.sh \
  "mapa coroplético do IDHM por município" \
  "runs/2026-09-18T14-03-11Z--poda-legend/evals/idhm/output.json"

# Output:
# {
#   "prompt": "...",
#   "httpStatus": 200,
#   "durationMs": 2847,
#   "response": { ... spec ou error ... }
# }
```

**Saída:** `runs/<YYYY-MM-DD>T<HH-mm-ss>Z--<slug>>/evals/<case>/output.json`

**Características:**
- Imutável uma vez gravado
- Efêmero (parte de uma rodada específica)
- Nunca contém dados brutos (agent nunca emite)
- Carrega status HTTP, timing, prompt, e resposta

**Quando executar:** Para cada caso em `evals/evals.json`, depois de provisionar agente de teste.

---

## Comparação: Full-Evalued ↔ Runtime-Captured

**Quando:** Depois de capturar runtime-captured de todos os casos.

```bash
# Extrair delta (estrutura comparável) do golden:
node scripts/project_spec.mjs extract-delta \
  src/app/\(features\)/mapas/specs/full-evalued/coropletico-cafs-percentual.json

# Comparar candidato contra delta:
node scripts/project_spec.mjs compare \
  <delta-golden> \
  runs/2026-09-18T14-03-11Z--poda-legend/evals/cafs-percentual/output.json

# Output:
# {
#   "geometry": 1.0,
#   "form": 0.8,
#   "legendScale": 1.0,
#   "dataset": "to-grader"
# }
```

**Eixos pontuados:**
| Eixo | Computável? | O que mede |
|------|-------------|-----------|
| geometry | Sim (código) | Geometria certa (`/geo/...` vs `/api/...`) |
| form | Sim (código) | Forma cartográfica (polygon, point+sizeBy, etc.) |
| legendScale | Sim (código) | Escala (quantitative vs categorical) |
| dataset | Não | Semântica (delegado ao `agents/grader.md`) |

---

## Gate de Cobertura

**Binário:** Passa ou descarta variante.

```bash
# Verificar se todos os casos R-* passam:
for CASE in evals/R-*/output.json; do
  node scripts/score_case.mjs "$CASE"
done
```

**Regra:** Se **qualquer** caso de coverage (`coverageRuleId: "R-*"`) falha:
- Variante é descartada **antes** de pontuação
- Regressão de robustez = inaceitável

---

## Estrutura de Diretório

```
src/app/(features)/mapas/specs/
├── README.md                            (entry point)
├── full-evalued/                        (produção)
│   ├── coropletico.json                 ← 23 arquivos golden
│   └── manifest.json
├── runtime-captured/                    (deprecated — ver runs/)
└── runs/
    ├── 2026-09-18T14-03-11Z--poda-legend/
    │   ├── versions.json                (manifesto)
    │   ├── evals/
    │   │   ├── evals.json               (definição de casos)
    │   │   ├── caso-1/
    │   │   │   └── output.json          ← runtime-captured
    │   │   └── ...
    │   ├── coverage-gate.json
    │   ├── benchmark.json
    │   └── proposed-patch-*.diff
    └── latest → 2026-09-18T14-03-11Z--poda-legend/

~/.claude/skills/geovis-spec-instructions-optimizer/
├── SKILL.md                             (workflow completo)
├── references/
│   ├── spec-generation-pipeline.md      ← MAPA CENTRAL
│   ├── pipeline-diagram.md              (visual)
│   ├── sources.md                       (CLI ant, env vars)
│   ├── determinism-map.md               (cobertura)
│   ├── golden-specs.md                  (comparação)
│   └── quick-reference.md               (este arquivo)
├── scripts/
│   ├── dump_golden_specs.mjs
│   ├── run_eval_case.sh
│   ├── project_spec.mjs
│   ├── score_case.mjs
│   └── provision_test_agent.sh
└── runs/
    ├── 2026-09-18T14-03-11Z--*/
    └── latest/
```

---

## Checklist: Regeneração e Validação

**Antes de iniciar eval:**
- [ ] Git status limpo ou committado
- [ ] `node scripts/dump_golden_specs.mjs`
- [ ] `manifest.json` contém git SHA esperado
- [ ] Verificar `libSchemaVersion` em manifest — se > 2, **pare** e ressincronizar agente

**Antes de rodar `run_eval_case.sh`:**
- [ ] `pnpm dev` rodando com `ANTHROPIC_AGENT_ID=<test-agent-id>`
- [ ] `evals/evals.json` preenchido com prompts
- [ ] Cada caso marcado com `coverageRuleId` ou `golden`

**Depois de capturar todos os `output.json`:**
- [ ] Rodar `score_case.mjs` em todos os `evals/R-*/output.json`
- [ ] Verificar gate de cobertura (100% de R-* devem passar)
- [ ] Rodar `project_spec.mjs compare` em casos golden

**Antes de aprovar mudança:**
- [ ] coverage-gate.json mostra 100% de passes
- [ ] benchmark.json/md consolidado
- [ ] Recomendação documentada

---

## Quando Não Usar Esta Skill

- **Gerar um spec pontual:** Use `geovis-spec-generator` (o agente direto)
- **Ressincronizar agente com novo schema:** Use `geovis-spec-agent-creator`
- **Editar specs à mão:** Nunca — sempre por regeneração determinística

---

## Links Rápidos

| Preciso de | Link |
|------------|------|
| Workflow completo | `SKILL.md` |
| Arquitetura detalhada | `references/spec-generation-pipeline.md` |
| Diagrama visual | `references/pipeline-diagram.md` |
| CLI `ant` (agente) | `references/sources.md` |
| Cobertura (gate) | `references/determinism-map.md` |
| Comparação vs golden | `references/golden-specs.md` |
| Exemplos de runs | `runs/<YYYY-MM-DD>T*--*/` |
