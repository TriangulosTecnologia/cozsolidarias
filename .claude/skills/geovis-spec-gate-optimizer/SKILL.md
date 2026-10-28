---
name: geovis-spec-gate-optimizer
version: 3.1.0
description: |
  Measures the cozsolidarias VisualizationSpec generator with blocking gates and real evals against
  `POST /api/ai/spec`. Uses reviewed structural goldens (env var `GEOVIS_GOLDEN_DIR`, default
  `tmp/specs/full/verifield`) and semantic goldens (`references/goldens/semantic/`), and consolidates
  the two instruction sources of the Naturali agent `geovis-spec-generator-loop` and the `INSTRUCTIONS`
  const in `src/app/api/ai/spec/route.ts`. Use when the user asks to validate a spec case against the
  golden, prune or optimize instructions without losing robustness, check whether a prompt rule is
  covered by the deterministic validators (`candidateValidation.ts`/`specValidation.ts`), or generate
  the `eval-report.md` of a run. Also triggers on Portuguese requests such as "valida esse caso contra
  o golden", "poda as instruções", "gera o eval-report". Variation runs (`/mapas` variations) are
  suspended by default and run only when explicitly requested.
---

# geovis-spec-gate-optimizer

## What it is

A measurement skill. It does not generate maps. It runs eval cases against the real endpoint,
compares the response with structural goldens and a recomputed oracle, and produces evidence for
deciding changes to instructions or validators. Every run is versioned and immutable.

Supporting references:
`references/golden-specs.md` (structural and semantic goldens, provenance),
`references/determinism-map.md` (prompt rule → validator that covers it),
`references/sources.md` (sources and the `naturali` CLI), `references/decisions.md` (decisions and open items),
`references/evals-architecture.md` (target architecture for semantic evaluation).

## Goal

Prove three things by code, not by reading:

1. **Contract and total:** the generated spec uses the right dataset, in the right form, with the right total.
2. **Minimal and render:** in each variation, the spec contains only the fields that the mode uses and
   renders the same UI and legends as the golden.
3. **Robustness when pruning:** a change to the instructions does not break cases that already passed.

Any change to the instructions is delivered as a proposal. The skill never prunes the production
agent and never edits `route.ts` on its own.

## Suspended by default: variation runs

Runs of the `/mapas` variations (`evals/evals.variations.json` through `scripts/run_variations.sh`)
are **suspended by default**. They run only when the user explicitly asks for them in the request.

- `scripts/run_variations.sh` exits unless `GEOVIS_RUN_VARIATIONS=1` is set. Set it only for an
  explicitly requested run.
- Variation cases stay defined in `evals/evals.variations.json` and keep their goldens. Defining or
  editing them does not count as running them.
- A request for "the eval" or "the gate" does not include variations. Run only `evals/evals.json`
  unless the variations are named.
- Report variations as **NOT EXECUTED** when they were not requested. Never count them as passed.

## Inputs

| Input | Where | Role |
|---|---|---|
| `GEOVIS_GOLDEN_DIR` | environment variable; default `tmp/specs/full/verifield` | Reviewed structural goldens |
| Semantic goldens | `references/goldens/semantic/` | Expected variable, dataset, and outcome per question (graded by rubric and human review) |
| Eval cases | `evals/evals.json` | Prompt, expectation, golden, and covered rules |
| Clarification response | `references/goldens/coropletico-cozinhas-clarify.json` | Golden for a request the route must clarify, not generate |
| Catalogue | `public/dataset_catalogue.json` and `RENDERABLE_DATASET_FETCHERS` (`mapDataCatalogue.ts`) | Reachable datasets |
| Served sources | `KNOWN_SOURCE_URLS` (`specValidation.ts`) | The only list of valid URLs |
| Oracle data | `src/data-source-static/data/cozinhas_com_geolocalizacao_all.csv`, `public/geo/geojs-100-mun.json` | Total recomputed with the gateway rule |
| Agent instructions | `agents/geovis-spec-generator/formation.json` | Source 1, not under CI |
| Route instructions | `INSTRUCTIONS` const in `src/app/api/ai/spec/route.ts` | Source 2, under CI |
| Credentials | `.env` (`NATURALI_API_KEY`, `NATURALI_PROJECT_ID`, `NATURALI_AGENT_ID`, `NATURALI_FORMATION_ID`) | Never in a versioned file |

The two instruction sources are never merged. Merging couples deploying a business rule (under CI)
to reprovisioning the agent (out of band).

## Steps

### Step 0: select the case

Input: a user prompt, or an `id` from `evals/evals.json`.

