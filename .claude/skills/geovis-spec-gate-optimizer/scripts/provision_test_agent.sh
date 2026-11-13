#!/usr/bin/env bash
# DEPRECATED: Anthropic Managed Agents transport (skill 1.x). Skill 3.0.0 uses the Naturali agent.
# Do not run. To provision, follow Step 2 of SKILL.md (`naturali` CLI, local formation file).
#
# Provisions a single dedicated test Managed Agents agent (created once per campaign) and
# updates its system prompt per variant via `ant beta:agents update`. Never touches the
# production ANTHROPIC_AGENT_ID. Variants run sequentially — the same agent is rewritten on
# each round, so two evals of different variants cannot run in parallel.
#
# Usage:
#   provision_test_agent.sh create <system-prompt-file> <state-file>
#   provision_test_agent.sh update <variant-slug> <system-prompt-file> <state-file>
#   provision_test_agent.sh archive <state-file>

set -euo pipefail

ACTION="${1:?usage: provision_test_agent.sh <create|update|archive> ...}"

case "$ACTION" in
  create)
    SYSTEM_PROMPT_FILE="${2:?system prompt file required}"
    STATE_FILE="${3:?state-file required}"

    if [[ -f "$STATE_FILE" ]]; then
      echo "error: a test agent is already registered in $STATE_FILE — use 'update', or remove the state file to create another." >&2
      exit 1
    fi
    if [[ ! -f "$SYSTEM_PROMPT_FILE" ]]; then
      echo "error: system prompt file not found: $SYSTEM_PROMPT_FILE" >&2
      exit 1
    fi

    echo "Creating dedicated test agent: geovis-spec-generator-test" >&2
    echo "Confirm with the user before actually running this command — real API cost." >&2

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

    echo "Written to ${STATE_FILE}" >&2
    ;;

  update)
    SLUG="${2:?variant-slug required}"
    SYSTEM_PROMPT_FILE="${3:?system prompt file required}"
    STATE_FILE="${4:?state-file required}"

    if [[ ! -f "$STATE_FILE" ]]; then
      echo "error: no test agent registered — run 'create' first." >&2
      exit 1
    fi
    if [[ ! -f "$SYSTEM_PROMPT_FILE" ]]; then
      echo "error: system prompt file not found: $SYSTEM_PROMPT_FILE" >&2
      exit 1
    fi

    AGENT_ID="$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).agentId)' "$STATE_FILE")"
    CURRENT_VERSION="$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).version)' "$STATE_FILE")"

    echo "Updating test agent ${AGENT_ID} to variant '${SLUG}' (current version: ${CURRENT_VERSION})" >&2

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

    echo "Updated. Run the eval cases of variant '${SLUG}' now, before the next update." >&2
    ;;

  archive)
    STATE_FILE="${2:?state-file required}"

    if [[ ! -f "$STATE_FILE" ]]; then
      echo "error: no test agent registered in $STATE_FILE" >&2
      exit 1
    fi

    AGENT_ID="$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).agentId)' "$STATE_FILE")"

    echo "Archiving test agent: ${AGENT_ID}" >&2
    ant beta:agents archive --agent-id "$AGENT_ID"
    ;;

  *)
    echo "unknown action: $ACTION (expected: create|update|archive)" >&2
    exit 1
    ;;
esac
