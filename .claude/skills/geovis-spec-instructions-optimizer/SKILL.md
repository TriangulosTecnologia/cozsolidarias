---
name: geovis-spec-instructions-optimizer
version: 1.4.0
description: |
  Consolida e mede as duas fontes de instrução do gerador de spec do cozsolidarias — o system
  prompt do agente Managed Agents `geovis-spec-generator` (`~/geovis-spec-generator.md`) e a
  const `INSTRUCTIONS` em `src/app/api/ai/spec/instructions.ts` — ao essencial robusto, usando o eval
  framework do skill-creator contra o endpoint real `POST /api/ai/spec`. Use quando o usuário
  pedir para podar/otimizar/consolidar essas instruções, reduzir tokens de prompt sem perder
  robustez de spec, ou medir se uma regra do prompt é redundante com a malha determinística de
  `specValidation.ts`. Não use para gerar um spec pontual (isso é o agente
  `geovis-spec-generator`) nem para ressincronizar o agente com um novo `schema.json` (isso é a
  skill `geovis-spec-agent-creator`).
---

# Otimizador de instruções do geovis-spec-generator

Consolida duas fontes de prompt que nunca foram medidas juntas, e usa eval real (não simulação)
pra decidir o que podar. Produz propostas de diff — nunca edita `instructions.ts`/`route.ts` ou o agente sozinha.

Toda rodada é versionada e imutável — ver **Regra permanente — versionar resultados, skill e
schema** antes de rodar qualquer eval.

Ver `references/spec-generation-pipeline.md` (arquitetura de full-evalued vs runtime-captured),
`references/sources.md` (onde vivem as fontes, limites de cada uma, passo a passo da CLI `ant`),
`references/determinism-map.md` (tabela regra-do-prompt → validador que já a cobre) e
`references/golden-specs.md` (avaliação contra os mapas de produção).

## Por que separada de geovis-spec-agent-creator

`geovis-spec-agent-creator` resincroniza `~/.claude/agents/geovis-spec-generator.md` contra o
`schema.json` do `@ttoss/geovis` — schema, não robustez de prompt. Esta skill nunca escreve esse
arquivo diretamente: se uma poda no lado genérico for aprovada, delega a aplicação a
`geovis-spec-agent-creator`. Overlap zero.

## As duas fontes — nunca fundir

1. **`~/geovis-spec-generator.md`** — system prompt fixo do agente Managed Agents, provisionado
   fora de banda via `ant` CLI, referenciado só por ID (`ANTHROPIC_AGENT_ID`). Genérico ao schema
   `@ttoss/geovis`, sem noção de cozsolidarias.
2. **`INSTRUCTIONS`** (`src/app/api/ai/spec/instructions.ts`, extraída de `route.ts` em
   2026-09-18 quando passou do limite de 400 linhas do lint) — enviada por request via
   `createSession`/`initial_events`, junto com catálogo dinâmico e prompt do usuário. Domínio
   cozsolidarias: resolução de `mapType`/variável/`mapDataId`, grain município-vs-estado,
   cobertura, legendas, sources, basemap.

Fundir as duas acopla deploy de regra de negócio (route.ts, sob CI) a reprovisionamento de agente
(`ant`, fora de banda). Mantenha separadas — cada uma podada ao essencial dela.

## Regra permanente — versionar resultados, skill e schema

Restrição inegociável, vale em toda invocação: **nada é sobrescrito, tudo carrega versão**.

Cada campanha grava em `runs/<YYYY-MM-DD>T<HH-mm-ss>Z--<slug-da-variante>/` (diretório novo por
execução, nunca reutilizado, nunca editado depois de escrito). Na raiz desse diretório,
`versions.json` obrigatório, escrito **antes** do primeiro POST de eval:

```json
{
  "runId": "2026-09-18T14-03-11Z--poda-legend",
  "skillVersion": "1.1.0",
  "sources": {
    "agentSystemPrompt": { "path": "~/geovis-spec-generator.md", "sha256": "…" },
    "instructions": { "path": "src/app/api/ai/spec/instructions.ts", "gitSha": "…", "sha256": "…" }
  },
  "spec": { "schemaVersion": 2, "libSchemaVersion": 1, "geovisPackageVersion": "0.21.1" },
  "testAgent": { "slug": "geovis-spec-generator-test", "antVersion": "…" },
  "results": { "resultsVersion": 1, "datasetVersion": "…" }
}
```