- With no input, use the case marked `"default": true` in `evals/evals.json`. Today it is
  `nogolden-pessoas-atendidas-quero-ver`, with the prompt "Quero ver o número total de pessoas atendidas
  pelas cozinhas solidárias por município" and `expect.variable: pessoasAtendidas`,
  `expect.form: point+sizeBy`.
- Before spending API calls, show the case and its `expect` to the user and wait for confirmation.
- A free-form prompt must be matched against the eval cases. If it matches one, use its `id`. If not,
  create a new case with `expect` and `coversRules`, and confirm it with the user.

### Step 1: map redundancy against the deterministic validators

The agent's response goes through three layers. Measure each one before concluding that a pruning
did not regress:

1. **Inside the agent loop:** the `validate_spec` tool runs `validateCandidate`
   (`candidateValidation.ts`), with local repairs and `collectStructuralIssues`. At most
   `MAX_VALIDATION_ATTEMPTS = 5` calls; it stops on `no-shrinkage` or at the 55 s deadline
   (`naturaliSession.ts`), and the route answers 422 `stopped`.
2. **Structural after the response:** `hoistLayerLegends` and `collectStructuralIssues`, which aggregate
   `findInvalidGeojsonSource`, `findInvalidBasemapStyleUrl`, `findGeometryInMapData`,
   `findMissingLegend`, `findChoroplethOnAbsoluteTotal`, and `unsupported-dataset`.
3. **Server-side normalization:** `isCozinhasChoroplethRequest` → `buildCozinhasChoroplethSpec`
   (`canonicalChoropleth.ts`); otherwise `appendRealMapData` and `appendRealSourceData`; finally
   `validateWithLocalRepairs`.

A rule rewritten by layer 3 is never attributed to the model. Modules cited in `determinism-map.md`
that do not exist on this branch are marked `validador-ausente` (missing validator) and remain
**essential** until a validator exists.

For each rule in both sources, record an atomic item in `references/determinism-map.md`:

- Rule covered by an existing validator → pruning candidate, decided in Step 4.
- Rule without a validator (choice of `mapDataId` or variable, grain, coverage and time, pt-BR label,
  choice of source or layer) → essential, not prunable.

Every essential rule whose check can be decided by code gets a checker, with the same `R-*` id, in
`scripts/score_case.mjs` or `scripts/project_spec.mjs`. A checker that reimplements an existing `findX`
is forbidden: import it.

### Step 2: provision the agent (asks for confirmation before spending API calls)

Provisioning uses a local formation file, through the `naturali` CLI (see `naturali <command> --help`).

- **Precondition:** explicit user confirmation before the first `create-formation`. It has real cost.
- Reconfirm with `naturali list-formations` and `get-agent`, and compare the live `instructions` and
  `output_schema` with the local file. Divergence → stop and report.
- Use the existing loop formation (`NATURALI_FORMATION_ID`).
- Flow per configuration: back up the live state in `runs/<runId>/` → edit the local file → copy it to
  `runs/<runId>/formation.<config>.json` → `naturali validate-formation` → `update-formation` →
  record `agentVersion` in `versions.json`. At the end, restore the local file and the live agent.
- `trace_content_mode: "full"` on the eval agent, so `get-generation-transcript` saves the
  `validate_spec` rounds to a file.
- Agent-side variants do not run in parallel: `update-formation` → all cases → next update.
- Native Naturali evals (`create-eval`, `start-eval-run`) do not serve the `validate_spec` tool.
  Evals always go through the route endpoint.

### Step 3: build the eval dataset

Format: `evals/evals.json`. `golden` fields are file names relative to `GEOVIS_GOLDEN_DIR`, except
those pointing into `references/goldens/`.

- One case per `mapType` (choropleth, proportionalCircles, dotDensity).
- Dataset outside `RENDERABLE_DATASET_IDS` → `status: "error"` (`missing_data`), never an invented `mapDataId`.
- Request resolvable only at state grain → expect.sources = `/geo/estados.json` and `expect.geometry = polygon`.
  Request resolvable only at municipality grain → expect.sources = `/geo/geojs-100-mun.json` and `expect.geometry = polygon`.
- Ambiguity between temporal versions (`cozinhas_geolocalizadas` × `_2025`) → `ambiguous_request`.
- Request with no 1:1 field in the catalogue → do not use a proxy without saying so.
- Loop: one case that forces at least one `validate_spec` round and one that ends in `stopped`.
- **At least one case per `R-*` id** in `evals.json` (coverage gate, mandatory).
- **At least one case per reachable `/mapas` variation** in `evals/evals.variations.json`, with its golden in
  `GEOVIS_GOLDEN_DIR` and a `mapMode` from `geovisMapMode.ts`. These cases are defined here but **run only
  when requested** (see "Suspended by default"). An unreachable mode becomes a refusal case, never a golden.
