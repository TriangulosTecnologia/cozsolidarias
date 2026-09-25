# Passo 1 — o que podar, por fonte, com justificativa por item

Base: `references/determinism-map.md` (33 regras, 25 com enforcement determinístico), medido em
2026-09-18 contra HEAD `4da685dd` e `@ttoss/geovis@0.21.1`.

Tamanho das duas fontes, por request:

| Fonte | Tokens aprox. | Natureza |
|---|---|---|
| `~/geovis-spec-generator.md` (bloco `system:`) | ~3.577 | fixo no agente, entra em todo turno |
| `INSTRUCTIONS` (texto estático) | ~4.640 | por request, mais as tabelas interpoladas |

## Conclusão que inverte a premissa: `INSTRUCTIONS` não é alvo de poda

A skill foi desenhada supondo que regra coberta por validador é gordura no prompt. Para o lado
`INSTRUCTIONS` essa premissa **está explicitamente rejeitada no próprio código**
(`instructions.ts`, docstring do módulo):

> *Rules that a deterministic check in `specValidation.legends.ts` (or its sibling modules)
> already rejects are still stated here: the check turns a violation into a 422 the user has to
> retry, while the instruction stops the violation from happening. They are two halves of one
> rule, never a duplication to prune on one side alone.*

Isso não é convenção não-dita que dá para reinterpretar: é uma decisão escrita, com a razão junto.
O argumento é de UX, não de correção — cada regra podada que o modelo violar vira um 422 que o
usuário tem que absorver reformulando o pedido. Propor poda aqui exige **evidência de eval contra
uma decisão declarada**, não leitura de redundância. Três razões adicionais, verificadas:

1. **Já é mínimo por regra.** Quase toda regra ocupa uma linha de tabela. Não há parágrafo
   redundante para cortar — só regras inteiras, e cortar regra inteira é o que o docstring veta.
2. **Não pode divergir do código.** `instructions.ts` importa `NO_DATA_COLOR`, `buildSourcesTable()`
   e `buildCanonicalScalesTable()` e interpola os valores no texto. A tabela de sources e a de
   escalas canônicas *são* as do validador, não cópias. Esse padrão deveria ser replicado, não
   podado.
3. **Já trata as armadilhas do catálogo.** A seção "o que cada mapDataId realmente pinta" existe
   exatamente porque a `description` de `municipios_ivs` promete IDHM e subíndices que
   `RENDERABLE_DATASET_FETCHERS` não serve. A divergência é conhecida e mitigada.

**Um defeito real, independente de poda:** a seção "sources" afirma *"esta aplicação não serve
tile server"*. É falso — produção serve `/tiles/caf-h3-r{3,4,5,6}/{z}/{x}/{y}.pbf` no modo `cafs`.
A política (restringir o agente a geojson) continua certa; a justificativa está errada e deve ser
reescrita para o que de fato vale: *essas URLs são montadas pelo map builder e não são expostas ao
agente, então qualquer tipo não-geojson na resposta é URL inventada.*

## Alvo real: o system prompt do agente

42% dele (~1.499 tokens) é despejo de schema. Os cortes abaixo, em ordem de risco.

### Tier 1 — corte seguro (a rota proíbe ou rejeita o que a seção habilita)

| Item | Tokens | Por que é seguro |
|---|---|---|
| `$defs` de GeoJSON (`Position`, `LinearRing`, `Point`…`FeatureCollection`) | ~551 | O agente nunca emite geometria inline: `INSTRUCTIONS` proíbe, `findGeometryInMapData` rejeita `mapData.data` como `FeatureCollection`, e `findInvalidGeojsonSource` rejeita `FeatureCollection` vazia em `sources`. Documentar como escrever um `Polygon` habilita só o que a rota recusa. |
| Enum de tipos de source (`vector-tiles`, `raster-tiles`, `image`, `raster-dem`, `video`) | ~30 | `findUnsupportedSourceType` rejeita todos. Listá-los é ensinar cinco formas de tomar 422. Reduzir a enum a `geojson` remove a tentação na origem. |

### Tier 2 — corte provável, decidir por eval

| Item | Tokens | Tensão |
|---|---|---|
| Parágrafo *"Everything else the consumer already rejects by name"* | ~108 | Enumera a malha determinística e **admite a própria inutilidade**: *"Getting them right saves a round trip; restating them to yourself does not."* Contra o corte: é o único lugar que avisa o agente de que existe malha, o que pode mudar como ele trata incerteza. |
| Variantes de `LabelFormatSpec` (`count`, `percentage`, `stdDev`, `custom`) | ~180 | `applyCanonicalScales` reescreve `labelFormat` da legend ativa. Só a variante `labels` sobrevive num dataset conhecido. Contra o corte: legend de dataset fora da tabela canônica não é reescrita. |
| Variantes de `NormalizationSpec` | ~120 | Mesma lógica. |
| `control`, `viewPresets`, `adapterHints` | ~200 | Nenhum spec do agente precisa deles — produção monta `control` à mão em `buildSpec`. Contra o corte: nenhum validador rejeita se o agente emitir, e um pedido de "controle de camadas" ficaria sem vocabulário. |

### Tier 3 — não cortar

- **`Invariants`.** Contém `R-double-legend`, a única regra das 33 **sem validador nenhum**
  (`validateSpec` devolve `resolved` — verificado, ver `scripts/probe_validate_spec.mjs`). Cortar
  essa linha remove a única defesa que existe.
- **`Output rules`** e os passos 1–4 de `Resolution instructions`. São o contrato de saída e o
  julgamento semântico; nada os cobre.

### Defeito a corrigir antes de qualquer medição

O bloco `sizeBy` (linhas ~76–91) está com o texto corrompido — quebras de linha no meio das
palavras (`array<numb\ner>`, `Min an\nd max symbol sizes`, `mode: enum ['continuous', 's\ntepped']`).
Isso é texto que o modelo lê, num campo que governa `R-sqrt-continuous` e `R-sizeby-range`.
Corrigir **antes** de rodar a primeira variante: medir poda contra um controle corrompido mede a
corrupção, não a poda.

## Desenho da primeira campanha

Controle `atual-sem-poda` obrigatório. Variantes, na ordem:

1. `agente-tier1` — só os cortes seguros. Hipótese: sem regressão no gate, ~580 tokens a menos.
2. `agente-tier1+2` — acrescenta os Tier 2. Hipótese: é aqui que o gate começa a acusar, se acusar.
3. `instructions-tile-fix` — corrige a afirmação falsa sem podar nada. Não é variante de poda: é
   controle de que uma correção factual não move a agulha, o que valida o próprio instrumento.

Nenhuma variante do lado `INSTRUCTIONS` além da 3 até que uma rodada produza evidência contra o
docstring.
