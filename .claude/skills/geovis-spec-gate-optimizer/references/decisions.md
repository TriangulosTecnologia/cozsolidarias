# Refactoring decisions (geovis-spec-gate-optimizer skill)

Record of the decisions made on the ten open questions of the plan. Each item has a status:
APPLIED (change made in the skill), PROPOSED (ready text, no effect on the code), NOT EXECUTED
(depends on an environment that was not used) or PENDING (depends on external authorization).

Decision format used in the repository (devanity): each decision is a `[DECIDE]` record with
options, recommended default and owner. devanity has no decision subcommand; the record below is the
format used here, and `/devanity debt` is the mode that lists pending decisions.

## Records

D1c. Case `nogolden-pessoas-atendidas` with blocking gate and recomputed total. Status: APPLIED.
Implementation: `scripts/gate_pessoas_total.mjs` (contract + CSV oracle + mutant self-test).
Golden in `references/goldens/`. Accepted trade-off: the oracle reads the static CSV, not the running
gateway; if the aggregation rule changes, the oracle changes with it.

D2. The two "pessoas" prompts are separate cases. Status: APPLIED in `evals/evals.json`
(`nogolden-pessoas-atendidas` and `nogolden-pessoas-atendidas-quero-ver`). Live verification:
EXECUTED in `runs/20261026T202823Z--nogolden-pessoas-ambos-prompts/` against `pnpm dev` with the
credentials from `.env` (code of `ABSOLUTE_TOTAL_DATASET_IDS` still without the extension from D4).
Both prompts answered HTTP 200 with `proportionalCircles`, `cozinhas_pessoas_atendidas`, 348 rows and
a quantitative legend. `gate_pessoas_total.mjs` passed both, with 348 municipalities and a sum of
789,755 against the CSV oracle. Previous round `20260928T195749Z--final-eval` (prompt "Quero ver..."
— "I want to see..."): choropleth of kitchen count, rejected. The improvement came from a later code
change, not from the eval itself; the originating round remains as a record.

D3. `expect.variable` and `expect.form` in the case. Status: APPLIED. Values: `pessoasAtendidas`,
`point+sizeBy`, `quantitative`, plus the `total` block (source, field, zero tolerance).

D4. Extend `ABSOLUTE_TOTAL_DATASET_IDS` (choice "a") versus keep the list (`keep`). Status: APPLIED
and verified. The first `D-src` record came in malformed (`keep && ...`, together with D5); the final
decision was `D-src extend --path src/app/api/ai/spec/**`, recorded as its own message. The list became
`cozinhas_pessoas_atendidas`, `cozinhas_geolocalizadas`, `cozinhas_geolocalizadas_2025`, in
`src/app/api/ai/spec/mapDataCatalogue.ts`. Verification in round
`runs/20261027T120609Z--pos-extensao-absoluto-lista/`: both people prompts still PASS in the gate.
Measured effect: the prompt "Mapa coroplético das cozinhas solidárias por município." (English:
"Choropleth map of solidarity kitchens by municipality.") receives HTTP 200 with a clarify from the
preflight (facet mapType), with no spec. It is not the 422 predicted before. Accepted regression
(human decision, option a): the golden becomes `references/goldens/coropletico-cozinhas-clarify.json`,
and the `golden-coropletico` case expects clarify. Evidence that the current list is enough: in the two
rounds of today (`runs/20261026T202823Z--...`), the two prompts without a forced `mapMode` produced
`cozinhas_pessoas_atendidas`, and the gate passed. The failure of
`runs/20260928T195749Z--final-eval` came from the variation with a nonexistent `mapMode`
(`coropletico-pessoas-atendidas`), not from the prompt. Count on polygons remains valid in `/mapas`,
which does not go through the preflight; on the `/api/ai/spec` route it becomes a clarify.

D5. Document `pessoasAtendidas` in `/api/cozinhas/por-municipio`. Status: ACCEPTED and APPLIED in the
JSDoc of `src/app/api/cozinhas/por-municipio/route.ts`. Decision `D-doc accept` recorded as its own
message (the first submission came together with `D-src` and was malformed). `endpointsDocumentation.json`
was not changed (path `src/app/api/ai/spec/**`): it needs its own decision, if accepted. No `pnpm test`,
per D9.

D6. Fix the `expected` of the variation `v-pessoas-atendidas`. Status: APPLIED in
`evals/evals.variations.json`. Changes: `mapMode` of `coropletico-pessoas-atendidas` (nonexistent in
`geovisMapMode.ts`) to `circulos-pessoas` (existing); `expected` to circles; and `expectedNot` with the
observed choropleth. The round in `runs/` was not edited, because it is immutable.

D7. Reproduce the gateway rule to explain the 37 divergences. Status: APPLIED (investigation).
Result: the "polygon wins" rule reproduces the golden exactly (348 municipalities, sum 789,755,
0 differences). The divergences came from the comparison method, not from the golden.

D8. `references/evals-architecture.md`, used as the base (originally outside the repository).
Status: APPLIED. The file remains untracked by git; no commit includes it.