- Each people-served case has two prompts (decision D2): the one in `evals.json` and the original request.
- Count cases over polygons expect `clarify` (decision D4, option a), not a spec.
- Semantic goldens in `references/goldens/semantic/` are linked to their case once approved (the link field
  is added with the first approved entry). Their result is graded by rubric and human review, never by the
  structural gate.

### Step 4: gate checks

Each check has state **PASS**, **FAIL**, or **NOT EXECUTED**. NOT EXECUTED never counts as passed.

| Check | Command | PASS criterion |
|---|---|---|
| V1. Contract and total gate | `node scripts/gate_pessoas_total.mjs <spec.json>` | exit 0; empty `failures`; rules C1 to C4 and T1 to T3 |
| V2. Gate self-test | `node scripts/gate_pessoas_total.mjs references/goldens/pessoas-atendidas.structural.json --self-test` | `goldenPass: true` and 5 of 5 mutants `caught: true` |
| V3. Selected golden case | `scripts/run_eval_case.sh <spec.json>`; if no id is given, the base case runs with both prompts of `nogolden-pessoas-atendidas*` | HTTP 200, `mapType: proportionalCircles`, `mapDataId == cozinhas_pessoas_atendidas`, 348 rows, V1 exit 0 |
| V4. Test suite | `pnpm test` | NOT EXECUTED by default. Only with explicit user authorization |

Order: V2 before V1, because the gate must prove it catches its own defects. V1 and V3 use the same
output of the run.

### Step 5: run the eval against the real endpoint

Sequential, with the coverage gate.

1. Start `pnpm dev` with the credentials from `.env`. If an API key is exported in the shell, it
   overrides `.env` and the route answers 401: start without those variables.
2. Run each case with `scripts/run_eval_case.sh <prompt> <out.json>` (POST to
   `http://localhost:3000/api/ai/spec`). Record `httpStatus`, `durationMs`, and the response.
3. Extract `response.spec` to `*.spec.json` and run V1 on each one.
4. Binary coverage gate: `scripts/score_case.mjs` over every case with `R-*`. A variant only proceeds
   if 100% still pass.
5. Report the axes separately, never summed:
   - **(a)** Programmatic pass/fail: `score_case.mjs`, importing the functions of `candidateValidation.ts`
     and `specValidation.ts`.
   - **(b)** Qualitative rubric: correct variable, pt-BR label, coverage and time, error `status` and `code`.
     Semantic golden entries are graded here.
   - **(c)** Structural fidelity to the golden: `project_spec.mjs compare <golden> <candidate>`, by
     `geometry`, `form`, and `legendScale`. `dataset` goes to the grader.
   - **(d)** Efficiency: prompt and instruction tokens, `duration_ms`, and `validate_spec` calls.
   - **(e)** Minimal and render: `minimality.json` with `extraFields`, `missingFields`, and layer and legend
     equivalence with the golden. Screenshot only when visual confirmation is requested.
   - Variation runs produce axis (e) only and follow "Suspended by default".
6. If the run changes code, record the state of the gates before and after.

### Step 6: deliver proposals and report

Nothing is applied on its own. See **Outputs** below. Stop when: the user approves, a review round has
no feedback, or the axes show no measurable progress.

Changes under `src/app/api/**` need a decision recorded in devanity before writing. See
`references/decisions.md`.

## Outputs

Each run writes to `runs/<YYYYMMDDTHHMMSSZ>--<slug>/`. The directory is new for each execution and is
never edited afterwards.

| File | Content | State |
|---|---|---|
| `versions.json` | `skillVersion`, source hashes, `spec.schemaVersion`, `testAgent.agentVersion`, `golden.dir`, `gate`. Written before the first POST | Implemented as a convention; no generator script |
| `caso-*.output.json` | Raw route response, with `httpStatus` and `durationMs` | Implemented |
| `caso-*.spec.json` | Extracted `response.spec`, input to the gate | Implemented |
| `caso-*.gate.json` | V1 verdict | Implemented |
| `gate-self-test.json` | V2 output | Implemented |
| `results.md` | Run table, with HTTP, result, and gate per case | Implemented manually |
| `eval-report.md` | Per-case report with the seven sections below | Planned, no generator script |
| `proposed-*.md` / `.diff` | Change proposals, never applied | Planned |
| `proposed-issues.md` | Issue proposals by scope, with the unconfirmed ones carried over at "end" | Planned |

