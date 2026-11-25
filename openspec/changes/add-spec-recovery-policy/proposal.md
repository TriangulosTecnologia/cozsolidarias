# Proposal

## Why

When the `validate_spec` loop of `POST /api/ai/spec` gives up (`max-attempts` or `no-shrinkage`), the route answers 422 without telling the agent, which never sees the exhaustion. Retrying with "last spec + issues" only nudges the model into superficial repairs that zero an issue count, and today a spec counts as valid when it is structurally sound even if it ignores the user's choices, paints a year the dataset does not cover, or drops the caveats the instructions demand.

## What Changes

- The agent gets **one** in-turn recovery chance after the loop exhausts, under a server-enforced budget (at most 6 `validate_spec` calls per generation, inside the existing 55 s deadline), with the request treated as immutable.
- Validation issues carry a category, are deduplicated and come in a stable order; a gateway failure while validating ends the generation as an upstream failure (502) instead of reaching the model as a repairable issue.
- "Valid spec" widens from structural checks to also cover the request contract (user choices, period, one painted variable, legends per variable, points/heatmap shape, concept drift) and the required caveats (completeness claims, proxy, default period).
- A new check that fails is a `validate_spec` issue; if it remains on the final spec, the route answers 422. Status codes and body fields of the public contract do not change.

Out of scope: a separate recovery agent, seed or sampling settings as a determinism tool, logging prompts outside development.

## Capabilities

### New Capabilities

- `spec-recovery`: what happens after the `validate_spec` loop exhausts — trigger, server budget, single candidate, semantic invariance, terminal outcomes and the development snapshot.
- `spec-validity`: what makes a generated spec valid — structural, request-contract and caveat checks, issue categories and ordering, and how a failing check surfaces.

### Modified Capabilities

None.

## Impact

- `src/app/api/ai/spec/` (validation, session loop, reply resolution, route wiring) and its unit tests.
- `agents/geovis-spec-generator/` formation (`instructions`, `max_steps` 7 → 8) and `src/app/api/ai/spec/instructions/`, the two sources of one prompt; deploying the formation has a real Naturali cost.
- `.claude/skills/geovis-spec-gate-optimizer` (eval cases, `determinism-map.md`, recovery metrics, campaign).
- Latency and tokens grow only on generations that exhaust the loop.
