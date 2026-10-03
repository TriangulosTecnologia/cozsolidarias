# Pipeline de geração de specs: full-evalued vs runtime-captured

Existem duas fontes ortogonais de VisualizationSpec neste repositório — **golden specs** gerados da produção (full-evalued) e **specs de teste** capturados em runtime durante avaliação (runtime-captured). Cada um serve a um propósito e segue um fluxo distinto de geração e validação.

---

## 1. Full-Evalued Specs (Golden Corpus)

**Propósito:** Corpus de referência do que o app realmente publica. Base de verdade para avaliação.

**Localização:** `src/app/(features)/mapas/specs/full-evalued/`

**Conteúdo:** 23 arquivos JSON — um por `MapMode` (coropletico, pontos, círculos, assentamentos, etc.) — mais `manifest.json`.

### 1.1 Geração

#### Comando:
```bash
node --experimental-strip-types \
  ~/.claude/skills/geovis-spec-instructions-optimizer/scripts/dump_golden_specs.mjs [--full]
```

#### Executado a partir de:
- Raiz do repo cozsolidarias (`cwd` importa — gateway resolve data files relativamente)

#### Produzido por:
- Script: `dump_golden_specs.mjs`
- Função: `buildSpec()` em `src/app/(features)/mapas/geovisSpec.ts`
- Fonte de dados: Live data gateway — dados reais de todos os datasets

#### Artefatos gerados:

| Arquivo | Conteúdo |
|---------|----------|
| `<mode>.json` | Um spec completo por MapMode. Schema 2.0, estrutura idêntica ao que o app renderiza. |
| `manifest.json` | Metadados de provenance (git SHA, geovis version, row counts, timestamp, modes testados). |

### 1.2 Características estruturais

**O que é elided (removido para economizar tamanho):**
- Dados brutos em `mapData[].data[]` (14MB+ de valores de linha) — nunca são emitidos pelo agente de qualquer forma
- O agent volta `data: { __placeholder__ }` e `appendRealMapData` injeta valores reais server-side

**O que é mantido (e será pontuado em eval):**
- Estrutura de binding: `sources`, `layers`, `joins`, `legends`
- Escala de legenda (`quantitative` vs `categorical`)
- Amostra de 3 linhas de dados (o suficiente para verificação de escala)
- Contagem de linhas (validação de `legendScale` depende disso)

### 1.3 Por que não pode ser comparado diretamente com agent output

Ver `golden-specs.md` § "Por que um diff de JSON cru não funciona" (4 divergências estruturais):
1. Specs de produção nunca usam `mapType` — expandem `layers`/`legends` explicitamente
2. `mapDataId` em produção é genérico (`"cozinhas-por-municipio"`); agent emite ids reais do catálogo
3. Invariante de template presente em todos os 23 (camadas base não solicitadas)
4. Só 14 dos 23 são semanticamente distintos (os demais são clones com payload diferente)

**Comparação sempre contra o delta, nunca contra a spec inteira.**

### 1.4 Atualização e versionamento

- **Regerado a cada rodada de eval** — não é um dump histórico, é sempre o ideal *atual*
- **`manifest.json` diz qual código o gerou** — a provenance imutável. Se git SHA difere, specs estão desatualizadas
- **Nunca editado à mão** — é a resposta de uma função determinística

---

## 2. Runtime-Captured Specs

**Propósito:** Specs gerados pelo agente em resposta a prompts durante avaliação. Base de teste para validação de robustez de instrução.

**Localização:** `<runs>/<YYYY-MM-DD>T<HH-mm-ss>Z--<slug-variante>/<eval-case-name>/output.json`

**Conteúdo:** Um spec JSON por caso de eval, com metadados de HTTP status, duração, e prompt.

### 2.1 Geração

#### Comando:
```bash
scripts/run_eval_case.sh "<prompt>" "<output-file>" [base-url]
```

#### Executado a partir de:
- Qualquer diretório (usa URLs absolutas via `curl`)
- Pré-requisito: `pnpm dev` rodando localmente em `http://localhost:3000` (ou URL customizada)

#### Produzido por:
- Script: `run_eval_case.sh` (wrapper que orquestra POST + timing)
- Consumidor: Agente Managed Agents (`ANTHROPIC_AGENT_ID` do `.env.local`)
- Endpoint: `POST /api/ai/spec` (route handler em `src/app/api/ai/spec/route.ts`)

#### Fluxo interno de uma chamada:

