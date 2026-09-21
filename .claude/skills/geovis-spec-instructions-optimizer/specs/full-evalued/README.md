# full-evalued — corpus golden dos specs de produção

Gerado por `buildSpec` (`../../geovisSpec.ts`), um arquivo por valor de `MapMode`. É o alvo
contra o qual as rodadas de eval do gerador de spec por IA são pontuadas.

Regenerar (da raiz do repo — o gateway resolve arquivos relativos ao `cwd`):

```bash
node --experimental-strip-types \
  ~/.claude/skills/geovis-spec-instructions-optimizer/scripts/dump_golden_specs.mjs
```

`manifest.json` carrega a procedência da rodada: git sha, versão do geovis, contagem de linhas
por dataset e timestamp. O diretório é sobrescrito a cada geração — ele é o ideal *corrente*, e o
manifesto é quem diz de qual código ele saiu.

## Por que os valores são elididos

`mapData[].data` e as `FeatureCollection` inline viram `{ __elided, rows, valueKind, sample }`.
O agente nunca emite esses valores: ele devolve `mapData` com placeholder e `appendRealMapData`
troca por linhas reais do gateway no servidor. Pontuar um candidato contra valores reais mediria
a rota, não o modelo. Passa `--full` se precisar do dump bruto (14MB).

## Estrutura real do corpus

Os 23 modos são todos distintos, mas a distinção é rasa: **18 deles compartilham exatamente os
mesmos três layers** —

```
municipios-br-fill : polygon : visível : cozinhas-por-municipio
cozinhas-bolhas    : point   : oculta  : sizeBy
cozinhas-pts       : point   : oculta
```

— e diferem só no título da legend e nos thresholds. `circulos` e `pontos` são o mesmo template
com outra layer visível. Só `assentamentos`, `cafs` e `cafs-hexbin` têm conjunto de layers
próprio.

Consequência para o eval: comparar spec inteira é ruído: 90% do arquivo é template. A comparação
tem que ser contra o *delta* (ver `references/golden-specs.md`).

## Alcançabilidade pelo agente

O agente escolhe `mapDataId` dentro de `RENDERABLE_DATASET_IDS`, e cada id resolve para **uma**
variável fixa em `RENDERABLE_DATASET_FETCHERS`. Isso limita duramente o que é reproduzível:

| Modo | Dataset | Alcançável? |
|---|---|---|
| `coropletico` | `cozinhas_geolocalizadas` | ✅ |
| `pontos` | `cozinhas_geolocalizadas` (variante de visibilidade) | ✅ |
| `circulos` | `cozinhas_geolocalizadas` (variante de visibilidade) | ✅ |
| `coropletico-ivs` | `municipios_ivs` | ✅ |
| `coropletico-cadinsan-com-pbf` | `municipios_cadinsan` | ✅ |
| `coropletico-cadinsan-sem-pbf` | — | ❌ fetcher fixa `proporcaoComPbf` |
| `coropletico-ivs-{infraestrutura,capital-humano,renda-trabalho}` | — | ❌ fetcher devolve só `row.ivs` |
| `coropletico-idhm` + 5 variantes | — | ❌ sem id no catálogo |
| `coropletico-{taxa,percentual,cadunico,pessoas-cozinha}` | — | ❌ derivados, sem id |
| `coropletico-cafs-percentual` | — | ❌ CAF não é renderable |
| `assentamentos` | — | ❌ em `AI_EXCLUDED_DATASET_IDS` |
| `cafs`, `cafs-hexbin` | — | ❌ vector tiles, fora de `KNOWN_SOURCE_URLS` |

**5 de 23 são reproduzíveis hoje.** Os outros 18 não são "prompts difíceis" — estão fora do
alcance do agente por construção, e nenhuma poda ou melhoria de prompt muda isso. Chegar neles
exige expor novos ids em `RENDERABLE_DATASET_FETCHERS`, não mexer em instrução.

Dois datasets renderable não têm modo de produção correspondente:
`cozinhas_geolocalizadas_2025` e `cozinhas_pessoas_atendidas`. Os eval cases deles não têm golden
— pontue-os só pela rubrica.
