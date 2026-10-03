# Mapa regra-do-prompt → validador determinístico

Estado: **verificado empiricamente em 2026-09-18** contra `@ttoss/geovis@0.21.1`, o HEAD
`4da685dd` e o agente Managed Agents da skill 1.x — cada linha foi confirmada rodando o caso
contra o validador. Em **2026-10-03** os validadores citados foram reconferidos contra `src/`
(`grep`): os que não existem mais estão marcados `validador-ausente`. Os vereditos `coberta-lib` e
a coluna Fonte "agente" ainda não foram reverificados contra o agente Naturali v3 (ver
**Escopo desta tabela**).

## Como foi verificado (refazer a cada bump do geovis)

As regras sem `findX` próprio foram sondadas direto no `validateSpec` da lib, montando um spec
mínimo que viola cada uma e lendo o `status`/`issues` de volta. Repita com
`scripts/probe_validate_spec.mjs` sempre que `geovisPackageVersion` mudar: uma regra que hoje é
`coberta-lib` pode virar `não-coberta` num upgrade sem que nada no repo acuse.

A rota rejeita qualquer `status !== 'resolved'` (`route.ts`, logo após `applyCanonicalScales`),
então `coberta-lib` é enforcement real em produção, não teoria.

## Vereditos

- **coberta-repo** — um `findX` de `specValidation*.ts` rejeita, e há teste unitário. Poda
  candidata: medir no Passo 4 antes de remover do prompt.
- **coberta-lib** — `validateSpec` do `@ttoss/geovis` rejeita com código nomeado. Poda candidata
  igualmente, com a ressalva de que a garantia é de terceiros e some num upgrade.
- **normalizada** — a rota reescreve o campo depois da resposta (`applyCanonicalScales`), então o
  que o modelo emitiu ali é descartado. Instruir sobre isso é gasto puro de token.
- **validador-ausente** — o validador citado não existe nesta branch. Volta a ser essencial até
  existir validador (regra do Passo 1 do `SKILL.md`).
- **não-coberta** — nada rejeita. Manter a instrução é a única defesa.
- **semântica-essencial** — julgamento que nenhum código pode fazer. Nunca propor remoção.

## Tabela

| ID | Regra | Fonte | Onde é verificada | Veredito |
|---|---|---|---|---|
| `R-json-only` | Responder só o JSON do spec | agente | `stripCodeFence` + `JSON.parse` em `naturaliSession.ts` (fallback de `output.object`) | coberta-repo |
| `R-no-invent-url` | Nunca inventar URL de source | agente + `INSTRUCTIONS` | `findInvalidGeojsonSource` | coberta-repo |
| `R-basemap-styleurl` | `basemap.styleUrl` só estilo conhecido | `INSTRUCTIONS` | `findInvalidBasemapStyleUrl` | coberta-repo |
| `R-source-type-geojson` | Só sources `geojson`; nunca tiles/vector para join | agente (passo 2/3a) | `findUnsupportedSourceType` (ausente) | **validador-ausente** |
| `R-geometry-match` | `point`/`symbol` nunca sobre source de polígono | agente (passo 3b–e, "Geometry Type Constraint") | `findSourceGeometryMismatch` (ausente) | **validador-ausente** |
| `R-sizeby-needs-points` | `point` + `sizeBy` exige feições Point | agente ("Proportional Circles") | `findSourceGeometryMismatch` (ausente) | **validador-ausente** |
| `R-no-geometry-in-mapdata` | `mapData` é join, nunca geometria | `INSTRUCTIONS` | `findGeometryInMapData` | coberta-repo |
| `R-legend-required` | Variável pintada exige legend | `INSTRUCTIONS` + agente (passo 4) | `findMissingLegend` | coberta-repo |
| `R-both-bindings` | Layer não carrega `mapDataId` **e** `propertyName` | agente ("everything else") | `findLayerWithBothDataBindings` (ausente) | **validador-ausente** |
| `R-maptype-joins-source` | `mapType` precisa de `mapData.mapId` que case com source | agente ("everything else") | `findMapTypeWithoutMapData` (ausente) | **validador-ausente** |
| `R-grain-municipio` | Nunca pintar variável em grain de estado | `INSTRUCTIONS` (passo 1 do agente) | `findPaintedContextLayer` (ausente) | **validador-ausente** |
| `R-choropleth-not-absolute` | Coroplético nunca sobre total absoluto | `INSTRUCTIONS` | `findChoroplethOnAbsoluteTotal` | coberta-repo |
| `R-legend-matches-values` | Escala da legend casa com o tipo dos valores | agente (passo 4) | `findLegendValueTypeMismatch` (ausente) | **validador-ausente** |
| `R-dup-dimension` | Dois `mapData` no mesmo `mapId` precisam de `dimension`/`stateKey` distintos | agente (Invariants) | `validateSpec` → `duplicate-dimension` | coberta-lib |
| `R-sqrt-continuous` | `sizeBy.transform:'sqrt'` só com `mode:'continuous'` | agente (Invariants) | `validateSpec` → `invalid-schema` | coberta-lib |
| `R-dangling-refs` | `sourceId`/`mapDataId` pendurados | agente ("everything else") | `validateSpec` → `unknown-source` / `unknown-map-data-id` | coberta-lib |
| `R-threshold-order` | Thresholds ascendentes | agente ("everything else") | `validateSpec` → `invalid-threshold-order` | coberta-lib |
| `R-sizeby-range` | `sizeBy.range` não invertido | agente ("everything else") | `validateSpec` → `invalid-size-range` | coberta-lib |
| `R-no-extra-props` | Nenhuma propriedade fora do schema | agente ("everything else") | `validateSpec` → `invalid-schema` | coberta-lib |
| `R-canonical-thresholds` | Faixas oficiais de IVS/CadInSAN/cozinhas | `INSTRUCTIONS` | `applyCanonicalScales` (ausente) | **validador-ausente** |
| `R-double-legend` | `proportionalCircles` com legend auto **e** manual | agente (Invariants) | **nada** — `validateSpec` devolve `resolved` | **não-coberta** |
| `R-one-pass` | Não reler a própria saída para repontuar | agente (Output rules) | inverificável server-side | não-coberta |
| `R-mapdataid-real` | `mapDataId` é id real, escolhido por match semântico da `description` | `INSTRUCTIONS` | nenhum | semântica-essencial |
| `R-variable-choice` | Escolher a variável que responde à pergunta | `INSTRUCTIONS` | nenhum | semântica-essencial |
| `R-coverage-read` | Ler `spatial.coverage`/`temporal.status` antes de prometer o mapa | `INSTRUCTIONS` | nenhum | semântica-essencial |
| `R-label-ptbr` | Rótulo legível em pt-BR | `INSTRUCTIONS` | nenhum | semântica-essencial |
| `R-error-when-impossible` | Devolver `{"error"}` em vez de chutar | agente + `INSTRUCTIONS` | nenhum (só o grader) | semântica-essencial |
| `R-nodata-color` | `colorBy.defaultColor` é sempre a cor cinza "sem dado" | `INSTRUCTIONS` | `findForeignNoDataColor` (ausente) | **validador-ausente** |
| `R-legend-arity` | Nº de cores casa com o nº de faixas | `INSTRUCTIONS` | `findLegendScaleArityMismatch` (ausente) | **validador-ausente** |
| `R-active-legend-exists` | `activeLegendId` aponta para uma legend declarada | `INSTRUCTIONS` | `findDanglingActiveLegendId` (ausente) | **validador-ausente** |
| `R-legend-property` | `colorBy.property` casa com a chave do join | `INSTRUCTIONS` | `findLegendPropertyMismatch` (ausente) | **validador-ausente** |
| `R-official-faixas` | Índice oficial (IVS) usa as faixas publicadas, não Jenks | `INSTRUCTIONS` | `findReclassifiedOfficialIndex` (ausente) | **validador-ausente** |
| `R-dotdensity-ratio` | `dotDensity` só sobre taxa, nunca total absoluto | `INSTRUCTIONS` | `findDotDensityWithoutRatio` (ausente) | **validador-ausente** |