Regras de preenchimento:

- **`skillVersion`** — o campo `version` do frontmatter desta skill. Toda mudança de passo,
  gate ou script bump aqui (semver: patch = texto, minor = novo gate/eixo, major = formato de
  `runs/` ou de `versions.json` muda). Resultado gravado com `skillVersion` diferente nunca é
  comparado direto com outro sem declarar isso no `benchmark.md`.
- **`spec.schemaVersion`** — versão do schema do `VisualizationSpec` que os specs gerados devem
  declarar. **Hoje: 2.** Registre sempre junto o `geovisPackageVersion` do `package.json`
  instalado e o `SPEC_SCHEMA_VERSION` lido de `@ttoss/geovis` (`src/spec/types.ts`) em
  `spec.libSchemaVersion` — na 0.21.1 ele ainda é `1`, defasagem conhecida e esperada. Se
  `libSchemaVersion` passar de `2`, **pare e reporte**: schema novo invalida comparação com
  rodadas antigas e exige ressincronizar o agente via `geovis-spec-agent-creator`.
- **`sources`** — hash sha256 do texto exato de cada fonte enviado nessa rodada, mais o git SHA do
  repo cozsolidarias para o lado `INSTRUCTIONS`. É o que torna a rodada reproduzível.
- **`results.resultsVersion`** — formato dos artefatos de saída (`output.json`, `benchmark.json`,
  `coverage-gate.json`). Bump quando o formato muda, pra nunca agregar formatos incompatíveis.

`runs/latest` é só um symlink de conveniência pro diretório mais recente — jamais o lugar onde os
dados vivem. Comparação A/B sempre cita os dois `runId` completos.

## Passo 1 — Mapear redundância com a malha determinística

Depois da resposta do agente, `route.ts` roda validação de código sobre o JSON e, no fim,
**normaliza** — `applyCanonicalScales` (`canonicalScales.ts`) reescreve a escala pintada de toda
legend ligada a um dataset conhecido. Meça isso antes de concluir que uma poda "não regrediu": três
regras do `determinism-map.md` passam a ser resolvidas pela rota, não pelo modelo. A malha de
rejeição vive em quatro módulos — `specValidation.ts` (raiz + reexports), `.sources.ts`, `.layers.ts` e
`.legends.ts`: `findInvalidGeojsonSource`, `findInvalidBasemapStyleUrl`, `findGeometryInMapData`,
`findSourceGeometryMismatch`, `findPaintedContextLayer`, `findUnsupportedSourceType`,
`findMapTypeWithoutMapData`, `findLayerWithBothDataBindings`, `findMissingLegend`,
`findChoroplethOnAbsoluteTotal`, `findDanglingActiveLegendId`, `findLegendScaleArityMismatch`,
`findLegendPropertyMismatch`, `findForeignNoDataColor`, `findReclassifiedOfficialIndex`,
`findDotDensityWithoutRatio`, depois `findLegendValueTypeMismatch` sobre os dados já resolvidos, e
por fim `validateSpec` do próprio `@ttoss/geovis`.

Leia as duas fontes e liste cada regra/instrução como item atômico em
`references/determinism-map.md`:

- Regra 100% coberta por um `findX` → **poda candidata** (não poda automática — manter a
  instrução ainda pode reduzir taxa de 422 e round-trips; a decisão é medida no Passo 4, não
  assumida aqui).
- Regra sem validador equivalente (escolha semântica de `mapDataId`/variável contra o catálogo,
  grain município-vs-estado, leitura de `spatial.coverage`/`temporal.status`, rótulo legível em
  pt-BR) → **essencial, não podável**. Nunca proponha remover isso.

Dê a cada regra um ID estável (`R-legend-required`, `R-basemap-styleurl`, `R-mapdataid-real`,
etc.) em `determinism-map.md`. Esse ID é o que o **gate de cobertura** (Passo 3/4) referencia —
toda regra da instrução atual, podável ou não, precisa de pelo menos um eval case desenhado pra
exercitá-la especificamente.

