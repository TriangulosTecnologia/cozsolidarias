# Tasks

## 1. Policy and validity specs (PR 1, `docs/spec-recovery-openspec`)

- [x] 1.1 Version `openspec/` with a `config.yaml` context limited to what an agent cannot infer; verify `openspec/config.yaml` is tracked
- [x] 1.2 Write proposal, design, `spec-recovery` and `spec-validity`; verify `openspec validate add-spec-recovery-policy --strict` passes

## 2. Route and formation (PR 2, `feat/spec-recovery-api`)

- [ ] 2.1 Give `SpecIssue` a category from one code → category map, deduplicate and order validation issues, and keep the category out of response bodies; verify unit tests for shuffled input, duplicate removal, a category for every code `collectStructuralIssues` emits, and a 422 body without `category`
- [ ] 2.2 End the generation with 502 when reading data to validate a candidate fails, without spending an attempt or calling the model; verify a unit test with the gateway rejecting
- [ ] 2.3 Bind the request (prompt, user map type and dataset, proxy note, preflight concept ids) into validation and add `ignored-user-map-type`, `ignored-user-dataset`, `period-not-covered`, `multiple-painted-variables`, `legend-count-mismatch`, `points-spec-with-map-data` and `concept-drift`, run on the agent's normalized spec in `validateCandidate` and right after `resolveAgentReply`, never on resolved or preflight-settled specs; verify a failing-first unit test per code, a pt-BR `fix` per code, and that the `/mapas` kitchens choropleth tests in `aiSpecRoute.test.ts` stay green
- [ ] 2.4 Add `completeness-claim-on-partial-coverage`, `missing-proxy-caveat` and `missing-default-period-caveat` over normalized text; verify a failing-first unit test per code plus at least two legitimate wordings that do not fire
- [ ] 2.5 Prove that the `determinism-map` rules the agent can still break under the formation `output_schema` (`mapType` without `mapData`, a point or heatmap layer over a polygon source) are already caught, adding no issue code; verify one probe test per rule, and file any uncaught rule as a successor Flow task
- [ ] 2.6 Answer the exhausting `validate_spec` call with `recovery_required`, allow one recovery within 6 validations, end a failed recovery with 422 `recovery-failed`, and report unjustified dataset or map type swaps as `semantic-drift`; verify unit tests with Naturali mocked: exhaustion continues the turn, valid recovery answers `ok`, invalid recovery answers 422 within budget, a second exhaustion is refused, a seventh call is not validated, an `ok` reply that differs from the cleared candidate answers 422, a deadline after the signal answers 422 with the exhausting candidate, an unjustified swap reports `semantic-drift`
- [ ] 2.7 Log a development-only snapshot of every generation that entered recovery; verify a unit test with `NODE_ENV` development and production
- [ ] 2.8 Update the agent instructions in `agents/geovis-spec-generator/instructions/*.md` (request authority, mutability, issues as evidence, one recovery candidate, `missing_data`), regenerate the formation with `scripts/update-instructions.mjs`, set `max_steps` 7 → 8, and keep `src/app/api/ai/spec/instructions/` consistent; verify `node agents/geovis-spec-generator/scripts/update-instructions.mjs --check` exits 0 and `pnpm --dir agents/geovis-spec-generator validate` passes
- [ ] 2.9 Run the quality gates and raise `coverageThreshold` to the new coverage; verify `pnpm typecheck`, `pnpm eslint --fix` and `pnpm test` pass

## 3. Evals and campaign (PR 3, `feat/spec-recovery-evals`)

- [ ] 3.1 Add one `R-*` eval case per new issue code and mark each new code `coberta-repo` in `references/determinism-map.md`; verify every case parses and names an existing code
- [ ] 3.2 Reclassify `determinism-map.md` rows: unreachable ones become `coberta-schema` citing the absent field, and no `coberta-repo` row points at a missing symbol; verify a grep finds every cited `findX`
- [ ] 3.3 Add exhaustion cases per category (incompatible dataset, incompatible map type, missing data, simulated operational failure) and the recovery metrics (`recovery_success_rate`, `semantic_correctness`, `recovery_regression_rate`, `false_recovery_rate`, `unnecessary_recovery_rate`, `issue_resolution_rate` per category, extra tokens and latency) to `eval-report.json` and `SUMMARY.md`; verify the report builds from a fixture run
- [ ] 3.4 Measure determinism with 3 runs per case compared on the semantic projection, and run the baseline (commit before PR 2) × recovery campaign after confirming its cost; verify `SUMMARY.md` carries the comparison table

## Workflow follow-up

- Archive the change after PR 3's campaign is accepted: `openspec archive add-spec-recovery-policy`, which creates `openspec/specs/spec-recovery` and `openspec/specs/spec-validity`.
- Release after PR 2 merges: `pnpm --dir agents/geovis-spec-generator plan`, then `pnpm --dir agents/geovis-spec-generator deploy` (real cost, confirmed before), and record the agent version.
