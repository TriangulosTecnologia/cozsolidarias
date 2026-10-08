---
name: geovis-spec-instructions-optimizer
version: 2.0.0
description: |
  Consolida e mede as duas fontes de instrução do gerador de spec do cozsolidarias — as
  `instructions` do agente Naturali `geovis-spec-generator-loop` (formation local
  `agents/geovis-spec-generator/formation.json`) e a const `INSTRUCTIONS` inline em
  `src/app/api/ai/spec/route.ts` — ao essencial robusto, e mede quão perto cada variação da rota
  `/mapas` fica da spec mínima que renderiza igual (mesma UI, mesmas legendas), rodando eval real
  contra `POST /api/ai/spec`. Use quando o usuário pedir para podar/otimizar/consolidar essas
  instruções, reduzir tokens sem perder robustez, medir se uma regra do prompt é redundante com a
  malha determinística (`candidateValidation.ts`/`specValidation.ts`), ou medir a distância das
  specs geradas até a spec mínima de cada modo do `/mapas`.
---

# Otimizador de instruções do geovis-spec-generator

Consolida duas fontes de prompt que nunca foram medidas juntas, e usa eval real (não simulação)
pra decidir o que podar. Produz propostas de diff — nunca edita `route.ts` ou o agente de produção
sozinha.

Toda rodada é versionada e imutável — ver **Regra permanente** antes de rodar qualquer eval.

Referências: `references/sources.md` (onde vivem as fontes, CLI `naturali`),
`references/determinism-map.md` (regra-do-prompt → validador que a cobre),
`references/golden-specs.md` (avaliação contra os mapas de produção).

## Objetivo (issue #72 / PR #73)

Executada contra as variações da rota `/mapas`, a skill deve provar que o agente devolve, por
variação, a spec **filtrada aos campos que aquela variação usa**, que renderiza a **mesma UI com
as mesmas legendas** do `/mapas`. "Mínima" e "renderiza igual" são medidos por código (Passo 4,
eixo e), nunca afirmados por leitura.

## Entradas esperadas

Além das instruções do agente e da `INSTRUCTIONS` da aplicação, toda rodada consome e registra
(hash em `versions.json`):

| Entrada | Onde | Papel |
|---|---|---|
| Catálogo projetado | `buildCatalogueContext()` (`mapDataCatalogue.ts`) sobre `gateway.getCatalogue()` | Dado enviado por request, não instrução podável |
| Catálogo completo | `public/dataset_catalogue.json` (`collections[].description`, `datasets[].description`, `collection_id`) | Contexto de escolha de dataset (Passo 3, instruções de variação) |
| Datasets renderáveis | `RENDERABLE_DATASET_IDS` / `RENDERABLE_DATASET_FETCHERS` (`mapDataCatalogue.ts`) | Define quais modos são alcançáveis |
| Sources servidas | `KNOWN_SOURCE_URLS` / `SOURCE_METADATA` / `buildSourcesTable()` (`specValidation.ts`) | Única lista de URLs válidas |
| Variações do `/mapas` | `MapMode` (`geovisMapMode.ts`, 23 modos) + `buildSpec` (`geovisSpec.ts`) | Corpus golden (spec mínima esperada) |
| Contrato de saída | `output_schema` da formation (`status` ok/error, `spec`, `error.code`) | Forma da resposta do agente |

Esta skill nunca aplica uma poda no agente de produção: entrega a
proposta e, se aprovada, a aplicação segue o fluxo de provisionamento (backup → validate →
formation). Overlap zero.

## As duas fontes — nunca fundir

1. **`instructions` do agente Naturali** — declaradas em
   `agents/geovis-spec-generator/formation.json` (sem CI/review), referenciadas só
   por `NATURALI_AGENT_ID`. Deveriam ser genéricas ao schema `@ttoss/geovis`.