1. **Script cria body JSON** com `{ prompt }`
2. **POST** → agente processa (agent system prompt + `INSTRUCTIONS` dinâmica + prompt do usuário)
3. **Route handler** valida JSON, resolve `mapDataId` real, normaliza escalas via `applyCanonicalScales`
4. **Response** volta ao script como `{ httpStatus, durationMs, response }`
5. **Script grava** tudo em `<output-file>` e exibe status no stderr

#### Artefatos gerados por caso:

```json
{
  "prompt": "mapa coroplético do IDHM por município",
  "httpStatus": 200,
  "durationMs": 2847,
  "response": {
    "schemaVersion": 2,
    "mapData": [...],
    "layers": [...],
    "legends": [...],
    ...
  }
}
```

Quando há erro de validação:
```json
{
  "httpStatus": 422,
  "response": {
    "error": "findMapTypeWithoutMapData: mapType sem mapData"
  }
}
```

### 2.2 Estrutura de organização por variante

Cada rodada de eval é versionada em `runs/<runId>/`:

```
runs/2026-09-18T14-03-11Z--poda-legend/
├── versions.json               # manifesto obrigatório (schema, fontes, hashes)
├── evals/
│   ├── evals.json             # definição de casos (prompt, golden se aplicável, etc.)
│   ├── caso-1/
│   │   └── output.json        # runtime-captured spec
│   ├── caso-2/
│   │   └── output.json
│   └── ...
├── proposed-patch-generic-agent.md
├── proposed-patch-instructions.diff
├── coverage-gate.json
├── benchmark.md
└── benchmark.json
```

### 2.3 Fluxo de captura (passo a passo)

**Passo 1 — Provisionar agente de teste (uma vez por campanha)**
```bash
scripts/provision_test_agent.sh create
# Resultado: variants/test-agent.json com agentId, version=1
```

**Passo 2 — Montar dataset de eval cases**
- Arquivo: `evals/evals.json` (formato skill-creator)
- Casos: real prompts (pessoal + produção) + casos por R-* rule + golden specs alcançáveis
- Marcação: qual caso cobre qual regra (`coverageRuleId`), qual é golden (`golden: "coropletico-idhm.json"`)

**Passo 3 — Por variante testada**
1. Atualizar system prompt do agente único:
   ```bash
   scripts/provision_test_agent.sh update <slug> <prompt-file> variants/test-agent.json
   ```
2. Rodar `pnpm dev` com env var temporária:
   ```bash
   ANTHROPIC_AGENT_ID=<test-agent-id> pnpm dev
   ```
3. Por cada caso em `evals/evals.json`:
   ```bash
   scripts/run_eval_case.sh "$PROMPT" "runs/$RUNID/evals/$CASE_NAME/output.json"
   ```
4. Aguardar todos os casos da variante antes de `update` seguinte (serial, não paralelo)

**Passo 4 — Pontuação e gate de cobertura**
```bash
node scripts/score_case.mjs <output.json> <golden.json>  # comparação código
node scripts/project_spec.mjs compare <golden-delta> <candidato> # eixos estruturais
```

---

## 3. Ciclo de Validação: Como os Dois se Relacionam

### 3.1 Fase 0 — Setup imutável
```bash
node scripts/dump_golden_specs.mjs
# Gera full-evalued/manifest.json
# → versioning snapshots
```

### 3.2 Fase 1 — Mapeamento de redundância
- Lê `full-evalued/` (specs de produção)
- Lê `src/app/api/ai/spec/instructions.ts` + `~/geovis-spec-generator.md`
- Produz `references/determinism-map.md` (tabela regra → validador)
- Identifica regras podáveis vs essenciais

### 3.3 Fase 2 — Desenho de eval
- Lê `golden-specs.md` para aprender os deltas (estrutura comparável)
- Escreve prompts **a partir do delta**, não do arquivo JSON
- Exemplo delta → prompt:
  ```
  delta: cozinhas-por-municipio @ /geo/geojs-100-mun.json [polygon] quantitative n=5524
  prompt: "mapa coroplético do percentual de estabelecimentos com CAF por município"
  ```
- Registra em `evals/evals.json` com `golden: "coropletico-cafs-percentual.json"` (aponta a full-evalued)

### 3.4 Fase 3 — Captura de runtime
- Para cada prompt em `evals/evals.json`, executa `run_eval_case.sh`
- Armazena response em `runs/<runId>/evals/<case>/output.json` (runtime-captured)

