# Otimizador de Instruções do Geovis-Spec: Índice de Referência

Skill para otimizar e medir robustez de instruções do gerador de VisualizationSpec, comparando duas fontes ortogonais: **full-evalued specs** (golden corpus da produção) e **runtime-captured specs** (output do agente em eval).

---

## 🎯 Por Onde Começar

1. **Primeira vez?** Leia `SKILL.md` — workflow executável completo, passo a passo.
2. **Entender a arquitetura?** Veja `references/spec-generation-pipeline.md` (mapa central).
3. **Precisa de visual?** Acesse `references/pipeline-diagram.md`.
4. **Refer rápida?** Use `references/quick-reference.md`.

---

## 📚 Documentos (Ordenados por Uso)

### Workflow Executável

| Doc | Propósito | Audience |
|-----|-----------|----------|
| **`SKILL.md`** | Instruções completas com 5 passos. Passo a passo de `provision_test_agent.sh` até entrega de propostas. | Quem vai rodar uma campanha |

### Referência Técnica

| Doc | Propósito | Seções-chave |
|-----|-----------|--------------|
| **`references/spec-generation-pipeline.md`** | Arquitetura central. O que são full-evalued vs runtime-captured, como são gerados, e como se relacionam. | § 1–6 (geração, estrutura, ciclo, checklist) |
| **`references/pipeline-diagram.md`** | Visualização em ASCII. Fluxo de dados, fases do ciclo, estrutura de arquivos, decisões. | Todos os §§ (leitura rápida de estrutura) |
| **`references/quick-reference.md`** | Resumo executivo. Comandos, checklists, links rápidos. | Geração, captura, comparação, cobertura |

### Domínio-Específico

| Doc | Propósito | Quando usar |
|-----|-----------|-------------|
| **`references/sources.md`** | Onde vivem as fontes (INSTRUCTIONS vs agente). CLI `ant`, autenticação, passo a passo de provisionamento. | Passo 2 do SKILL.md (provisioning) |
| **`references/determinism-map.md`** | Tabela regra-do-prompt → validador que já a cobre. Identifica o que é podável. | Passo 1 do SKILL.md (redundância) |
| **`references/golden-specs.md`** | Como comparar candidatos contra os 23 modos de produção. Fases 1–3 da avaliação. | Passo 3 do SKILL.md (dataset) e depois |

---

## 🗂️ Scripts

Todos em `scripts/`:

| Script | Entrada | Saída | Momento |
|--------|---------|-------|--------|
| **`dump_golden_specs.mjs`** | Nenhuma (live data da produção) | `src/app/(features)/mapas/specs/full-evalued/` + `manifest.json` | Antes de cada campanha (Passo 1) |
| **`run_eval_case.sh`** | Prompt + output path | `output.json` (runtime-captured) com HTTP status, timing, resposta | Durante eval (Passo 4) |
| **`project_spec.mjs`** | Golden JSON + candidato JSON | Delta (extract-delta) ou scores (compare) | Depois de capturar todos os outputs (Passo 4) |
| **`score_case.mjs`** | `output.json` | Pass/fail programático, pontuação por `findX` | Gate de cobertura (Passo 4) |
| **`provision_test_agent.sh`** | Slug + prompt file + test-agent.json | Agente atualizado via `ant beta:agents update` | Por variante (Passo 2) |

---

## 📁 Estrutura de Arquivos

```
.claude/skills/geovis-spec-instructions-optimizer/
│
├── SKILL.md                           ← Comece aqui
├── INDEX.md                           ← Este arquivo
│
├── references/
│   ├── spec-generation-pipeline.md    ← MAPA CENTRAL
│   ├── pipeline-diagram.md
│   ├── quick-reference.md
│   ├── sources.md
│   ├── determinism-map.md
│   └── golden-specs.md
│
├── scripts/
│   ├── dump_golden_specs.mjs
│   ├── run_eval_case.sh
│   ├── project_spec.mjs
│   ├── score_case.mjs
│   ├── provision_test_agent.sh
│   ├── build_agent_variant.mjs
│   └── probe_validate_spec.mjs
│
├── variants/
│   ├── README.md
│   ├── justificativa.md
│   └── agente-*.md (propostas de poda)
│
└── runs/
    ├── 2026-09-18T14-03-11Z--poda-legend/ ← Exemplo
    │   ├── versions.json
    │   ├── evals/evals.json
    │   ├── evals/<case>/output.json
    │   ├── coverage-gate.json
    │   ├── benchmark.json
    │   └── proposed-patch-*.diff
    └── latest/ (symlink)
```

---

## 🚀 Fluxo Rápido

**Quero otimizar a instrução do agente:**