Produza, por fonte, uma versão podada candidata lado a lado com a atual, com justificativa por
item.

## Passo 2 — Provisionar o agente de teste dedicado (pede confirmação antes de gastar API real)

Use `scripts/provision_test_agent.sh` (wrapper sobre `ant beta:agents create/update/archive` —
ver `references/sources.md` pro passo a passo completo). Regras inegociáveis:

- Nunca reusar `ANTHROPIC_AGENT_ID` de produção.
- **Um único agente de teste dedicado por campanha** (`geovis-spec-generator-test`, criado uma
  vez via `create`), mesmas tools do `agent.yaml` de produção (read/glob/grep habilitados,
  bash/write/edit não). Cada variante reescreve o `system` desse mesmo agente via
  `provision_test_agent.sh update <slug> ...` (usa `--version` pra evitar overwrite concorrente).
- Só as variantes do **lado agente** (`~/geovis-spec-generator.md`) passam por esse ciclo de
  `update`. Variantes do lado `INSTRUCTIONS` (`instructions.ts`) não exigem chamada `ant` nenhuma — são
  só edição local da constante antes de rodar `pnpm dev`, já que essa fonte é enviada por request.
- Como o `system` é sobrescrito no mesmo agente, **os evals de variantes diferentes não rodam em
  paralelo** — sempre serialize: `update` → rodar todos os eval cases da variante → só então o
  próximo `update`.
- **Pare e peça confirmação explícita do usuário antes do primeiro `ant beta:agents create` de
  cada campanha** — custo real de API/infra fora do repo.
- Ao fim da campanha, pergunte ao usuário se arquiva (`ant beta:agents archive`) ou mantém o
  agente de teste pra próxima campanha (reuso é aceitável — é um agente único e rastreável).

## Passo 3 — Montar o dataset de eval

Formato `evals/evals.json` do skill-creator. Seed a partir dos prompts reais de
`tests/unit/tests/aiSpecRoute.test.ts` (cozinhas, IVS, pessoas atendidas, insegurança alimentar,
por município), mais:

- um caso por `mapType` (choropleth/proportionalCircles/dotDensity);
- dataset fora de `renderableDatasets` → deve responder `{"error"}`, nunca inventar `mapDataId`;
- pedido só resolvível em grain de estado → `{"error"}`;
- ambiguidade entre duas versões temporais do mesmo dataset → deve perguntar o ano, não escolher;
- pedido sem campo 1:1 no catálogo → não deve usar proxy correlato sem avisar;
- **um eval case por `R-*` id do `determinism-map.md`** (gate de cobertura, obrigatório) — cada
  regra hoje presente nas instruções atuais precisa de um prompt desenhado pra exercitá-la
  especificamente, não só coberta de passagem por um prompt genérico;
- **um eval case por mapa de produção alcançável** — prompts fixos contra o corpus golden em
  `src/app/(features)/mapas/specs/full-evalued/`. Regenere o corpus com
  `scripts/dump_golden_specs.mjs` (roda `buildSpec` de verdade, então nunca envelhece) e leia o
  `README.md` que ele acompanha **antes** de escrever os prompts. Dois fatos mandam no desenho:
  os 23 modos compartilham um template de 3 layers e diferem só em legend/thresholds, então a
  comparação é sempre contra o *delta*; e **só 5 dos 23 são alcançáveis pelo agente** — os outros
  18 dependem de ids que não existem em `RENDERABLE_DATASET_FETCHERS`, e nenhuma poda de prompt
  os alcança. Não escreva eval case para modo inalcançável: ele falha sempre, por construção, e
  contamina o gate. Eixos de pontuação em `references/golden-specs.md`; a identidade do dataset
  nunca é pontuada por igualdade de string.

## Passo 4 — Rodar eval contra o endpoint real (sequencial, com gate de cobertura)