### 3.5 Fase 4 — Comparação
Para casos com `golden` apontado:
```bash
node scripts/project_spec.mjs compare \
  src/app/\(features\)/mapas/specs/full-evalued/coropletico-cafs-percentual.json \
  runs/2026-09-18T14-03-11Z--poda-legend/evals/cafs-percentual/output.json
```

Produz:
- `geometry`: 1.0 (geometria correta)
- `form`: 0.8 (forma cartográfica próxima)
- `legendScale`: 1.0 (escala quantitativa correta)
- `dataset`: `{"verdict": "grader.md"}` (delegado ao agente semântico)

---

## 4. Estrutura de Arquivos na Skill

```
.claude/skills/geovis-spec-instructions-optimizer/
├── SKILL.md                      # Instruções executáveis completas
│
├── references/
│   ├── sources.md               # Onde cada fonte vive (INSTRUCTIONS, agente, etc.)
│   ├── determinism-map.md       # Tabela regra → validador (gate de cobertura)
│   ├── golden-specs.md          # Como comparar specs de produção
│   └── spec-generation-pipeline.md  # ← ESTE DOCUMENTO
│
├── scripts/
│   ├── dump_golden_specs.mjs    # → full-evalued/ (geração da produção)
│   ├── run_eval_case.sh         # → runtime-captured (captura de teste)
│   ├── project_spec.mjs         # Comparação entre os dois (score, project)
│   ├── score_case.mjs           # Pontuação programática
│   ├── provision_test_agent.sh  # Provisionamento do agente de teste
│   ├── build_agent_variant.mjs  # (helper)
│   └── probe_validate_spec.mjs  # (helper)
│
├── variants/
│   ├── README.md                # Documentação de variantes testadas
│   ├── justificativa.md         # Por que cada variante foi testada
│   ├── agente-tier1.md          # Proposta de poda (agente)
│   └── agente-tier12.md         # Proposta de poda (agente)
│
└── runs/
    ├── 2026-09-18T14-03-11Z--poda-legend/
    │   ├── versions.json        # Manifesto (schema, fontes, hashes)
    │   ├── evals/
    │   │   ├── evals.json       # Dataset de casos
    │   │   ├── caso-1/
    │   │   │   └── output.json  # ← runtime-captured
    │   │   └── ...
    │   ├── coverage-gate.json   # Evidência: qual R-* passou
    │   ├── benchmark.json
    │   ├── benchmark.md
    │   ├── proposed-patch-generic-agent.md
    │   └── proposed-patch-instructions.diff
    │
    └── latest → 2026-09-18T14-03-11Z--poda-legend/ (symlink)
```

---

## 5. Fluxo de Decisão: Quando Usar Cada Um

| Pergunta | Fonte | Por quê |
|----------|-------|--------|
| "Qual spec o app de fato publica em produção?" | full-evalued | é a resposta de `buildSpec()` da produção, nunca envelhece (regenerado cada campanha) |
| "A instrução nova ainda consegue produzir os mapas que importam?" | runtime-captured + comparação vs full-evalued | mede robustez real, não teórica |
| "A instrução nova cobre todas as regras que ela promete?" | runtime-captured scores | gate de cobertura: se 1 caso R-* falha, variante é descartada |
| "Uma regra do prompt é redundante com a validação?" | determinism-map.md | lista qual validador já a cobre (0 custo de tokens pra remover) |
| "Quantos casos de eval de verdade existem?" | full-evalued (14 deltas distintos) vs evals.json | 23 arquivos, 14 casos únicos, só 5 alcançáveis pelo agente |

---

## 6. Checklist para Regeneração

Se forem necessárias mudanças estruturais (novo MapMode, novo dataset, mudança de schema):

- [ ] Editar `geovisMapMode.ts` se novo modo
- [ ] Editar `buildSpec()` se nova lógica
- [ ] Rodar `dump_golden_specs.mjs` **antes** de iniciar eval
- [ ] Verificar `manifest.json` — git SHA deve apontar ao commit correto
- [ ] Se `libSchemaVersion` em manifest > 2: **pare** e ressincronizar agente via `geovis-spec-agent-creator`
- [ ] Atualizar `references/determinism-map.md` se novos validadores foram adicionados
- [ ] Atualizar `references/golden-specs.md` se a interpretação de delta mudou
- [ ] Recriar `evals/evals.json` com casos dos novos mapas (se aplicável)
