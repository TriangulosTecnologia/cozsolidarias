# Fontes de instrução e provisionamento de variante

## Onde cada fonte vive

| Fonte | Caminho | Natureza | Como muda |
|---|---|---|---|
| System prompt do agente | `~/geovis-spec-generator.md`| Genérico ao schema `@ttoss/geovis`. Sem noção de cozsolidarias. | Reprovisionado fora de banda via `ant` CLI. Sem CI, sem review de PR. |
| `INSTRUCTIONS` | `src/app/api/ai/spec/instructions.ts` | Domínio cozsolidarias: catálogo, sources, mapData, legendas, basemap. | Merge no repo, sob quality gates (`pnpm typecheck`/`eslint`/`test`). |
| Catálogo | `buildCatalogueContext()` (`mapDataCatalogue.ts`) | Dinâmico, derivado de `gateway.getCatalogue()` a cada processo. | Não é instrução podável — é dado, sempre enviado. |
| Tabela de sources | `buildSourcesTable()` (`specValidation.helpers.ts`) | Markdown majoritariamente estático + linhas geradas de `KNOWN_SOURCE_URLS`/`SOURCE_METADATA`. | Acompanha `INSTRUCTIONS`. |

Nunca funda essas duas fontes num prompt único — ver justificativa no `SKILL.md`.

## Limites de cada uma

- O system prompt do agente **não pode** conter regra de negócio cozsolidarias (catálogo, ids de
  dataset reais, URLs de source reais) — isso quebraria o agente pra qualquer outro app que o
  reusasse (é genérico ao `@ttoss/geovis`).
- `INSTRUCTIONS` **não pode** duplicar doc de schema genérico (campos do `VisualizationSpec`,
  `$defs`) — isso já vive no system prompt do agente; duplicar é gasto de token sem ganho.
- Nenhuma das duas deve reimplementar em prosa uma regra que `specValidation.ts` já garante em
  código — ver `determinism-map.md`.

## Passo a passo — CLI `ant` (procedimento semi-manual, agente de teste único)

Não há exemplo de uso da `ant` CLI documentado em nenhum lugar do repo — `route.ts` só comenta que
o agente é "provisionado fora de banda via `ant` CLI". Trate os comandos abaixo como ponto de
partida a confirmar com `ant beta:agents --help` antes do primeiro uso real numa campanha nova (a
CLI pode ter mudado de nome/flags desde a última vez).

Diferente de criar um agente por variante: esta skill usa **um único agente de teste dedicado**
por campanha de otimização, cujo `system` é reescrito por variante via `update`. Só as variantes
do lado **agente genérico** (`~/geovis-spec-generator.md`) passam por esse ciclo — variantes do
lado `INSTRUCTIONS` (`instructions.ts`) são só edição local da constante, sem chamada `ant` nenhuma,
porque `INSTRUCTIONS` é enviada por request, não faz parte do system prompt do agente.

0. **Dois surfaces de auth distintos, não confundir**: a `ant beta:agents create/update` autentica
   via `ant auth` (perfil já logado na máquina — checar `ant auth status` antes do primeiro
   `create`; se não estiver logado, instruir `ant auth login`, nunca inventar/pedir uma credencial
   nova). Isso é separado da `ANTHROPIC_API_KEY` do `.env` do projeto, que é usada só em runtime
   por `route.ts`/`anthropicSession.ts` (header `x-api-key` no fetch direto a
   `https://api.anthropic.com/v1/sessions`).

1. **Nunca** reusar `ANTHROPIC_AGENT_ID` de produção (lido de `.env`/env vars do processo Next).

2. Criar o agente de teste, uma vez por campanha (`scripts/provision_test_agent.sh create`):

   ```bash
   ant beta:agents create \
     --name "geovis-spec-generator-test" \
     --model claude-sonnet-5 \
     --system "$(cat baseline-system-prompt.md)" \
     --tool read --tool glob --tool grep
   ```

   Tools espelham `~/.claude/agents/geovis-spec-generator.agent.yaml` de produção: read/glob/grep
   habilitados, bash/write/edit desabilitados. A ausência de tools de escrita é o mecanismo real
   que impede o agente de gravar arquivo — não confiar só em instrução textual.

3. Gravar o resultado em `variants/test-agent.json` (formato produzido pelo script):

   ```json
   {
     "agentId": "<id retornado>",
     "environmentId": "<reaproveitar o de produção, a menos que o usuário peça isolamento>",
     "version": 1,
     "createdAt": "<ISO timestamp>",
     "lastVariant": "baseline",
     "lastUpdatedAt": "<ISO timestamp>"
   }
   ```

   `environmentId` de produção pode ser reaproveitado — carrega o ambiente de execução, não o
   prompt. Perguntar ao usuário se prefere isolar via `ant beta:environments create` também.

4. Por variante testada, atualizar o `system` do mesmo agente
   (`scripts/provision_test_agent.sh update <slug> <system-prompt-file> variants/test-agent.json`):

   ```bash
   ant beta:agents update \
     --agent-id <test-agent-id> \
     --system "$(cat variant-N-system-prompt.md)" \
     --version <version-atual>
   ```

   `--version` evita overwrite concorrente. O script incrementa a `version` local a cada update
   bem-sucedido. **Serialize sempre**: rode todos os eval cases da variante atual antes do próximo
   `update` — o mesmo agente é reescrito, então dois evals de variantes diferentes não podem
   coexistir.

5. Rodar o dev server local apontando pro agente de teste (nunca editar `.env` de produção
   in-place). Padrão: **reaproveitar `ANTHROPIC_API_KEY` e `ANTHROPIC_ENVIRONMENT_ID` do `.env`
   local tal como estão** — nunca copiar/duplicar a key em outro lugar, nunca pedir ao usuário uma
   chave nova. O único valor que muda por campanha é `ANTHROPIC_AGENT_ID`. Criar um `.env.local`
   (Next.js já dá precedência sobre `.env`) contendo só:

   ```
   ANTHROPIC_AGENT_ID=<test-agent-id>
   ```

   Apagar esse `.env.local` de teste ao final da campanha. Só perguntar ao usuário por um
   `ANTHROPIC_ENVIRONMENT_ID` isolado se ele explicitamente pedir — não perguntar por padrão a
   cada campanha.

6. Ao fim da campanha, perguntar ao usuário se arquiva o agente de teste
   (`scripts/provision_test_agent.sh archive variants/test-agent.json`) ou mantém pra próxima
   campanha — reuso é aceitável, é um único agente nomeado e rastreável.

7. **Confirmação obrigatória**: pare antes do primeiro `ant beta:agents create` de cada campanha e
   peça confirmação explícita do usuário — é custo real de API/infra fora do repo, sob a conta
   Anthropic real, não uma ação reversível localmente.
