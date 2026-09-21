# Corpus de Specs: Full-Evalued e Runtime-Captured

Este diretório organiza duas categorias ortogonais de `VisualizationSpec` usadas no ciclo de geração e validação de mapas.

---

## full-evalued/

**Golden corpus gerado da produção.**

Contém um VisualizationSpec JSON por `MapMode` do app, produzido rodando `buildSpec()` de verdade com dados live do gateway. Nunca editado à mão — é regenerado a cada campanha de otimização de instrução via:

```bash
node --experimental-strip-types \
  ~/.claude/skills/geovis-spec-instructions-optimizer/scripts/dump_golden_specs.mjs
```

**Arquivo:** `manifest.json` — provenance e versionamento (git SHA, geovis version, row counts, timestamp).

**Uso:** Benchmark para avaliação de robustez de instrução (`POST /api/ai/spec`). Cada eval case com `.golden` apontado é comparado contra o delta (estrutura de binding, não valores brutos) deste corpus.

**Características:**

- 23 arquivos (um por MapMode)
- Apenas 14 semanticamente distintos (9 clones com payload diferente)
- Apenas 5 alcançáveis pelo agente (os demais dependem de datasets fora de `renderableDatasets`)
- Dados brutos em `mapData[].data[]` nunca são pontuados (o agent nunca emite valores — apenas estrutura)

Ver `references/golden-specs.md` para comparação estrutural e `references/spec-generation-pipeline.md` § 1 para detalhes de geração.

---

## runtime-captured/

**Specs capturados durante avaliação — output do agente em resposta a prompts.**

Estrutura por rodada:

```
runs/2026-09-18T14-03-11Z--poda-legend/evals/caso-X/output.json
```

Cada arquivo contém:

- `prompt`: o prompt que o agente recebeu
- `httpStatus`: 200 (sucesso) ou 422 (validação falhou)
- `durationMs`: tempo de round-trip
- `response`: o spec JSON ou erro de validação

Gerado por `scripts/run_eval_case.sh`, que faz POST a `http://localhost:3000/api/ai/spec`.

**Uso:**

- Pontuação: cada caso é comparado via `scripts/score_case.mjs` (programático) e `agents/grader.md` (semântico)
- Gate de cobertura: casos marcados com `.coverageRuleId` devem passar 100%; regressão em qualquer um descarta a variante
- Fidelidade: casos com `.golden` apontado são comparados estruturalmente via `scripts/project_spec.mjs compare`

Ver `references/spec-generation-pipeline.md` § 2 para detalhes de captura e § 3 para ciclo de validação.

---

## variants/

Documentação de variantes testadas — propostas de poda do system prompt do agente ou `INSTRUCTIONS`.

- `README.md` — visão geral das variantes
- `justificativa.md` — por que cada uma foi testada
- `agente-*.md` — propostas de diff para o system prompt (a aplicar via `geovis-spec-agent-creator` se aprovadas)

---

## runs/

Histórico imutável de campanhas de otimização.

Cada campanha tem seu próprio diretório versionado:

```
runs/<YYYY-MM-DD>T<HH-mm-ss>Z--<slug-variante>/
├── versions.json
├── evals/evals.json
├── evals/<case>/output.json       ← runtime-captured
├── coverage-gate.json
├── benchmark.md
└── proposed-patch-*.diff
```

`runs/latest` é um symlink de conveniência que aponta ao diretório mais recente — o dado sempre vive no `<runId>` específico.

Ver `references/spec-generation-pipeline.md` § 2.2 para estrutura detalhada.

---

## Relação: Full-Evalued ↔ Runtime-Captured

| Aspecto             | Full-Evalued                               | Runtime-Captured                          |
| ------------------- | ------------------------------------------ | ----------------------------------------- |
| **Origem**          | `buildSpec()` em produção                  | Agente + route handler em eval            |
| **Atualização**     | Regenerado toda campanha                   | Capturado durante eval, nunca reutilizado |
| **Edição**          | Nunca (determinístico)                     | Nunca (artefato immutable)                |
| **Propósito**       | Benchmark de fidelidade                    | Validação de robustez de instrução        |
| **Escala de dados** | Completos (elided por defaul para tamanho) | Sem dados brutos (agent nunca emite)      |
| **Comparação**      | Contra delta estrutural, não valores       | Pontuação programática + rubrica          |

---

## Entrada

- **Quero ver o que o app publica em produção:** `full-evalued/` + `manifest.json`
- **Quero rodar eval de uma nova variante de instrução:** `scripts/run_eval_case.sh` → `runtime-captured` em `runs/<runId>/evals/<case>/`
- **Quero regenerar golden corpus:** `dump_golden_specs.mjs` → sobrescreve `full-evalued/`
- **Quero comparar agent output contra golden:** `scripts/project_spec.mjs compare`

Ver `~/.claude/skills/geovis-spec-instructions-optimizer/SKILL.md` para workflow completo de otimização.
