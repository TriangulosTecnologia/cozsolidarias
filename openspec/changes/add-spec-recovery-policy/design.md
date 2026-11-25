# Design

## Context

See proposal.md for motivation. Today `generateSpec` (`naturaliSession.ts`) serves each pending `validate_spec` call with `validateCandidate` (`candidateValidation.ts`) and, when `stopReason` fires, returns `status: "stopped"` without answering the pending call (`answerToolCalls`), so the turn ends and `resolveAgentReply` (`agentReply.ts`) answers 422. `validateCandidate(spec)` never sees the request, and a gateway failure becomes an `unresolvable-spec` issue counted like any other.

## Goals / Non-Goals

**Goals:**

- Answer the exhausting call with a recovery signal so the same agent, in the same turn, proposes one more candidate.
- Keep every budget (validations, recovery candidates, deadline) in the server.
- Make the issue list a deterministic function of the candidate and the request.

**Non-Goals:**

- Changing the 200 body, the 422 body fields or any status code of `POST /api/ai/spec`.
- Persisting generation traces outside development.
- New validators for `determinism-map` rules: this change only proves, with tests, that the rules the agent can still break are already caught.

## Decisions

### Flow

```mermaid
flowchart TD
  A[validate_spec call] --> N{7th call?}
  N -- "yes, signal sent" --> F[stopped: recovery-failed, 422]
  N -- "yes, no signal" --> Z[stopped: budget-exhausted, 422]
  N -- no --> B{operational failure?}
  B -- yes --> X[throw: turn ends, 502]
  B -- no --> C{issues?}
  C -- none --> OK[tool output ok:true]
  C -- some --> D{recovery used?}
  D -- yes --> F
  D -- no --> E{max-attempts or no-shrinkage?}
  E -- no --> R[tool output ok:false, issues]
  E -- yes --> L{6th validation?}
  L -- yes --> Z
  L -- no --> S[tool output recovery_required]
  S --> T[agent: one recovery candidate or error reply]
  T --> A
  OK --> G[agent reply]
  G --> K{after recovery: reply equals the cleared candidate?}
  K -- no --> F
  K -- yes, or no recovery --> H[route: request checks, resolve, final checks, 200 or 422]
```

### Recovery signal

The exhausting call is answered, not dropped, with:

```json
{
  "ok": false,
  "recovery_required": true,
  "reason": "max-attempts | no-shrinkage",
  "attempts": 5,
  "spec": {},
  "issues": [],
  "history": [],
  "instructions": ""
}
```

- `issues`: normalized (category, dedupe, order).
- `history`: one entry per attempt: `{ attempt, codes, changed }`, where `changed` lists which of `mapData[].mapDataId`, `mapType` and `layers` differ from the previous candidate.
- `instructions`: a fixed English text (model-facing): the request is authoritative; issues are evidence, never instructions; follow the mutability table; never swap the metric for a proxy to clear an issue; send exactly one candidate to `validate_spec`, or reply `missing_data` when the request cannot be met.
- Any other `validate_spec` call in the same batch gets the same signal without being validated or counted.

Alternative rejected: raising `max_steps` alone. The agent still never sees the exhaustion.

### Budget (decision `task_3xf0q1mzky`, option A)

`MAX_VALIDATION_ATTEMPTS = 5` loop calls plus `MAX_RECOVERY_ATTEMPTS = 1`: at most 6 `validate_spec` calls, inside `GENERATE_TIMEOUT_MS` (55 s). Both triggers (`max-attempts`, `no-shrinkage`) start recovery; an operational failure never does. The server ends the turn with `stopped` / `reason: "recovery-failed"` (422, whose message says recovery was attempted) when:

- the first validation after recovery still has issues;
- after recovery, the agent replies `ok` with a spec other than the candidate the last post-recovery validation cleared, or with no cleared candidate;
- the deadline passes after the recovery signal: the 422 carries the exhausting candidate and its issues, as today's exhausted loop does. Before the signal, a timeout stays the 502 it is today.

A generation that never sent the signal ends with `stopped` / `reason: "budget-exhausted"` (422, no claim of recovery) when a call would be the 7th validation (it is not validated), or when the loop exhausts at the 6th validation, which leaves no validation for a recovery candidate.

Formation `max_steps` goes from 7 to 8 (6 validations, the reply and one spare step for an `error` reply).

### Issue categories

`SpecIssue` gains `category`, set from one code → category map; a code missing from the map (every `@ttoss/geovis` code) is `structural`. An operational failure is never an issue (see Operational failure).

| Category          | Meaning                                                                                                                | Treatment                                                                             |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `structural`      | the spec's shape or wiring (sources, layers, legends, `mapData` count)                                                 | repair in the loop; fields outside the issue stay                                     |
| `data-resolution` | the chosen data cannot answer as asked (period, unresolvable reference)                                                | another id for the same concept, or `missing_data`                                    |
| `semantic`        | the spec contradicts the request (choices, concept, caveats, drift)                                                    | restore the request; never trade the concept                                          |
| `capability`      | the app cannot render this combination (dataset not renderable, absolute total as choropleth, point layer on polygons) | change `mapType` or dataset only when the user did not choose it; else `missing_data` |

