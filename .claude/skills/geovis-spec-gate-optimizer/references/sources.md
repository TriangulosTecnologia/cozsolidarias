# Instruction sources and variant provisioning

## Where each source lives

| Source | Path | Nature | How it changes |
|---|---|---|---|
| Agent system prompt | `~/geovis-spec-generator.md`| Generic to the `@ttoss/geovis` schema. No notion of cozsolidarias. | Re-provisioned out of band via the `ant` CLI. No CI, no PR review. |
| `INSTRUCTIONS` | `src/app/api/ai/spec/instructions.ts` | cozsolidarias domain: catalogue, sources, mapData, legends, basemap. | Merged into the repo, under quality gates (`pnpm typecheck`/`eslint`/`test`). |
| Catalogue | `buildCatalogueContext()` (`mapDataCatalogue.ts`) | Dynamic, derived from `gateway.getCatalogue()` on each process. | Not prunable instruction — it is data, always sent. |
| Sources table | `buildSourcesTable()` (`specValidation.helpers.ts`) | Mostly static Markdown plus rows generated from `KNOWN_SOURCE_URLS`/`SOURCE_METADATA`. | Follows `INSTRUCTIONS`. |

Never merge these two sources into a single prompt — see the rationale in `SKILL.md`.

## Limits of each one

- The agent's system prompt **must not** contain cozsolidarias business rules (catalogue, real dataset
  ids, real source URLs) — that would break the agent for any other app that reused it (it is generic to
  `@ttoss/geovis`).
- `INSTRUCTIONS` **must not** duplicate generic schema documentation (`VisualizationSpec` fields,
  `$defs`) — that already lives in the agent's system prompt; duplicating it is token spend with no gain.
- Neither should restate in prose a rule that `specValidation.ts` already guarantees in code — see
  `determinism-map.md`.

## Step by step — `ant` CLI (semi-manual procedure, single test agent)

There is no documented example of using the `ant` CLI anywhere in the repo — `route.ts` only comments that
the agent is "provisioned out of band via `ant` CLI". Treat the commands below as a starting point to
confirm with `ant beta:agents --help` before the first real use in a new campaign (the CLI may have
changed its name/flags since the last time).

Unlike creating one agent per variant, this skill uses **a single dedicated test agent** per optimization
campaign, whose `system` is rewritten per variant via `update`. Only variants on the **generic agent**
side (`~/geovis-spec-generator.md`) go through this cycle — variants on the `INSTRUCTIONS` side
(`instructions.ts`) are just a local edit of the constant, with no `ant` call at all, because
`INSTRUCTIONS` is sent per request and is not part of the agent's system prompt.

0. **Two distinct auth surfaces, do not confuse them**: `ant beta:agents create/update` authenticates
   via `ant auth` (a profile already logged in on the machine — check `ant auth status` before the first
   `create`; if not logged in, instruct `ant auth login`, never invent/ask for a new credential). This is
   separate from the `ANTHROPIC_API_KEY` in the project's `.env`, which is used only at runtime by
   `route.ts`/`anthropicSession.ts` (`x-api-key` header on the direct fetch to
   `https://api.anthropic.com/v1/sessions`).

1. **Never** reuse `ANTHROPIC_AGENT_ID` from production (read from `.env`/process env vars of Next).

2. Create the test agent, once per campaign (`scripts/provision_test_agent.sh create`):

   ```bash
   ant beta:agents create \
     --name "geovis-spec-generator-test" \
     --model claude-sonnet-5 \
     --system "$(cat baseline-system-prompt.md)" \
     --tool read --tool glob --tool grep
   ```

   Tools mirror the production `~/.claude/agents/geovis-spec-generator.agent.yaml`: read/glob/grep
   enabled, bash/write/edit disabled. The absence of write tools is the real mechanism that prevents the
   agent from writing a file — do not rely only on textual instruction.

3. Save the result in `variants/test-agent.json` (format produced by the script):

   ```json
   {
     "agentId": "<id returned>",
     "environmentId": "<reuse the production one, unless the user asks for isolation>",
     "version": 1,
     "createdAt": "<ISO timestamp>",
     "lastVariant": "baseline",
     "lastUpdatedAt": "<ISO timestamp>"
   }
   ```

   The production `environmentId` may be reused — it carries the execution environment, not the prompt.
   Ask the user whether they prefer to isolate via `ant beta:environments create` as well.

4. For each variant tested, update the `system` of the same agent
   (`scripts/provision_test_agent.sh update <slug> <system-prompt-file> variants/test-agent.json`):

   ```bash
   ant beta:agents update \
     --agent-id <test-agent-id> \
     --system "$(cat variant-N-system-prompt.md)" \
     --version <current-version>
   ```

   `--version` prevents concurrent overwrite. The script increments the local `version` after each
   successful update. **Always serialize**: run all eval cases of the current variant before the next
   `update` — the same agent is rewritten, so evals of different variants cannot coexist.

5. Run the local dev server pointing to the test agent (never edit production `.env` in place).
   Default: **reuse `ANTHROPIC_API_KEY` and `ANTHROPIC_ENVIRONMENT_ID` from the local `.env` as they are** —
   never copy/duplicate the key anywhere else, never ask the user for a new key. The only value that
   changes per campaign is `ANTHROPIC_AGENT_ID`. Create a `.env.local` (Next.js already gives it
   precedence over `.env`) containing only:

   ```
   ANTHROPIC_AGENT_ID=<test-agent-id>
   ```

   Delete this test `.env.local` at the end of the campaign. Only ask the user for an isolated
   `ANTHROPIC_ENVIRONMENT_ID` if they explicitly request it — do not ask by default at every campaign.

6. At the end of the campaign, ask the user whether to archive the test agent
   (`scripts/provision_test_agent.sh archive variants/test-agent.json`) or keep it for the next campaign —
   reuse is acceptable, it is a single named and traceable agent.

7. **Mandatory confirmation**: stop before the first `ant beta:agents create` of each campaign and ask for
   explicit confirmation from the user — it is a real API/infra cost outside the repo, under the real
   Anthropic account, not a locally reversible action.
