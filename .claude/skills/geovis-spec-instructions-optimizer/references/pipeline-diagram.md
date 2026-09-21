# Diagrama do Pipeline: Full-Evalued vs Runtime-Captured

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                  DUAS FONTES ORTOGONAIS DE VisualizationSpec                │
└─────────────────────────────────────────────────────────────────────────────┘


╔═════════════════════════════════════════════════════════════════════════════╗
║ 1. FULL-EVALUED SPECS (Golden Corpus — Gerado da Produção)                 ║
╚═════════════════════════════════════════════════════════════════════════════╝

    src/app/(features)/mapas/geovisSpec.ts#buildSpec()
                    ↓ (rodar de verdade com data live)
    src/app/(features)/mapas/specs/full-evalued/
    ├── coropletico.json              ← 23 arquivos
    ├── coropletico-idhm.json            (um por MapMode)
    ├── pontos.json
    ├── assentamentos.json
    └── manifest.json                 ← git SHA, geovis version, provenance
    
    Regenerado por: scripts/dump_golden_specs.mjs
    Comando: node --experimental-strip-types scripts/dump_golden_specs.mjs
    
    Características:
    • Nunca editado à mão
    • Determinístico (mesmo git SHA → mesmos specs)
    • Contém apenas estrutura de binding (não valores brutos)
    • 14 casos únicos semanticamente (9 clones com payload diferente)
    • Apenas 5 alcançáveis pelo agente (resto depende de datasets indisponíveis)


╔═════════════════════════════════════════════════════════════════════════════╗
║ 2. RUNTIME-CAPTURED SPECS (Output do Agente em Eval)                       ║
╚═════════════════════════════════════════════════════════════════════════════╝

    evals/evals.json (definição de casos)
    ├── prompt: "mapa coroplético do IDHM por município"
    ├── coverageRuleId: "R-choropleth-idhm"
    └── golden: "coropletico-idhm.json"           ← ref ao golden corpus
                    ↓
    scripts/run_eval_case.sh
                    ↓ (POST real ao endpoint)
    http://localhost:3000/api/ai/spec
    ├── Input: { prompt, system (agente), INSTRUCTIONS, catálogo dinâmico }
    └── Output: VisualizationSpec ou { error }
                    ↓
    runs/2026-09-18T14-03-11Z--poda-legend/evals/
    ├── coropletico-idhm/
    │   └── output.json                          ← runtime-captured
    │       ├── prompt
    │       ├── httpStatus: 200 (ou 422)
    │       ├── durationMs
    │       └── response: { spec JSON ou error }
    └── ...mais casos


╔═════════════════════════════════════════════════════════════════════════════╗
║ 3. CICLO DE VALIDAÇÃO: Como os Dois se Encontram                           ║
╚═════════════════════════════════════════════════════════════════════════════╝

    ┌─────────────────────────────────────────────────────────────────────────┐
    │ FASE 0: Setup Imutável                                                  │
    └─────────────────────────────────────────────────────────────────────────┘
    
    dump_golden_specs.mjs
            ↓
    full-evalued/ + manifest.json
    (snapshot do "o que é publicado" neste instante)


    ┌─────────────────────────────────────────────────────────────────────────┐
    │ FASE 1: Mapeamento de Redundância                                       │
    └─────────────────────────────────────────────────────────────────────────┘
    
    Lê:
    • full-evalued/ (23 specs de produção)
    • INSTRUCTIONS (src/app/api/ai/spec/instructions.ts)
    • Agent system prompt (~/.claude/agents/geovis-spec-generator.md)
    
    Produz:
    • references/determinism-map.md
      (tabela: regra-de-prompt → validador que já a cobre)
    
    Classifica cada regra:
    • Podável: 100% coberta por um findX
    • Essencial: semântica ou catalog lookup (não pode remover)


    ┌─────────────────────────────────────────────────────────────────────────┐
    │ FASE 2: Desenho de Dataset de Eval                                      │
    └─────────────────────────────────────────────────────────────────────────┘
    
    Para cada golden alcançável:
    
        full-evalued/coropletico-cafs-percentual.json
        ├── delta: cozinhas-por-municipio @ /geo/geojs-100-mun [polygon] quantitative
        └── prompt escrito a partir do delta (nunca do arquivo)
            "mapa coroplético do percentual de estabelecimentos com CAF..."
    
    Para cada R-* regra em determinism-map.md:
    
        Desenha um prompt que a exercita especificamente
        (gate de cobertura obrigatório)
    
    Resultado:
    
    evals/evals.json
    ├── { prompt, coverageRuleId: "R-choropleth-geometry", expectedStatus: 200 }
    ├── { prompt, golden: "coropletico-idhm.json", expectedStatus: 200 }
    └── { prompt: "dados-inexistentes", expectedStatus: 422 }


    ┌─────────────────────────────────────────────────────────────────────────┐
    │ FASE 3: Captura de Runtime                                              │
    └─────────────────────────────────────────────────────────────────────────┘
    
    Para cada variante (seja agente, seja INSTRUCTIONS):
    
        provision_test_agent.sh update <variant>
        ├── Reescreve system prompt no agente único
        └── version incrementa (prevent overwrite)
        
        pnpm dev (com ANTHROPIC_AGENT_ID = test agent)
        
        Para cada caso em evals/evals.json:
        
            run_eval_case.sh "<prompt>" "runs/$RUNID/evals/$CASE/output.json"
            ├── curl POST /api/ai/spec
            ├── Timing (httpStatus, durationMs)
            └── Grava output.json (runtime-captured)


    ┌─────────────────────────────────────────────────────────────────────────┐
    │ FASE 4: Comparação e Pontuação                                          │
    └─────────────────────────────────────────────────────────────────────────┘
    
    Para cada runtime-captured com golden:
    
        full-evalued/coropletico-cafs-percentual.json  (golden)
                    ↓
        scripts/project_spec.mjs extract-delta
                    ↓
        { geometry, form, legendScale, dataset }      (delta estrutural)
                    ↓
        runtime-captured/output.json
                    ↓
        scripts/project_spec.mjs compare <delta> <candidato>
                    ↓
        Scores (0..1) por eixo:
        • geometry ✓/✗
        • form ✓/✗
        • legendScale ✓/✗
        • dataset → agente semântico (grader.md)
    
    Para cada runtime-captured com coverageRuleId:
    
        scripts/score_case.mjs <output.json>
                    ↓
        Gate de cobertura:
        • Passou? (100% de casos R-* devem passar)
        • Falhou? (variante descartada, nunca vai pra comparação)