D9. Do not test. Status: APPLIED. No suite test (`pnpm test`), lint or build was run. The gate
`gate_pessoas_total.mjs` was run on the specs of the round and in the mutant self-test over the golden
(see `runs/20261027T120609Z--pos-extensao-absoluto-lista/gate-self-test.json`): golden PASS, 5 of 5
mutants CAUGHT. The repository's unit tests that cover `ABSOLUTE_TOTAL_DATASET_IDS` were not run, so
their impact is unknown.

D10. Inspection of `feat/geovis-spec-instructions-optimizer-v2` and new name. Status: APPLIED.
Inspection: the branch does not contain the current `HEAD` and does not have the skill folder (a diff
of 101 files, almost all removed relative to `HEAD`). The only commit related to the case is `2449670d`
("remove renderable dataset validation from candidate validation"), which is not in `HEAD` and was not
merged. Kept from the branch: nothing. New name: `geovis-spec-gate-optimizer`, because the skill now
measures blocking gates over specs, not only instructions.

D11. Golden directory via environment variable. Status: APPLIED. `GEOVIS_GOLDEN_DIR` (default
`tmp/specs/full/verifield`) replaces the nonexistent path `src/app/(features)/mapas/specs/full/`. The
duplicate copy `references/goldens/pessoas-atendidas.structural.json` was removed after `cmp` confirmed
it was identical to the golden in `verifield`. Open risk: `tmp/` is ignored by git; see
`golden-specs.md`.

D12. Steps discussed without a code change, recorded here and outside `SKILL.md` (option 2):

- Variants `agente-tier1` and `agente-tier12`: NOT MEASURED. Hypotheses in `variants/`. Revisit when
  an approved A/B campaign exists.
- `scripts/run_campaign.sh` and `scripts/run_variations.sh`: NOT EXECUTED. They depend on a test
  formation. Revisit after the authorized `create-formation`.
- `agents/grader.md` and `agents/comparator.md` of skill-creator: NOT USED. Revisit in the first A/B
  round.
- Axis (e) with a screenshot via `pr-playwright-verify`: NOT DONE. Only on request for visual
  confirmation.
- Phases 1 and 3 of the old `golden-specs.md`, based on `specs/full/`: REPLACED by gates V1 and V2.
- Branch `feat/geovis-spec-instructions-optimizer-v2`: NOT MERGED. Divergent, does not contain `HEAD`.
- Documentation of `endpointsDocumentation.json` (pessoasAtendidas per municipality): PENDING. Path
  `src/app/api/ai/spec/**`, needs its own `D-doc`.
- Provisioning of the test formation (Step 2 of `SKILL.md`): NOT EXECUTED. It remains in `SKILL.md` as
  a procedure, with the precondition of explicit confirmation.

D13. Default case of the skill. Status: APPLIED, by user confirmation. The case without explicit input
is `nogolden-pessoas-atendidas-quero-ver` (field `"default": true` in `evals/evals.json`), with
`expect.variable: pessoasAtendidas` and `expect.form: point+sizeBy`. `expect.variable` and `expect.form`
remain only in the default case. In `nogolden-pessoas-atendidas` (prompt "Mapa do total..." — "Map of
the total..."), these two fields were removed; `dataset`, `legendScale` and `total` were kept.
Reversible if symmetry needs to be restored. Step 0 of `SKILL.md` describes the selection.

D14. Deviations in `references/` and `scripts/` (audit of 2026-10-27). Status: PARTIAL. Full record in
`runs/20261027T172045Z--execucao-plan-closure/audit-references-scripts.md`. Applied: an outdated banner
in determinism-map.md, pipeline-diagram.md, quick-reference.md, spec-generation-pipeline.md and
example-generation.md; `provision_test_agent.sh` marked DEPRECATED. Pending: 12 `findX` in
determinism-map.md cited as `coberta-repo` do not exist in the repository. The line statuses remain for
review, because changing a status changes the candidate pruning.

D15. Scripts for the current execution. Status: APPLIED in `run_variations.sh`: resolves goldens via
`GEOVIS_GOLDEN_DIR` and via `references/`; `kind: clarify` branch. `evals/evals.variations.json` gained
the `prompt` field (it was missing, and the endpoint received "undefined"). Pending: the goldens for
points, circles, IVS and cadinsan of `evals.json` do not exist in `verifield/` (see
`step-3-dataset.md`). Pending choice: move those from the root of `tmp/specs/full/`, or rename the cases.

## Kept and moved

Kept: `SKILL.md` (version 3.0.0, because its name and the reference path to `runs/` change), `runs/`
(immutable history), `variants/`, `scripts/` (with updated paths), `references/` (with the goldens and
this record). Removed: the dependency on `src/app/(features)/mapas/specs/full/`.

Environment pendings: the copy installed at `~/.claude/skills/geovis-spec-instructions-optimizer` is a
separate directory, not a link to the repository. It keeps the old name until it is reinstalled. This
change depends on the user's decision.

`devanity.rules.json` (repository root) still protects `runs/**` by the skill's old path. Editing the
guard rule was not done: devanity treats rules as high risk.
