# eval-report

Gerado a partir dos artefatos desta rodada, sem nova chamada de API para o relatório. Script gerador
ainda não existe; este arquivo foi preenchido à mão a partir de `step-*.json`, `step-*.md` e
`variations/`. A seção 6 segue `references/human-review.md`: o modelo redige as perguntas e aponta a
evidência; não responde.

## 1. Identificação e reprodução

- runId: `20261027T172045Z--skill-refactored`
- caseId: `nogolden-pessoas-atendidas-quero-ver` (caso padrão, Etapa 0)
- prompt: "Quero ver o número total de pessoas atendidas pelas cozinhas solidárias por município"
- skillVersion: 3.0.0 (o `SKILL.md` atual declara 3.1.0; esta rodada foi executada com 3.0.0)
- Agente: produção (`NATURALI_AGENT_ID` do `.env`). Formation de teste: não criada (Etapa 2, NÃO EXECUTADO).
- GEOVIS_GOLDEN_DIR efetivo: `tmp/specs/full/verifield`
- Duração do caso padrão: 17153 ms, 1 chamada ao endpoint.
- Duração das variações: 2 chamadas, ~18 s cada.

## 2. Interpretação da intenção

Não há contrato de intenção gravado para este caso. Pelo `expect` do caso: dataset
`cozinhas_pessoas_atendidas`, variável `pessoasAtendidas`, forma `point+sizeBy`, escala quantitativa.

## 3. Seleção e verificação dos dados

- Dataset na saída: `cozinhas_pessoas_atendidas`, 348 linhas em `mapData`.
- Total do oráculo (CSV + regra do gateway): 348 municípios, soma 789.755.
- Campo da variável: `pessoasAtendidas`, do catálogo `public/dataset_catalogue.json`.

## 4. Auditoria do spec

- `mapType`: `proportionalCircles`.
- Layers: `municipios-boundary-line` (line), `estados-boundary-line` (line), `pessoas-atendidas-circulos`
  (point, `sizeBy`, `mapDataId` = `cozinhas_pessoas_atendidas`).
- Legenda: `Pessoas atendidas pelas Cozinhas Solidárias`, quantitativa.
- Diferença em relação ao golden: a saída não tem a layer `municipios-contorno` (polygon sem legenda
  no golden).

## 5. Resultados dos testes

| Id | Verificação | Estado | Evidência |
|---|---|---|---|
| V1 | Gate de contrato e total, sobre a spec do caso padrão | PASS | `step-4-v1-default.json` (exit 0, 0 falhas) |
| V2 | Autoteste do gate | PASS | `step-4-v2-self-test.json` (golden PASS, 5 de 5 mutantes) |
| V3 | Contagem em polygon com clarify | PASS | `variations/v-coropletico-cozinhas-referencia.score.json` (pass true) |
| V4 | Dois prompts de pessoas | NÃO REEXECUTADO nesta rodada | Ver `runs/20261027T120609Z--pos-extensao-absoluto-lista/` (PASS) |
| V5 | Variações | FALHOU parcialmente | `variations/v-pessoas-atendidas.score.json`: `renderEquivalent: false`, `recall: 0.5` |
| V6 | `pnpm test` | NÃO EXECUTADO (D9) | — |

Achados de V5, a confirmar antes de decidir:

- A saída não tem a layer polígono municipal do golden. Isso reduz o recall.
- O escore reporta `extra: polygon @ /geo/geojs-100-mun.json | legend=quantitative/5`, mas nenhuma layer
  da saída é polígono. O escore deve estar lendo outra coisa (possivelmente a legenda). Não investigado nesta
  rodada.
- `missing: point+sizeBy @ inline:geojson`: a fonte do círculo na saída é `bolhas-pessoas`; no golden é
  `bolhas-pessoas-atendidas`. O escore compara por rótulo de fonte, então esse item pode ser falso negativo.

## 6. Decisão humana

Preenchida somente por uma pessoa revisora. Até lá, o campo fica vazio e o estado é **sem decisão**.

### Perguntas e pontos de evidência

Responder cada pergunta com **sim**, **não** ou **incerto**, citando o artefato que sustenta a resposta.

| ID | Pergunta | Pontos de evidência (não são respostas) |
|---|---|---|
| Q1 | O mapa responde à pergunta original? | Prompt na seção 1; `step-5-default.spec.json`; `step-5-default.output.json` |
| Q2 | A variável corresponde ao conceito pedido (métrica, unidade, população)? | `mapDataId` `cozinhas_pessoas_atendidas` em `step-5-default.spec.json`; campo `pessoasAtendidas` e sua descrição em `public/dataset_catalogue.json` |
| Q3 | O dataset está em `acceptableDatasets` do golden semântico? | `references/goldens/semantic/` está vazio: não há entrada aprovada. Pergunta não aplicável nesta rodada |
| Q4 | Algum proxy ou valor derivado está declarado, com a fórmula? | Título e legenda em `step-5-default.spec.json`; texto da resposta do agente em `step-5-default.output.json` |
| Q5 | O período está correto e comparável com o que a pergunta sugere? | `temporal.status: unknown` para `cozinhas_pessoas_atendidas` em `public/dataset_catalogue.json`; a saída não tem campos de tempo |
| Q6 | Título ou legenda podem levar a uma conclusão errada (por exemplo, contagem lida como pessoas)? | Título e legenda em `step-5-default.spec.json`; `scaleMaxValue`; soma 789.755 (seção 3) |
| Q7 | O agente declarou limitações quando usou uma aproximação? | Mensagem do agente em `step-5-default.output.json` (campo de texto não inspecionado nesta rodada) |
| Q8 | O tipo de mapa é adequado aos dados (círculos para totais, áreas para taxas)? | `mapType` `proportionalCircles` (seção 4); comparação com o golden estrutural (seção 4) |
| Q9 | O revisor aprovaria esta spec como referência? | Respostas de Q1 a Q8 |

### Regras de decisão (de `references/human-review.md`)

- **Aprovado:** Q1 = sim, Q2 = sim, Q4 e Q6 sem problema, e Q9 = sim.
- Qualquer **não** em Q2 ou Q6 significa **reprovado**, independentemente dos gates automáticos.
- Qualquer **incerto** mantém o estado **inconclusivo**.
- Falha só em Q7 ou Q8: **reprovado** se o defeito induz a erro; caso contrário, **aprovado com item de
  correção** na seção 7.
- Caso sem golden semântico aprovado pode ser revisado, mas a decisão não promove nada a referência.

### Registro (campos vazios até a revisão humana)

| Campo | Conteúdo |
|---|---|
| `reviewer` | |
| `date` | |
| `decision` | |
| `answers` | |
| `justification` | |

Os campos `reviewer`, `date` e `decision` nunca são preenchidos a partir de saída do modelo.

## 7. Plano de correção

1. Escore (`minimal_spec.mjs`): investigar de onde vem o `extra` de polígono quantitativo. Camada: script de
   pontuação. Teste de regressão: a mesma saída deve ter `extra` vazio.
2. Golden de comparação: decidir se `municipios-contorno` é obrigatória. Camada: golden
   (`_pessoas-atendidas.json`) ou regra de equivalência do escore.
3. Goldens dos casos `golden-pontos`, `golden-circulos`, `golden-ivs` e `golden-cadinsan`: não existem em
   `GEOVIS_GOLDEN_DIR` com os nomes de `evals.json`. Camada: dados de eval. Ver `step-3-dataset.md`.