1. Leia `SKILL.md` (workflow completo)
2. Rode Passo 1: `references/determinism-map.md` (mapeie redundância)
3. Rode Passo 2: `scripts/provision_test_agent.sh create` (agente de teste)
4. Rode Passo 3: desenhe `evals/evals.json` (cases com cobertura)
5. Rode Passo 4: `scripts/run_eval_case.sh` por caso (captura runtime-captured)
6. Rode Passo 5: `scripts/project_spec.mjs compare` (pontuação vs golden)
7. Entregue propostas (nunca edite sozinha)

**Quero entender a arquitetura:**

1. `references/spec-generation-pipeline.md` — 6 seções, explica tudo
2. `references/pipeline-diagram.md` — visual com fluxos de dados

**Quero referência rápida:**

1. `references/quick-reference.md` — comandos, checklists, links

**Quero ver um exemplo concreto:**

1. `runs/2026-09-18T14-03-11Z--*/` — rodada passada (versions.json, output.json, benchmark)

---

## 📊 Dois Corpus de Specs

| Aspecto | Full-Evalued | Runtime-Captured |
|---------|--------------|------------------|
| **O que é** | Specs gerados da produção (23 arquivos) | Specs gerados pelo agente em eval (por caso) |
| **Gerador** | `buildSpec()` em produção | Agente + route handler `/api/ai/spec` |
| **Localização** | `src/app/(features)/mapas/specs/full-evalued/` | `runs/<runId>/evals/<case>/output.json` |
| **Atualização** | Regenerado toda campanha (determinístico) | Capturado durante eval (imutável) |
| **Edição** | Nunca (automático) | Nunca (imutável) |
| **Propósito** | Benchmark (verdade de produção) | Validação (robustez de instrução) |

Ver `references/spec-generation-pipeline.md` para detalhes.

---

## ⚙️ Regra Permanente: Versionamento

Toda rodada de eval é imutável e rastreável:

```json
{
  "runId": "2026-09-18T14-03-11Z--poda-legend",
  "skillVersion": "1.4.0",
  "sources": {
    "agentSystemPrompt": { "path": "~/geovis-spec-generator.md", "sha256": "..." },
    "instructions": { "path": "src/app/api/ai/spec/instructions.ts", "gitSha": "...", "sha256": "..." }
  },
  "spec": { "schemaVersion": 2, "libSchemaVersion": 1, "geovisPackageVersion": "0.21.1" }
}
```

Nada é sobrescrito. Cada rodada carrega sua `versions.json`. Comparação A/B sempre cita `runId` e `skillVersion`.

---

## 🔗 Contexto Mais Amplo

- **Gerador de spec (agente):** `geovis-spec-generator` (fora do repo, provisionado via `ant`)
- **Ressincronização do agente:** `geovis-spec-agent-creator` (quando schema muda)
- **Validação determinística:** `src/app/api/ai/spec/specValidation.ts` (regras de rejeição em código)
- **Data gateway:** `src/data-gateway/createDataGateway.ts` (catalogo, sources, datasets)

---

## ❓ FAQ

**P: O que é o delta em um spec?**  
R: A estrutura de binding (sources, layers, joins, legends) sem os dados brutos. É a parte que o agente de verdade emite.

**P: Por que não comparo JSON cru contra golden?**  
R: 4 divergências estruturais (ver `golden-specs.md` § "Por que um diff de JSON cru não funciona") tornam a comparação cega inválida. Compare sempre contra o delta.

**P: O gate de cobertura é opcional?**  
R: Não. Binário: se qualquer caso R-* falha, variante é descartada, fim. Não vai pra pontuação.

**P: Posso editar specs à mão?**  
R: Nunca. Full-evalued é determinístico (regenerado). Runtime-captured é imutável (história). Sempre por função ou script.

**P: Quantas campanhas já rodaram?**  
R: Ver `runs/` — cada `<YYYY-MM-DD>T*--slug>/` é uma. `runs/latest` aponta a mais recente.

---

## 🛠️ Troubleshooting

| Problema | Solução |
|----------|---------|
| `manifest.json` tem git SHA diferente | Rodou `dump_golden_specs.mjs` com branch diferente. Rode de novo. |
| `libSchemaVersion` em manifest > 2 | Schema novo do @ttoss/geovis. **Pare** e ressincronize agente via `geovis-spec-agent-creator`. |
| Um caso R-* falha | Gate de cobertura rejeita a variante. Fix e rerun, ou descarte a variante. |
| runtime-captured nunca é gravado | `pnpm dev` não está de pé ou `ANTHROPIC_AGENT_ID` está errado. Verificar env vars. |
| Comparação retorna eixos zeros | candidato tem erro (`httpStatus: 422`). Ver `response.error`. |

---

## 📖 Próximos Passos

- **Leia:** `SKILL.md` (workflow completo)
- **Entenda:** `references/spec-generation-pipeline.md` (arquitetura)
- **Rode:** Passo 1 a 5 conforme `SKILL.md`
- **Entregue:** Propostas em `runs/<runId>/proposed-*.diff`