2. **`INSTRUCTIONS`** Contém a descrição da aplicação, o catálogo e documentação da API dos dados`.

Fundir as duas acopla deploy de regra de negócio (`route.ts`, sob CI) a reprovisionamento de
agente (fora de banda).

## Regra permanente — versionar formation.json, resultados, skill e schema

Restrição inegociável: **nada é sobrescrito, tudo carrega versão**.

Cada campanha grava em `runs/<YYYY-MM-DD>T<HH-mm-ss>Z--<slug-da-variante>/` (diretório novo por
execução, nunca reutilizado, nunca editado depois). Na raiz, `versions.json` obrigatório, escrito
**antes** do primeiro POST de eval:

```json
{
  "runId": "2026-09-28T14-03-11Z--poda-duplicata",
  "skillVersion": "2.0.0",
  "sources": {
    "agentInstructions": { "formationFile": "agents/geovis-spec-generator/formation.json", "sha256": "…" },
    "instructions": { "path": "src/app/api/ai/spec/route.ts", "gitSha": "…", "sha256": "…" },
    "catalogue": { "path": "public/dataset_catalogue.json", "sha256": "…" }
  },
  "spec": { "schemaVersion": 2, "libSchemaVersion": 1, "geovisPackageVersion": "…" },
  "testAgent": {
    "formationId": "form_…",
    "agentId": "agent_…",
    "agentVersion": 1,
    "naturaliCliVersion": "0.136.0"
  },
  "golden": { "manifestSha256": "…", "gitSha": "…" },
  "results": { "resultsVersion": 2, "datasetVersion": "…" }
}
```

Regras de preenchimento:

- **`skillVersion`** — o `version` do frontmatter. Semver: patch = texto, minor = novo gate/eixo,
  major = formato de `runs/`/`versions.json` ou transporte do agente muda. Rodadas com
  `skillVersion` major diferente (ex.: 1.x Managed Agents × 2.x Naturali) nunca são comparadas.
- **`spec.schemaVersion`** — hoje **2**. Registre `geovisPackageVersion` do `package.json` e o
  `SPEC_SCHEMA_VERSION` de `@ttoss/geovis` em `libSchemaVersion`. Se `libSchemaVersion` passar de
  `2`, **pare e reporte**: exige ressincronizar o agente via `geovis-spec-agent-creator`.
- **`sources`** — sha256 do texto exato enviado nessa rodada + git SHA do repo.
- **`testAgent.agentVersion`** — `version` devolvido por `naturali get-agent` depois do último
  `update-formation`; é o que liga um resultado à config exata (`get-agent-version`).
- **`results.resultsVersion`** — formato de `output.json`/`benchmark.json`/`coverage-gate.json`/
  `minimality.json`. Bump quando o formato muda.

`runs/latest` é só symlink de conveniência. Comparação A/B sempre cita os dois `runId`.
Rodadas `runs/2026-09-18*` são do transporte Anthropic (skill 1.x) — histórico, não baseline.

## Passo 1 — Mapear redundância com a malha determinística

Depois da resposta do agente, a rota valida em três camadas. Meça isso antes de concluir que uma
poda "não regrediu":

1. **Dentro do loop do agente** — o tool cliente `validate_spec` roda `validateCandidate`
   (`candidateValidation.ts`): `validateSpec` do `@ttoss/geovis` com reparos locais
   (`applyLocalRepairs` sobre as `RepairOption` das issues) + `collectStructuralIssues`. No máximo
   `MAX_VALIDATION_ATTEMPTS = 5` chamadas; para em `no-shrinkage` ou no deadline de 55s
   (`naturaliSession.ts`), e a rota responde 422 `stopped` com o último candidato.
2. **Estrutural pós-resposta** — `hoistLayerLegends` + `collectStructuralIssues`, que agrega
   `findInvalidGeojsonSource`, `findInvalidBasemapStyleUrl`, `findGeometryInMapData`,
   `findMissingLegend`, `findChoroplethOnAbsoluteTotal` e `unsupported-dataset`
   (`isRenderableDatasetId`) — todos em `specValidation.ts`/`candidateValidation.ts`.
3. **Normalização server-side** — `isCozinhasChoroplethRequest` → `buildCozinhasChoroplethSpec`
   (`canonicalChoropleth.ts`) substitui a spec inteira pelo `buildSpec` do `/mapas`; senão
   `appendRealMapData` + `appendRealSourceData`; por fim `validateWithLocalRepairs`.

Regras que a camada 3 reescreve nunca são atribuídas ao modelo. `canonicalScales.ts` e os módulos
`.sources/.layers/.legends` **não existem nesta branch** — qualquer `R-*` do `determinism-map.md`
que cite um `findX` ausente fica marcado `validador-ausente` e volta a ser **essencial** até existir
validador.

Liste cada regra das duas fontes como item atômico em `references/determinism-map.md`:

- Regra 100% coberta por validador existente → **poda candidata** (decisão medida no Passo 4).
- Regra sem validador (escolha semântica de `mapDataId`/variável, grain, cobertura/tempo, rótulo
  pt-BR, escolha de source/layer por variação) → **essencial, não podável**.

**Texto → validação.** Toda regra essencial cuja verificação é descrita em texto e é decidível
por código ganha um checker em `scripts/score_case.mjs` (ou em `scripts/project_spec.mjs` para as
de fidelidade/mínimo), com o mesmo `R-*` id. Checker que reimplementa um `findX` existente é
proibido — importe a função. Checkers genéricos ao schema (não ao cozsolidarias) são listados em
`proposed-geovis-validations.md` (Passo 5) como candidatos a subir pro `@ttoss/geovis`, com
implementação, testes e a instrução correspondente a remover do agente.

Cada regra tem ID estável (`R-legend-required`, `R-mapdataid-real`, …). O gate de cobertura
referencia esses IDs — toda regra atual precisa de ≥ 1 eval case desenhado pra ela.

Produza, por fonte, a versão podada candidata lado a lado com a atual, com justificativa por item.

## Passo 2 — Provisionar o agente de teste dedicado (pede confirmação antes de gastar API real)

Provisionamento é **a partir de arquivo local de formation**, via CLI `naturali` (preferir CLI a
MCP; `naturali <comando> --help`). Env vars já configuradas: `NATURALI_API_KEY`,
`NATURALI_PROJECT_ID`, `NATURALI_AGENT_ID`, `NATURALI_FORMATION_ID` (em `.env`, gitignored).
Passo a passo em `references/sources.md`.

Estado de referência (verificado 2026-09-28, vivo ≡ arquivo local):

| Papel | Formation | Agente | Arquivo local |
|---|---|---|---|
| Produção da branch (loop, `validate_spec`) | `form_u4byEDCIaWR9w132` | `agent_FdJNYpl3XbBgLJfQ` v1 | `agents/geovis-spec-generator/formation.json` |
| Compartilhado antigo (sem tool) — nunca tocar | `form_22U2jykONy2zvOcv` | `agent_aBWkhUlqZObSry0x` v5 | `~/geovis-spec-generator.formation.json` |

Sempre reconfirme com `naturali list-formations`/`get-agent` e compare `instructions` +
`output_schema` vivos com o arquivo local antes de derivar a formation de teste; divergência →
pare e reporte.

Regras inegociáveis:

- **Use sempre a formation existente do loop** (`NATURALI_FORMATION_ID`), a menos que o usuário
  peça uma nova (decisão do usuário, 2026-09-28). A compartilhada antiga continua intocável.
- Fluxo por configuração: backup do vivo (`get-formation`/`get-agent`) em `runs/<runId>/` →
  editar o arquivo local `agents/geovis-spec-generator/formation.json` → copiar para
  `runs/<runId>/formation.<config>.json` → `naturali validate-formation` → `update-formation` →
  registrar `agentVersion` em `versions.json`. Ao fim, restaurar o arquivo local e o vivo à
  variante aprovada (ou ao backup).
- Formation nova (só quando pedida): derivada do arquivo local do loop — mesma `validate_spec`,
  `output_schema`, `max_steps`, `temperature`, provider; muda só `name` e `instructions`.
- `trace_content_mode: "full"` no agente de eval (decisão do usuário, 2026-09-28; o projeto já é
  `full`), para `get-generation-transcript` mostrar as rodadas de `validate_spec`. Com `none` a
  evidência fica só na resposta do endpoint e em `/tmp/cozsolidarias-generations`.
- Eixo (e): `scripts/run_variations.sh <evals.variacoes.json> <out-dir>` roda os casos e pontua
  com `scripts/minimal_spec.mjs` (`derive` = só layers visíveis + o que elas referenciam).
- Variantes do lado `INSTRUCTIONS` não tocam o Naturali: são edição local da const em `route.ts`
  antes de `pnpm dev`.
- Variantes do lado agente **não rodam em paralelo**: `update-formation` → todos os casos → só
  então o próximo update.
- **Pare e peça confirmação explícita antes do primeiro `create-formation`** — custo real.
- Ao fim, pergunte se deleta (`delete-formation`) ou mantém a formation de teste.
- Os evals nativos do Naturali (`create-eval`/`start-eval-run`) não servem o tool cliente
  `validate_spec` — o eval passa sempre pelo endpoint da rota.

## Passo 3 — Montar o dataset de eval

Formato `evals/evals.json` do skill-creator. Seed a partir dos prompts reais de
`tests/unit/tests/aiSpecRoute.test.ts`, mais:

- um caso por `mapType` (choropleth/proportionalCircles/dotDensity);
- dataset fora de `RENDERABLE_DATASET_IDS` → `status: "error"` (`missing_data`), nunca
  `mapDataId` inventado;
- pedido só resolvível em grain de estado → `status: "error"`;
- ambiguidade entre versões temporais (`cozinhas_geolocalizadas` × `_2025`) → `ambiguous_request`;
- pedido sem campo 1:1 no catálogo → não usar proxy sem avisar;
- loop: caso que força ≥ 1 rodada de `validate_spec` e caso que termina em `stopped`;
- **um eval case por `R-*` id** (gate de cobertura, obrigatório);
- **um eval case por variação alcançável do `/mapas`** — regenere o corpus com
  `scripts/dump_golden_specs.mjs` (roda `buildSpec` de verdade; grava
  `src/app/(features)/mapas/specs/full-evalued/` + `manifest.json`, hoje ausente — regenerar é
  pré-requisito) e leia o `README.md` gerado antes de escrever os prompts. Recalcule o conjunto
  alcançável a cada rodada contra `RENDERABLE_DATASET_IDS` e `KNOWN_SOURCE_URLS` atuais — hoje
  incluem `municipios_cadinsan`, `cozinhas_geolocalizadas_2025` e `/geo/assentamentos.json`, o que
  invalida a contagem "5 de 23" antiga. Modo inalcançável vira caso de recusa, nunca golden.

Todo caso de variação carrega `mapMode`, `golden` (arquivo) e `minimalFields` — o conjunto de
caminhos da spec que aquele modo usa, derivado do delta do golden (nunca escrito à mão).

## Passo 4 — Rodar eval contra o endpoint real (sequencial, com gate de cobertura)

Por variante: `update-formation` na formation de teste, `pnpm dev` local com
`NATURALI_AGENT_ID` do agente de teste num `.env.local` temporário (só essa chave; apagar no fim),
`scripts/run_eval_case.sh` (POST real em `http://localhost:3000/api/ai/spec`) por caso, salvando
`output.json` + `duration_ms` + nº de chamadas `validate_spec`. Só depois do dataset inteiro, o
próximo update.

