

## Resolução por variação — spec mínima

Parta sempre do pedido do mapa. As regras abaixo são o padrão quando o pedido não diz o
contrário; um pedido explícito do usuário prevalece sobre elas.

### Mínimo necessário

- Inclua só o que o pedido precisa para renderizar a variável pedida e sua legenda.
- Toda `sources[]` é usada por ao menos uma layer; toda `mapData[]` é ligada por ao menos uma
  layer (`mapDataId`); toda `legends[]` é apontada por um `activeLegendId`. Nada órfão.
- Nunca inclua layer invisível (`visible: false`) nem layer "para depois": se o pedido não mostra,
  a spec não tem.
- Omita `view`, `viewPresets`, `control`, `basemap`, `paint`, `transition`, `click`,
  `hoverTooltip`, `title` e `description` quando o pedido não pedir — o app aplica o padrão.

### Sources padrão

- Área pintada: `/geo/geojs-100-mun.json` (municípios, join por `codarea`). É o padrão para toda
  variável municipal.
- Contorno: `/geo/estados.json`, só como linha de contexto, nunca pintado, sem `mapDataId` e sem
  legend própria. Inclua quando o pedido citar estados/UF ou quando a variação for de
  assentamentos.
- Exceção — assentamentos: a geometria é `/geo/assentamentos.json` e a granularidade de contorno
  relevante é o estado, então use `/geo/estados.json` como contorno e não inclua a malha de
  municípios.

### Cozinhas: pontos × bolhas

- `/api/cozinhas` — um ponto por cozinha, na localização da própria cozinha. Use para pedidos de
  localização, "onde estão", situação/funcionamento de cada cozinha.
- `/api/cozinhas/bolhas` — um círculo por município, com a quantidade de cozinhas daquele
  município. Use para pedidos de quantidade por município (`proportionalCircles`).
- Nunca use bolhas para um pedido de localização das cozinhas, nem pontos para um pedido de
  quantidade por município. Não inclua as duas no mesmo spec a menos que o pedido peça as duas.

### Escolha de dataset

1. Identifique a coleção institucional cujo tema cobre o pedido (`collections[].description`,
   quando presente no catálogo). A coleção é contexto de decisão — nunca vai para a spec.
2. Dentro dela, escolha o dataset cujo `description` (e `fields[].description`) bate com a
   variável pedida. Ex.: pedido sobre vulnerabilidade social → coleção IPEA → `municipios_ivs`.
3. Datasets de apoio que o app usa em tooltip ou como denominador (`municipios_nomes`,
   `municipios_populacao`, `municipios_cadunico`) não são renderáveis: nunca entram em `mapData`
   — o servidor rejeita (`unsupported-dataset`) e o app já resolve nome/população na tooltip.
4. `mapData[].mapDataId` continua sendo sempre um id de `renderableDatasets`.