╔═════════════════════════════════════════════════════════════════════════════╗
║ 4. Estrutura de Arquivos na Skill                                          ║
╚═════════════════════════════════════════════════════════════════════════════╝

    ~/.claude/skills/geovis-spec-instructions-optimizer/
    │
    ├── SKILL.md                                (instruções executáveis)
    │
    ├── references/
    │   ├── spec-generation-pipeline.md  ← MAPA CENTRAL (este doc em prosa)
    │   ├── sources.md                   (onde vivem as fontes)
    │   ├── determinism-map.md           (regra → validador)
    │   └── golden-specs.md              (como comparar)
    │
    ├── scripts/
    │   ├── dump_golden_specs.mjs        → full-evalued/
    │   ├── run_eval_case.sh             → runtime-captured
    │   ├── project_spec.mjs             (comparação: extract-delta, compare)
    │   ├── score_case.mjs               (pontuação programática)
    │   └── provision_test_agent.sh      (agente de teste)
    │
    └── runs/
        ├── 2026-09-18T14-03-11Z--poda-legend/
        │   ├── evals/evals.json
        │   ├── evals/caso-1/output.json  ← runtime-captured
        │   ├── versions.json             (manifesto)
        │   └── ...
        └── latest → 2026-09-18T14-03-11Z--poda-legend/ (symlink)


╔═════════════════════════════════════════════════════════════════════════════╗
║ 5. Fluxo de Decisão                                                         ║
╚═════════════════════════════════════════════════════════════════════════════╝

    Pergunta                              Resposta          Fonte
    ────────────────────────────────────  ────────────────  ────────────────
    "Qual spec o app publica?"             full-evalued/    Produção real
    
    "Instrução nova cobre todas as        Scores: passa/    Gate de
     regras prometidas?"                   falha por R-*     cobertura
    
    "Instrução nova gera mapas que        Scores: geometry  Comparação vs
     importam?"                            form legendScale  full-evalued delta
    
    "Uma regra é redundante?"              ID em            determinism-map.md
                                          determinism-map
    
    "Há quantos casos de eval?"            14 únicos de     Contagem de
                                          23 arquivos       deltas distintos
```

---

## Chave

- **Full-Evalued:** Sempre o "agora"; regenerado cada campanha; nunca editado à mão; fonte de verdade de produção.
- **Runtime-Captured:** Imutável uma vez gravado; resultado de um prompt específico; efêmero (parte de uma rodada) mas rastreável (runId).
- **Golden corpus:** Subset de full-evalued que o agente consegue alcançar (~5 dos 23).
- **Delta:** A estrutura comparável de um spec, não as linhas de dados (agent nunca emite dados).
- **Gate de cobertura:** Binário — se 1 caso R-* falha, variante é descartada antes de qualquer pontuação.
