# Avaliação contra os mapas de produção (golden specs)

Os 23 arquivos em `src/app/(features)/mapas/specs/full/` são os mapas que o app realmente
publica. São o único conjunto de "respostas certas" que existe — mas **não podem ser comparados
diretamente com a saída do agente**. Este documento define como compará-los mesmo assim.

Ferramenta: `scripts/project_spec.mjs` (`invariant` | `project` | `compare`).

## Por que um diff de JSON cru não funciona

Quatro divergências estruturais entre os dois mundos, todas verificadas rodando
`project_spec.mjs invariant` sobre o diretório:

1. **Nenhuma spec de produção usa `mapType`.** Todas montam `layers`/`legends` explicitamente. O
   agente emite o atalho `mapType`, que só vira layer no cliente, via `resolveSpecFromMapType`.
   Comparar campo a campo compara duas notações da mesma coisa.
2. **`mapDataId` em produção é um slot genérico, não o id do dataset.** Quase todo coroplético usa
   `cozinhas-por-municipio` como id do join, seja o dado IVS, IDHM, CadÚnico ou CAF — o que muda é
   o payload, não o nome. O agente emite ids reais do catálogo (`cozinhas_pessoas_atendidas`, …).
   **Logo a identidade do dataset nunca pode ser pontuada por igualdade de string** — é trabalho
   do grader semântico.
3. **Há um invariante de template em todos os 23**: as duas camadas-base de cozinhas
   (`/api/cozinhas/bolhas` [point+sizeBy] e os pontos inline [point, categorical]). O agente não
   vai emiti-las a menos que o pedido peça. Pontuar sobre elas penalizaria toda resposta correta.
4. **Só 14 dos 23 arquivos são semanticamente distintos.** Os outros 9 são clones do mesmo
   template com payload diferente (os 5 `coropletico-idhm-*` colapsam num só; os 3
   `coropletico-ivs-*` idem; `pontos.json` ≡ `circulos.json`). Rodar 23 prompts mediria a mesma
   coisa 23 vezes.

## Fase 1 — specs entre si (sem agente, sem custo de API)

```bash
node scripts/project_spec.mjs invariant "<repo>/src/app/(features)/mapas/specs/full"
```

Produz o invariante (template compartilhado) e o **delta de cada spec** — o conjunto de vínculos
`geometria × dataset × forma cartográfica × escala de legenda` que só aquele mapa tem.

**O delta é a especificação do prompt.** Se dois arquivos têm delta idêntico, um prompt só pode
distingui-los por valor, não por estrutura — então vira um caso só. Rode esta fase primeiro
sempre: ela define quantos casos de eval existem de verdade e não custa nada.

## Fase 2 — prompts fixos

Um prompt por delta distinto, escrito a partir do delta e **nunca do arquivo**: o prompt descreve
o pedido em linguagem natural (como um usuário faria), não o spec. O delta serve para conferir se
o prompt é específico o bastante para determinar a resposta.

Exemplo, do delta de `coropletico-cafs-percentual.json`
(`cozinhas-por-municipio @ /geo/geojs-100-mun.json [polygon] quantitative n=5524`):

> "mapa coroplético do percentual de estabelecimentos com CAF por município"

Registre cada par em `evals/evals.json` com `golden` apontando para o arquivo, e rode via
`scripts/run_eval_case.sh` como qualquer outro caso.

**Excluir explicitamente**, marcando como `unreproducible` no dataset em vez de deixar falhar
para sempre:

- `cafs.json` — usa sources `vector-tiles` (`/tiles/caf-h3-r*/{z}/{x}/{y}.pbf`) e camadas ligadas
  por `propertyName`, e o agente é instruído a nunca emitir tiles.
- `assentamentos.json` — desde 2026-09-18 a source `/geo/assentamentos.json` saiu de
  `KNOWN_SOURCE_URLS` e os datasets `assentamentos`/`assentamentos_atributos` saem da projeção do
  catálogo (`AI_EXCLUDED_DATASET_IDS` em `mapDataCatalogue.ts`). O modo continua publicado pelo
  app, montado à mão em `geovisAssentamentos.ts` — o agente é que não tem como referenciá-lo.
  Um prompt pedindo assentamentos deve produzir `{"error"}`; vale como eval case de recusa, nunca
  como golden a reproduzir.

Os demais mapas cujo valor não é alcançável pelos `renderableDatasets` (todos os
`coropletico-idhm-*`, os três `coropletico-ivs-*` de subíndice, `coropletico-taxa`,
`coropletico-percentual`, `coropletico-cafs-percentual`, `coropletico-cadunico`,
`coropletico-pessoas-cozinha`, `coropletico-cadinsan-sem-pbf`) também não são reproduzíveis hoje —
ver `R-unreachable-indicator` e `R-derived-rate` no `determinism-map.md`. Trate-os como eval cases
de recusa (`{"error"}` esperado), não como goldens: pontuá-los como mapas a reproduzir mede uma
capacidade que a rota deliberadamente não tem.

## Fase 3 — pontuar na projeção, não no JSON

```bash
node scripts/project_spec.mjs compare <golden.json> <candidato.json>
```

Quatro eixos, cada um `0..1`, reportados separados (nunca somados num número só):

| Eixo | O que mede | Comparável por código? |
|---|---|---|
| `geometry` | a geometria certa (`/geo/geojs-100-mun.json` vs `/api/cozinhas/bolhas` vs estados) | sim |
| `form` | a forma cartográfica (`polygon`, `point+sizeBy`, …) | sim |
| `legendScale` | `quantitative` vs `categorical` | sim |
| `dataset` | o dataset certo | **não** — ver divergência 2; delega ao `agents/grader.md` |

Compare sempre contra o **delta**, não contra a spec inteira: o invariante de template é ruído.

## Como isso se liga ao gate de cobertura

Os casos golden são um eixo **complementar** ao gate de `determinism-map.md`, não um substituto.
O gate pergunta "a variante podada ainda pega todos os erros que a instrução atual pegava?"; os
goldens perguntam "a variante podada ainda acerta os mapas que o app de fato publica?". Uma
variante precisa passar nos dois: uma instrução pode rejeitar todo spec inválido e ainda assim
nunca produzir o mapa certo.