## Leitura para o Passo 4

12 das 33 regras são enforcement determinístico hoje (6 no repo, 6 na lib). Outras 14 citavam
validadores que não existem nesta branch (`validador-ausente`) e não são poda candidata até
existir validador. Mesmo as cobertas só se podam depois de medir, porque instrução redundante
ainda pode baixar a taxa de 422 e economizar round-trip.

As 5 `semântica-essencial` são o núcleo irredutível do `INSTRUCTIONS`: nenhuma delas tem
validador possível, e todas vivem no lado cozsolidarias, não no agente genérico.

`R-double-legend` é a única lacuna real de enforcement. É cosmética (duas legendas para uma
escala, não um mapa errado), então a escolha é: manter a linha no prompt, ou escrever
`findDuplicateLegendForSameVariable`. Decidir no Passo 5, não aqui.

## Observado em rodada real (2026-09-18, controle)

- **A cerca ```` ```json ```` é tolerada.** O agente embrulha a resposta em code fence apesar do
  "Reply with **only** the JSON object. Nothing before, nothing after." Não é violação de
  `R-json-only`: `route.ts` chama `stripCodeFence` antes do `JSON.parse`. A linha do prompt que
  proíbe a cerca é, portanto, candidata a poda — mas medir antes: sem ela o modelo pode passar a
  emitir prosa junto, que o `stripCodeFence` não salva.
- **Latência típica ~43s no transporte Anthropic (skill 1.x)**, com cold start de 81s na
  primeira chamada. Hoje o teto é o deadline de 55s do loop (`GENERATE_TIMEOUT_MS`,
  `naturaliSession.ts`): qualquer poda que aumente o raciocínio empurra casos para o deadline. O
  eixo (d) de eficiência deve olhar latência, não só tokens.

## Escopo desta tabela

O lado do agente foi enumerado por inteiro contra o system prompt da skill 1.x — cada Output
rule, cada passo de Resolution, cada Invariant. As `instructions` do agente Naturali v3
(`agents/geovis-spec-generator/formation.json`) ainda não foram re-enumeradas: antes de propor
poda com base numa linha de Fonte "agente", confirme que a regra ainda está nelas. O lado `INSTRUCTIONS` está enumerado até onde tem
enforcement: toda regra dele que tem um `findX` correspondente está aqui. O que **não** está são
as regras de `INSTRUCTIONS` que são puramente redacionais (as rampas de cor por família de
variável, a cor de borda dos polígonos, o formato do `reference`). Elas não têm validador e não
são semântica irredutível — são convenção visual, e a rota reescreve boa parte via
`applyCanonicalScales`. Enumerá-las só faz sentido se uma rodada mostrar que o modelo erra nelas.

Nota de design que vale preservar: na 1.x, `instructions.ts` importava `NO_DATA_COLOR` de
`specValidation.ts` e interpolava a constante no texto da instrução, de modo que instrução e
validador não podiam divergir. É o padrão a seguir sempre que uma regra do prompt tiver um
validador. Hoje nem a constante nem `findForeignNoDataColor` existem.