### `eval-report.md` (planned)

Generated from the run artifacts, never written by the model from its own text. Structure as in
`references/evals-architecture.md` §5:

1. **Identification and reproduction:** prompt, `caseId`, `runId`, `skillVersion`, formation and agent,
   `spec.schemaVersion`, catalogue hash, duration, and number of calls.
2. **Intent interpretation:** metric, unit, operation, period, and filters. Empty when the run has no intent contract.
3. **Data selection and verification:** selected dataset, discarded candidates, chosen field with
   justification, API evidence, and coverage.
4. **Spec audit:** `mapType`, layers, `mapData` ids, legends, `scaleMaxValue`, and classes.
5. **Test results:** V1 to V5 with state and failure codes. Severity per rule.
6. **Human decision:** questions Q1 to Q9, decision rules, and record fields in `references/human-review.md`.
   The model drafts the questions and evidence pointers only. Empty until a person answers.
7. **Correction plan:** probable cause, responsible layer, proposed change, regression tests, and the
   issue proposals by scope described below.

Possible state for each section: **approved**, **rejected**, **inconclusive**, or **not executed**.

### Issue proposals by scope (user confirms)

Section 7 lists one proposed GitHub issue per scope that has a correction item. Each proposal has:

| Field | Content |
|---|---|
| `scope` | One of `catalogue`, `intent`, `data`, `transform`, `agent-instructions`, `validation`, `render`, `evals-gate`, `skill` |
| `title` | Short English title in the imperative mood |
| `rationale` | The run ID, the artifact, and the failing check that justify the issue |
| `layer` | The responsible layer from section 7 |
| `acceptance` | One or two checks that prove the issue is done |

The round ends with a numbered question to the user, one line per proposal:

```
1. create | 2. create with instructions: <text> | 3. skip
Reply with the numbers to create, "end" to close the round, or "none".
```

Rules:

- Nothing is created on the model's own initiative. Only the numbers the user confirms are created,
  with `gh issue create`, in English, one issue per proposal.
- "With instructions" appends the user's text to the issue body, unchanged.
- "end" closes the round without creating anything. The unconfirmed proposals are written to the
  run directory as `proposed-issues.md`, so they can be confirmed in a later round.
- Out-of-scope findings (refactors, missing tests, stale docs) follow the same flow, as separate
  proposals, never bundled into a correction issue.

### Change proposals (always outside production)

- `proposed-patch-agent-instructions.md`: diff of the agent instructions. Applied through the
  provisioning flow, with backup and validation.
- `proposed-patch-instructions.diff`: literal diff of the `INSTRUCTIONS` const. Applied by a recorded decision.
- `proposed-geovis-validations.md`: generic checkers that are candidates for `@ttoss/geovis`, with rule,
  implementation, tests, and the instruction to remove from the agent.

## Permanent rule: version everything

Nothing is overwritten. Each run has its own directory. An A/B comparison cites both `runId`s.

- `skillVersion` is the `version` in the frontmatter. Minor = new gate or axis. Major = change in the
  format of `runs/`, `versions.json`, or the agent transport. Runs with different major `skillVersion`
  are not compared.
- `spec.schemaVersion` is **2** today. If `libSchemaVersion` goes above 2, stop and report: the agent
  must be resynchronized with `geovis-spec-agent-creator`.
- `runs/2026-09-18*` runs use the Anthropic transport (skill 1.x). They are history, not a baseline.

## Out of scope

- Do not modify `candidateValidation.ts`, `specValidation.ts`, or `canonicalChoropleth.ts` beyond importing
  their exported functions. Exception: `ABSOLUTE_TOTAL_DATASET_IDS` in
  `src/app/api/ai/spec/mapDataCatalogue.ts`, changed by a recorded decision (D4, `D-src extend`).
- Do not change Vercel environment variables. That is the user's action.
- Credentials: never write `NATURALI_API_KEY` in a versioned file, including `.claude/settings.json`. Only `.env`.
- Do not run `pnpm test`, lint, or build without explicit authorization (decision D9).
- The UI corpus `src/app/(features)/mapas/specs/full-evalued/`, generated by
  `scripts/dump_golden_specs.mjs`, is coupled to the `/mapas` route. It does not feed the gate.
- Do not run variation cases unless explicitly requested (see "Suspended by default").

## When not to use

- Generate a single spec: invoke `geovis-spec-generator` directly.
- Resynchronize the agent with a new `schema.json`: use `geovis-spec-agent-creator`.
- Changes outside the spec layer: this skill does not cover page rendering or UI.