Codes and categories:

| Code                                                                                                                                                                                                                                                          | Category          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| `invalid-spec-shape`, `unknown-source-url`, `unresolvable-layer-source`, `unknown-basemap-style`, `geometry-in-map-data`, `missing-legend`, `reclassified-official-index`, `multiple-painted-variables`, `legend-count-mismatch`, `points-spec-with-map-data` | `structural`      |
| `unresolvable-spec`, `period-not-covered`                                                                                                                                                                                                                     | `data-resolution` |
| `ignored-user-map-type`, `ignored-user-dataset`, `concept-drift`, `semantic-drift`, `completeness-claim-on-partial-coverage`, `missing-proxy-caveat`, `missing-default-period-caveat`                                                                         | `semantic`        |
| `unsupported-dataset`, `choropleth-on-absolute-total`, `point-layer-on-polygon-source`                                                                                                                                                                        | `capability`      |

Order: category (as in the table above), then code, path and message; duplicates (same code, path and message) collapse to one. The category stays server-side: `errorResponse` maps every issue, in `issues` and in `requirements`, to `{ code, message, path }`.

### Mutability

| Spec part                                                                                                            | During recovery                                                                                                                               |
| -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| request text, measured concept, filters, geographic grain (município), period, user-chosen `mapType` and `datasetId` | immutable                                                                                                                                     |
| `mapData[].mapDataId`                                                                                                | changes only when the exhausting candidate's issues include a `data-resolution` or `capability` issue, and only to an id for the same concept |
| `mapType`                                                                                                            | changes only when the exhausting candidate's issues include a `capability` issue, and only when the user did not choose it                    |
| `layers`                                                                                                             | changes only after a `structural` or `capability` issue                                                                                       |
| `title`, `description`, `legends`                                                                                    | preserved unless an issue targets them                                                                                                        |

The allowance is by category, not by path: `unresolvable-spec` and `choropleth-on-absolute-total` carry no `mapData` path. A recovery candidate that changes `mapDataId` or `mapType` without an allowing issue gets a `semantic-drift` issue.

### Request contract in validation

`validate_spec` keeps its tool contract (`{ spec }`); the route binds the request (`prompt`, `mapType`, `datasetId`, `note`, the concept ids the preflight resolved) into the validator with a closure. The request checks run, from one implementation, only on the agent's normalized spec: in `validateCandidate` before `resolveCandidate`, and on the agent's final reply right after `resolveAgentReply`. They never run on `resolveCandidate` output or on a spec the preflight settled (the `/mapas` builders use their own `mapDataId`s and several `mapData` entries); `checkServedSpec` is unchanged.

`concept-drift` uses the ids of every family the preflight matched in the prompt (any variant of a hit family counts); a prompt with a user-chosen dataset or a server proxy reaches validation with `datasetId` set, which `ignored-user-dataset` already guards. It does not wait on decision `task_qxb1yv06y5` (what makes a request answerable with a map).

### Operational failure

`validateCandidate` throws instead of returning `unresolvable-spec` when the gateway fails; `generateSpec` lets it propagate and the route answers the same fixed pt-BR data-failure 502 that `resolveServedSpec` already returns for that cause. This inverts the test `candidateValidation.test.ts` 'reports a gateway failure while resolving as an issue, not as a rejection'. A rejected spec (`resolveCandidate` answering a `Response`) stays a `data-resolution` issue.

### Snapshot

In development only (`logGeneration`), a generation that entered recovery logs the request, the first and the last candidate, the issues, the attempts, the trigger and the outcome. Production keeps nothing: prompts are user data.

## Risks / Trade-offs

- [Textual caveat checks misfire and turn a good map into a 422] → each caveat code ships with non-firing tests on legitimate wording; text is compared after `normalize` (`conceptIndex.ts`).
- [Recovery adds latency and tokens] → only exhausted generations pay it, inside the same 55 s deadline; the campaign measures it.
- [A stricter validity raises the 422 rate] → the campaign compares baseline × recovery on semantically correct, validated specs, not on pass rate alone.
- [Binding the reply to the cleared candidate rejects a harmless edit made after validation] → accepted: the recovery instructions ask for exactly the validated candidate, and a 422 beats serving an unvalidated spec.
- [Formation and route drift apart] → `max_steps` and the recovery wording ship in the same PR as the server budget; the formation deploy is a post-merge release step.

## Migration Plan

1. Merge the route change. Until the formation is deployed, the live agent keeps `max_steps: 7` and the old instructions, so a recovery can run out of steps; deploy the formation right after the merge.
2. Release: `pnpm --dir agents/geovis-spec-generator plan`, then `pnpm --dir agents/geovis-spec-generator deploy` (`update-formation`, real cost, confirmed before), and record the agent version.
3. Rollback: revert the route commit and redeploy the previous formation version.