Para cada variante: `provision_test_agent.sh update <slug> ...` no agente de teste único, suba/
mantenha `pnpm dev` local com env vars do agente de teste (`.env.local` temporário, nunca o `.env`
de produção), rode `scripts/run_eval_case.sh` (POST real em `http://localhost:3000/api/ai/spec`)
pra cada caso do dataset, salve `output.json` + `duration_ms`. Só depois de rodar todo o dataset
dessa variante, faça o próximo `update`.

**Gate de cobertura (pré-requisito binário, não um score)**: rode `scripts/score_case.mjs` sobre
todo eval case marcado como cobrindo um `R-*`. A variante só segue pra comparação de eficiência se
100% desses casos continuarem passando — regressão em qualquer um descarta a variante antes de
qualquer outro eixo. Isso é o mecanismo real que garante "a poda cobre no mínimo o que a instrução
atual cobre" — decidido por resultado de eval, nunca por leitura.

Passado o gate, nota em três eixos, nunca misturados num score único:

- **(a) Pass/fail programático geral** — `scripts/score_case.mjs` sobre o resto do dataset,
  reaproveitando as mesmas funções exportadas de `specValidation.ts`/`.sources.ts`. Nunca
  reimplemente essas regras.
- **(b) Rubrica qualitativa** — `agents/grader.md` do skill-creator, pro que código não pega:
  variável certa escolhida, label legível, leitura correta de cobertura/tempo, `{"error"}` correto
  quando esperado.
- **(c) Fidelidade aos mapas de produção** — `node scripts/project_spec.mjs compare <golden>
  <candidato>` nos casos golden, pontuando `geometry`/`form`/`legendScale` por código e deixando
  `dataset` pro grader. Sempre contra o *delta* do golden, nunca contra a spec inteira.
- **(d) Eficiência** — tokens do texto em `initial_events` (catálogo + `INSTRUCTIONS` + prompt) +
  `duration_ms` real. `agents/comparator.md` pra comparação cega A/B (variante podada vs.
  controle `atual-sem-poda`).

Reuse `aggregate_benchmark.py` do skill-creator pra consolidar `benchmark.json`/`.md` — cada
"configuração" é uma variante de instrução, controle sempre incluso, execuções sequenciais (não
paralelas, por causa do agente único).

## Passo 5 — Entregar propostas, nunca aplicar sozinha

Ao fim da rodada, dentro de `runs/<runId>/` (nunca commitado automaticamente, nunca sobrescrevendo
rodada anterior):

- `versions.json` — manifesto de versões da Regra permanente, já escrito antes dos evals.
- `proposed-patch-generic-agent.md` — diff sugerido pro system prompt do agente, a aplicar via
  `geovis-spec-agent-creator` se aprovado.
- `proposed-patch-instructions.diff` — diff literal pra const `INSTRUCTIONS` em `instructions.ts`.
- `coverage-gate.json` — por `R-*` id, se a variante final manteve a verificação (evidência: qual
  eval case, qual resultado).
- `benchmark.md`/`benchmark.json` — os três eixos por variante.
- Resumo recomendando aceitar/rejeitar cada mudança, citando qual `findX` cobre a regra podada
  (se algum), sempre referenciando `runId`, `skillVersion` e `spec.schemaVersion` da rodada.

Nunca edite `instructions.ts`/`route.ts` sozinha — é código de produção sob os quality gates do `CLAUDE.md` do
projeto (`pnpm typecheck && pnpm eslint --fix && pnpm test`). Entregue o diff, peça revisão
humana.

Parada: usuário aprova, ou rodada de revisão retorna feedback vazio (convenção skill-creator), ou
não há mais progresso mensurável nos três eixos.

## Fora de escopo

- Resolvido em 2026-09-18: `deleteSession` foi removido de vez (`anthropicSession.ts`, o `after()`
  de `route.ts` e o teste correspondente). A sessão fica para o lado Anthropic expirar.
- Não modifique `specValidation.ts`/`.sources.ts`/`.layers.ts`/`.legends.ts` além de importar/chamar
  suas funções exportadas.

## Quando não usar

- Gerar um spec pontual: invoque `geovis-spec-generator` diretamente.
- Ressincronizar o agente com um novo `schema.json`: use `geovis-spec-agent-creator`.
