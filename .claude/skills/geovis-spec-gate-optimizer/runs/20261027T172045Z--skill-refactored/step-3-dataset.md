# Etapa 3: dataset de eval

GEOVIS_GOLDEN_DIR efetivo: /home/triangulos/Documentos/repos/cozsolidarias-review/tmp/specs/full/verifield

| origem | id | golden | existe |
|---|---|---|---|
| evals.json | golden-coropletico | references/goldens/coropletico-cozinhas-clarify.json | sim |
| evals.json | golden-pontos | pontos.json | NÃO |
| evals.json | golden-circulos | circulos.json | NÃO |
| evals.json | golden-ivs | coropletico-ivs.json | NÃO |
| evals.json | golden-cadinsan | coropletico-cadinsan-com-pbf.json | NÃO |
| evals.json | nogolden-pessoas-atendidas | _pessoas-atendidas.json | sim |
| evals.json | nogolden-pessoas-atendidas-quero-ver | _pessoas-atendidas.json | sim |
| evals.variations.json | v-pessoas-atendidas | _pessoas-atendidas.json | sim |
| evals.variations.json | v-coropletico-cozinhas-referencia | references/goldens/coropletico-cozinhas-clarify.json | sim |

Casos de evals.json: 21. Casos de variações: 2.
Campo goldenCorpus de evals.json: "tmp/specs/full/verifield" (valor de frase, não caminho; ver decisão pendente).
