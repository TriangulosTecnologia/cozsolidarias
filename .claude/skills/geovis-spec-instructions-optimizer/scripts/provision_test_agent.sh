#!/usr/bin/env bash
# Provisiona um único agente Managed Agents de teste dedicado (criado uma vez por campanha) e
# atualiza seu system prompt por variante via `ant beta:agents update`. Nunca toca no
# ANTHROPIC_AGENT_ID de produção. Variantes rodam sequencialmente — o mesmo agente é reescrito a
# cada rodada, então dois evals de variantes diferentes não podem rodar em paralelo.
#
# Uso:
#   provision_test_agent.sh create <system-prompt-file> <state-file>
#   provision_test_agent.sh update <variant-slug> <system-prompt-file> <state-file>
#   provision_test_agent.sh archive <state-file>

set -euo pipefail

ACTION="${1:?uso: provision_test_agent.sh <create|update|archive> ...}"

case "$ACTION" in
  create)
    SYSTEM_PROMPT_FILE="${2:?arquivo de system prompt obrigatório}"
    STATE_FILE="${3:?state-file obrigatório}"

    if [[ -f "$STATE_FILE" ]]; then
      echo "erro: já existe um agente de teste registrado em $STATE_FILE — use 'update', ou remova o state file pra criar outro." >&2
      exit 1
    fi
    if [[ ! -f "$SYSTEM_PROMPT_FILE" ]]; then
      echo "erro: system prompt file não encontrado: $SYSTEM_PROMPT_FILE" >&2
      exit 1
    fi

    echo "Criando agente de teste dedicado: geovis-spec-generator-test" >&2
    echo "Confirme com o usuário antes de rodar este comando de verdade — custo real de API." >&2

    RESULT_JSON="$(ant beta:agents create \
      --name "geovis-spec-generator-test" \
      --model claude-sonnet-5 \
      --system "$(cat "$SYSTEM_PROMPT_FILE")" \
      --tool read --tool glob --tool grep \
      --output json)"

    mkdir -p "$(dirname "$STATE_FILE")"
    node -e '
      const fs = require("fs");
      const result = JSON.parse(process.argv[1]);
      const record = {
        agentId: result.id ?? result.agentId,
        environmentId: process.env.ANTHROPIC_ENVIRONMENT_ID ?? null,
        version: result.version ?? 1,
        createdAt: new Date().toISOString(),
        lastVariant: "baseline",
        lastUpdatedAt: new Date().toISOString(),
      };
      fs.writeFileSync(process.argv[2], JSON.stringify(record, null, 2));
    ' "$RESULT_JSON" "$STATE_FILE"

    echo "Gravado em ${STATE_FILE}" >&2
    ;;

  update)
    SLUG="${2:?variant-slug obrigatório}"
    SYSTEM_PROMPT_FILE="${3:?arquivo de system prompt obrigatório}"
    STATE_FILE="${4:?state-file obrigatório}"

    if [[ ! -f "$STATE_FILE" ]]; then
      echo "erro: nenhum agente de teste registrado — rode 'create' primeiro." >&2
      exit 1
    fi
    if [[ ! -f "$SYSTEM_PROMPT_FILE" ]]; then
      echo "erro: system prompt file não encontrado: $SYSTEM_PROMPT_FILE" >&2
      exit 1
    fi

    AGENT_ID="$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).agentId)' "$STATE_FILE")"
    CURRENT_VERSION="$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).version)' "$STATE_FILE")"

    echo "Atualizando agente de teste ${AGENT_ID} pra variante '${SLUG}' (version atual: ${CURRENT_VERSION})" >&2

    RESULT_JSON="$(ant beta:agents update \
      --agent-id "$AGENT_ID" \
      --system "$(cat "$SYSTEM_PROMPT_FILE")" \
      --version "$CURRENT_VERSION" \
      --output json)"

    node -e '
      const fs = require("fs");
      const state = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
      const result = JSON.parse(process.argv[2]);
      state.version = result.version ?? (state.version + 1);
      state.lastVariant = process.argv[3];
      state.lastUpdatedAt = new Date().toISOString();
      fs.writeFileSync(process.argv[1], JSON.stringify(state, null, 2));
    ' "$STATE_FILE" "$RESULT_JSON" "$SLUG"

    echo "Atualizado. Rode os eval cases da variante '${SLUG}' agora, antes do próximo update." >&2
    ;;

  archive)
    STATE_FILE="${2:?state-file obrigatório}"

    if [[ ! -f "$STATE_FILE" ]]; then
      echo "erro: nenhum agente de teste registrado em $STATE_FILE" >&2
      exit 1
    fi

    AGENT_ID="$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).agentId)' "$STATE_FILE")"

    echo "Arquivando agente de teste: ${AGENT_ID}" >&2
    ant beta:agents archive --agent-id "$AGENT_ID"
    ;;

  *)
    echo "ação desconhecida: $ACTION (esperado: create|update|archive)" >&2
    exit 1
    ;;
esac
