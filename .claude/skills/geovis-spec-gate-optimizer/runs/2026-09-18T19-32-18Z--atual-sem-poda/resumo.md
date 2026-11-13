# Controle `atual-sem-poda` — 20 casos

| Veredito | N | Leitura |
|---|---|---|
| ok | 5 | resposta do tipo esperado |
| **AGENTE OK / ROTA QUEBRA** | **9** | o agente recusou corretamente com `{"error"}`; a rota validou esse erro como spec |
| DIVERGE | 4 | falha real do baseline |
| TIMEOUT | 2 | estouro do teto de 60s de polling |

## Defeito de produção encontrado

`parseGeneratedSpec` (`route.ts:344-367`) nunca checa a chave `error`. Vai do `isRecord` direto
para `validateGeneratedSpecStructure` + `validateSpec`, que rejeitam `{"error": "..."}` com
`(root) must have required property 'engine'`.

Consequência: toda recusa correta do agente — a escada de proxies, os inalcançáveis, o
`{"error"} é resposta, não falha`, tudo que o `INSTRUCTIONS` mais investe — chega ao usuário como
erro de schema genérico, e a explicação em pt-BR fica enterrada em `response.spec.error`.

Afeta 9 dos 20 casos (45%). Não invalida a comparação entre variantes (o mangling é idêntico dos
dois lados, e o texto do agente continua legível em `body.spec.error`), mas invalida a premissa de
que a taxa de 422 mede qualidade do prompt: hoje ela mede também esse defeito.

## As 4 divergências reais do baseline

| Caso | Causa |
|---|---|
| `golden-ivs` | `findMapTypeWithoutMapData` — declarou `mapType: choropleth` sem `mapData.mapId` casando com source |
| `nogolden-pessoas-atendidas` | `findMissingLegend` — pintou variável sem legend |
| `trap-idhm` | resposta não era JSON válido |
| `error-grain-estado` | `findMapTypeWithoutMapData`, em 76s |
