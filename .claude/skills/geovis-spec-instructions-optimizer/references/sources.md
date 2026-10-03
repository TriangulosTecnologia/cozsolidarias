# Fontes de instrução e provisionamento de variante

## Onde cada fonte vive

| Fonte | Caminho | Natureza | Como muda |
|---|---|---|---|
| `instructions` do agente | `agents/geovis-spec-generator/formation.json` (`resources.geovis_spec_generator_loop.properties.instructions`) | Deveriam ser genéricas ao schema `@ttoss/geovis` — hoje embutem cópia do catálogo (ver `SKILL.md`). | PR no arquivo → `plan` → `deploy` da pasta do agente. |
| `INSTRUCTIONS` | const inline em `src/app/api/ai/spec/route.ts` | Domínio cozsolidarias: catálogo, sources, mapData, legendas, basemap. | Merge no repo, sob quality gates (`pnpm typecheck`/`eslint`/`test`). |
| Catálogo | `buildCatalogueContext()` (`mapDataCatalogue.ts`) | Dinâmico, derivado de `gateway.getCatalogue()` a cada processo. | Não é instrução podável — é dado, sempre enviado. |
| Tabela de sources | `buildSourcesTable()` (`specValidation.ts`) | Markdown majoritariamente estático + linhas geradas de `KNOWN_SOURCE_URLS`/`SOURCE_METADATA`. | Acompanha `INSTRUCTIONS`. |

Nunca funda essas duas fontes num prompt único — ver justificativa no `SKILL.md`.

## Limites de cada uma

- As `instructions` do agente **não podem** conter regra de negócio cozsolidarias (catálogo, ids
  de dataset reais, URLs de source reais) — isso quebraria o agente pra qualquer outro app que o
  reusasse (é genérico ao `@ttoss/geovis`).
- `INSTRUCTIONS` **não pode** duplicar doc de schema genérico (campos do `VisualizationSpec`,
  `$defs`) — isso já vive no `output_schema` do agente; duplicar é gasto de token sem ganho.
- Nenhuma das duas deve reimplementar em prosa uma regra que `specValidation.ts` já garante em
  código — ver `determinism-map.md`.

## Passo a passo — CLI `naturali`

`agents/geovis-spec-generator/formation.json` é a fonte de verdade do agente de produção. Os
comandos de produção (`validate`/`plan`/`deploy`) e as env vars estão no
[README da pasta](../../../../agents/geovis-spec-generator/README.md). A skill **nunca edita esse
arquivo**: variantes vivem em cópias dentro de `runs/<runId>/`.

A CLI lê `NATURALI_TOKEN` e `NATURALI_PROJECT`; exporte-as a partir de `NATURALI_API_KEY` e
`NATURALI_PROJECT_ID` do `.env`, junto com `NATURALI_FORMATION_ID` e `NATURALI_AGENT_ID`. Nunca
grave a chave em arquivo versionado.

Por variante, a partir da raiz do repo (sequencial — ver `SKILL.md`, Passo 2):

```bash
NATURALI="pnpm dlx @naturali/cli@0.170.3"
RUN=.claude/skills/geovis-spec-instructions-optimizer/runs/<runId>

# 1. backup do vivo
$NATURALI get-formation --formation-id "$NATURALI_FORMATION_ID" > "$RUN/backup.live-formation.json"
$NATURALI get-agent --agent-id "$NATURALI_AGENT_ID" > "$RUN/backup.live-agent.json"

# 2. variante = cópia do arquivo do repo; edite só a cópia
cp agents/geovis-spec-generator/formation.json "$RUN/formation.<config>.json"

# 3. validar e aplicar a cópia
$NATURALI validate-formation --template "@$RUN/formation.<config>.json"
$NATURALI update-formation --formation-id "$NATURALI_FORMATION_ID" --template "@$RUN/formation.<config>.json"

# 4. registrar a versão aplicada em versions.json (testAgent.agentVersion)
$NATURALI get-agent --agent-id "$NATURALI_AGENT_ID"
```

A formation do loop é a de produção: entre o passo 3 e o fim da campanha, produção serve a
variante. Ao fim, restaure o vivo ao arquivo do repo com `pnpm --dir agents/geovis-spec-generator
deploy` e confirme com `get-agent` que as `instructions` vivas são as do arquivo. A variante
aprovada entra em `agents/geovis-spec-generator/formation.json` por PR e só é deployada depois do
merge.