**Gate de cobertura (binário)**: `scripts/score_case.mjs` sobre todo caso marcado com `R-*`. A
variante só segue se 100% continuarem passando.

Passado o gate, eixos reportados separados, nunca somados:

- **(a) Pass/fail programático** — `score_case.mjs`, importando as funções de
  `candidateValidation.ts`/`specValidation.ts`. Nunca reimplemente.
- **(b) Rubrica qualitativa** — `agents/grader.md` do skill-creator: variável certa, label pt-BR,
  cobertura/tempo, `status: "error"` com `code` correto.
- **(c) Fidelidade aos mapas de produção** — `project_spec.mjs compare <golden> <candidato>`:
  `geometry`/`form`/`legendScale` por código, `dataset` pro grader. Sempre contra o delta.
- **(d) Eficiência** — tokens de `messages[0].content` (catálogo + `INSTRUCTIONS` + prompt) +
  tokens das `instructions` do agente + `duration_ms` + chamadas `validate_spec`.
  `agents/comparator.md` pra A/B cego contra o controle `atual-sem-poda`.
- **(e) Mínimo e equivalência de render** (por caso de variação) — `minimality.json`:
  `extraFields` (caminhos presentes fora de `minimalFields`), `missingFields`, e equivalência de
  render: mesmo conjunto de layers visíveis (geometria × source × forma), mesmas legends
  (`id`, tipo de `colorBy`, `property`, aridade de `thresholds`/`colors`) que o golden. Screenshot
  via `pr-playwright-verify` só quando os campos batem e o usuário pedir confirmação visual.

