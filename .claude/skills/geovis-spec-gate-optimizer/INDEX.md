# geovis-spec-gate-optimizer: index

Skill to consolidate the VisualizationSpec generator instructions and measure each change with
blocking gates, using structural and semantic goldens versioned inside the skill.

Version: 3.1.0 (previously: `geovis-spec-instructions-optimizer` 2.0.0). See `references/decisions.md`.

## Where to start

1. `SKILL.md`: full flow, steps 0 to 6, and the people-case gate.
2. `references/decisions.md`: recorded decisions, status, and open items.
3. `references/golden-specs.md`: structural and semantic goldens, and how they are validated.
4. `references/evals-architecture.md`: target architecture for semantic evaluation (formerly `plan.md`).

## Files

| Path | Content |
|---|---|
| `SKILL.md` | Executable instructions |
| `references/decisions.md` | Record of decisions D1c to D10, with status |
| `references/golden-specs.md` | Structural and semantic goldens, provenance, and validation |
| `references/evals-architecture.md` | Architecture plan for semantic evaluation (origin: `plan.md`; not tracked by git) |
| `$GEOVIS_GOLDEN_DIR/_pessoas-atendidas.json` (default `tmp/specs/full/verifield`) | Structural golden of people circles per municipality (348 rows, sum 789,755) |
| `references/goldens/coropletico-cozinhas-clarify.json` | Clarification response for the count-of-kitchens choropleth (decision D4, option a) |
| `references/goldens/semantic/` | Semantic goldens (schema in `golden-specs.md`); none approved yet |
| `references/human-review.md` | Questions Q1 to Q9, decision rules, and record fields for the human decision |
| `references/determinism-map.md` | Prompt rule → validator that covers it |
| `references/sources.md` | Where the sources live and the `naturali` CLI |
| `references/evals-schema.md` | Fields of `cases[]` and `expect` in the eval files, with observed values and known problems |
| `references/spec-generation-pipeline.md`, `pipeline-diagram.md`, `quick-reference.md`, `example-generation.md` | Pipeline and execution examples |
| `evals/evals.json` | Eval cases; the people case appears with two prompts (D2) |
| `evals/evals.variations.json` | `/mapas` variation cases with corrected `expected` (D6). **Suspended by default** |
| `scripts/gate_pessoas_total.mjs` | Contract and total gate, with mutant self-test (D1c) |
| `scripts/score_case.mjs`, `scripts/project_spec.mjs`, `scripts/run_eval_case.sh`, `scripts/run_campaign.sh` | Scoring and case execution |
| `scripts/run_variations.sh` | Variation runner. Exits unless `GEOVIS_RUN_VARIATIONS=1` |
| `scripts/dump_golden_specs.mjs` | Generates the `/mapas` UI corpus (does not feed the gate) |
| `scripts/build_agent_variant.mjs`, `scripts/minimal_spec.mjs`, `scripts/probe_validate_spec.mjs`, `scripts/provision_test_agent.sh` | Agent variants and provisioning |
| `variants/` | Candidate variants of the agent prompt (hypotheses, not measured) |
| `runs/` | Versioned, immutable runs; old paths stay as they are |

## Permanent rule

Nothing is overwritten. Each run writes to `runs/<date>--<variant>/` with `versions.json`. Runs dated
`2026-09-18` use the Anthropic transport (skill 1.x) and are not a baseline.
