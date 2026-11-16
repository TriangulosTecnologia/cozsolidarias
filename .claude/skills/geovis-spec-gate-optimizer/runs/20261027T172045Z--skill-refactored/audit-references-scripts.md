# Auditoria de references/ e scripts/ (2026-10-27)

## references/ desatualizados

| Arquivo | Desvio | Ação nesta rodada |
|---|---|---|
| determinism-map.md | 12 de 18 `findX` citados como `coberta-repo` não existem em src/ nem tests/ | Banner de aviso (D14). Status das linhas não alterado. |
| pipeline-diagram.md | Corpus `full-evalued/` com "23 arquivos" | Banner |
| quick-reference.md | Mesmo desvio | Banner |
| spec-generation-pipeline.md | Seções 3.2 em diante leem `full-evalued/` | Banner |
| example-generation.md | Exemplos com caminhos e formation antigos | Banner |
| evals-schema.md | `goldenCorpus` descrito como frase; `default` e `gate` sem leitor | Documentado, sem alteração |
| golden-specs.md | Atualizado nesta sessão | Nenhuma |
| decisions.md, INDEX.md | Registro histórico | Nenhuma |

## scripts/ para executar a skill

| Script | Estado antes | Ação | Estado depois |
|---|---|---|---|
| gate_pessoas_total.mjs | Lia `GEOVIS_GOLDEN_DIR` | Nenhuma | Funcionando (V1, V2) |
| run_eval_case.sh | Sem problema | Nenhuma | Funcionando (Etapa 5) |
| run_variations.sh | `goldenCorpus` quebrado; sem ramo para clarify; comentário contraditório | Usa `GEOVIS_GOLDEN_DIR`; resolve `references/`; ramo `kind: clarify` | Funcionando (5b) |
| provision_test_agent.sh | Transporte Anthropic (skill 1.x) | Marcado DEPRECATED | Não usar |
| run_campaign.sh | Roda os 21 casos; sem seleção de caso padrão | Nenhuma nesta rodada | Funciona; a seleção do padrão (Etapa 0) não está no script |
| dump_golden_specs.mjs | Gera `full-evalued/` (acoplado a /mapas) | Nenhuma | Só para o corpus de UI |
| score_case.mjs | Usado por nenhum caminho atual da Etapa 5 | Nenhuma | Fora da execução atual |
| minimal_spec.mjs | Usado por run_variations | Nenhuma | Funciona, mas o escore tem o `extra` a investigar |

## Alternativas não aplicadas

- Restaurar `goldenCorpus` em `evals.json` para `tmp/specs/full/verifield`, em vez de usar variável de
  ambiente. Mais simples, mas duplica a fonte do caminho.
- Mover os goldens de `tmp/specs/full/` (raiz) para `verifield/` para resolver os quatro casos `golden-*`.
  Exige decisão, porque os goldens da raiz não foram revisados.
- Criar `scripts/build_eval_report.mjs` para gerar o `eval-report.md` a partir dos artefatos. Não feito
  nesta rodada; o relatório desta rodada foi escrito à mão.

## Defeito encontrado e corrigido nesta rodada

`evals/evals.variations.json` não tinha o campo `prompt`. `run_variations.sh` enviou a string `"undefined"`
ao endpoint. Corrigido adicionando o prompt a cada caso. Autoria: minha, na criação do arquivo.