`aggregate_benchmark.py` do skill-creator consolida `benchmark.json`/`.md`, uma configuração por
variante, controle sempre incluso, execução sequencial.

## Passo 5 — Entregar propostas, nunca aplicar sozinha

Em `runs/<runId>/` (nunca commitado automaticamente, nunca sobrescrevendo rodada anterior):

- `versions.json` — manifesto, escrito antes dos evals.
- `formation.test.json` — formation exata do agente de teste na variante final.
- `proposed-patch-agent-instructions.md` — diff das `instructions` do agente loop; aplicação
  segue o fluxo de provisionamento (backup do vivo → `validate-formation` → formation), nunca
  direto pela skill.
- `proposed-patch-instructions.diff` — diff literal da const `INSTRUCTIONS` em `route.ts`.
- `proposed-geovis-validations.md` — checkers genéricos candidatos ao `@ttoss/geovis`: regra,
  implementação proposta, testes, instrução que sai do agente.
- `coverage-gate.json`, `minimality.json`, `benchmark.md`/`benchmark.json`.
- Resumo recomendando aceitar/rejeitar cada mudança, citando o validador que cobre a regra podada,
  sempre com `runId`, `skillVersion`, `spec.schemaVersion`, `testAgent.agentVersion`.

Nunca edite `route.ts` sozinha — é código de produção sob os quality gates do `CLAUDE.md`
(`pnpm typecheck && pnpm eslint --fix && pnpm test`). Entregue o diff, peça revisão humana.

Parada: usuário aprova, rodada de revisão sem feedback, ou sem progresso mensurável nos eixos.

## Fora de escopo

- Não modifique `candidateValidation.ts`/`specValidation.ts`/`canonicalChoropleth.ts` além de
  importar suas funções exportadas.
- Não altere env da Vercel — ação do usuário.
- Credenciais: nunca gravar `NATURALI_API_KEY` em arquivo versionado (inclui
  `.claude/settings.json`); só `.env`.

## Quando não usar

- Gerar um spec pontual: invoque `geovis-spec-generator` diretamente.
- Ressincronizar o agente com um novo `schema.json`: use `geovis-spec-agent-creator`.
