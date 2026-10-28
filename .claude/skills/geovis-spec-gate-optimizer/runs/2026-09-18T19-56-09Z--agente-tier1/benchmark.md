# agente-tier1 vs atual-sem-poda

Controle: `2026-09-18T19-32-18Z--atual-sem-poda` (agente v1) · Variante: `2026-09-18T19-56-09Z--agente-tier1` (agente v2)
Cortes: `fix-sizeby`, `geojson-defs`, `source-type-enum` — −530 tokens (−15%).

## Gate de cobertura: **passou**

Nenhum caso `R-*` regrediu. Dos 20: 14 iguais, 5 melhoraram, 1 "regrediu" — e esse único é
timeout, não erro de conteúdo.

## Eixos

| Eixo | Controle | Tier1 | Leitura |
|---|---|---|---|
| tokens do system | ~3.437 | ~2.907 | −15% |
| latência média | 36,8s | 36,6s | **−0,5% — ruído** |
| recusas corretas | 7 | 9 | +2 |
| rejeições por validador | 4 | 0 | **−4** |
| timeouts | 2 | 2 | igual, casos diferentes |

As 4 rejeições por validador que sumiram são o resultado mais relevante: no controle,
`golden-ivs` e `error-grain-estado` dispararam `findMapTypeWithoutMapData`,
`nogolden-pessoas-atendidas` disparou `findMissingLegend`, e `trap-idhm` devolveu JSON inválido.
Na tier1, nenhum deles.

**A poda não comprou latência.** −530 tokens de entrada não moveram o relógio: o custo é o
raciocínio com `effort: high`, não a leitura do prompt. Quem quiser cortar os 77s de timeout tem
que mexer em `effort` ou em `MAX_POLL_ATTEMPTS`, não no tamanho do prompt.

## Caveat que limita a conclusão

**Não há controle de seed nem de temperature na API de Managed Agents.** Cada caso rodou uma vez.
Com n=1, 5 mudanças em 20 casos podem ser variância entre execuções, não efeito da poda. O
resultado é **sugestivo, não conclusivo**: nenhuma regressão apareceu, o que é o que o gate
pergunta, mas afirmar que a poda *melhorou* exige repetição — mínimo 3 execuções por caso por
variante, comparando distribuição e não ponto.

## Dois defeitos no próprio dataset, achados por esta rodada

1. **Prompts golden não fixam o ano.** `golden-circulos` na tier1 "recusou", mas a recusa está
   certa: o agente perguntou qual corte temporal (2025 vs 2026), que é exatamente o que o
   `INSTRUCTIONS` manda fazer quando dois datasets respondem. `golden-coropletico` e
   `golden-pontos` *não* perguntaram, com a mesma ambiguidade — o comportamento é inconsistente e
   o dataset não isola a forma cartográfica que queria testar. Corrigir: nomear o ano nos três.
2. **`rule-choropleth-absolute` parte de premissa errada.** Assumi que coroplético de contagem de
   cozinhas viola `R-choropleth-not-absolute`. Não viola: `ABSOLUTE_TOTAL_DATASET_IDS` contém
   apenas `cozinhas_pessoas_atendidas`, e a tabela do `INSTRUCTIONS` lista `cozinhas_geolocalizadas`
   entre os `mapDataId` aceitos por `choropleth`. A tier1 produzir o spec é correto; o controle
   recusar é que era conservador demais.

## Recomendação

Não aplicar ainda. A tier1 é segura pelo gate e não custa nada em qualidade observável, mas:
corrigir os dois defeitos do dataset, repetir 3× por caso, e só então decidir. O ganho real em
jogo (−15% de tokens de system, sem efeito em latência) é pequeno o bastante para não justificar
aplicar sobre evidência de n=1.

A correção `fix-sizeby` é caso à parte: não é poda, é conserto de texto corrompido, e pode ir
sozinha para produção sem esperar mais rodada.
