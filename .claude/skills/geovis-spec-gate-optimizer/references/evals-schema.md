# Schema of `evals/evals.json` and `evals/evals.variations.json`

Describes the fields read or expected in each case. The values come from the current content of the
files (21 cases in `evals.json`, 2 in `evals.variations.json`). Fields marked **not read** exist in the
file, but no script consumes them today.

## Top-level fields of `evals/evals.json`

| Field | Type | Usage |
|---|---|---|
| `datasetVersion` | string | Version of the case set. Goes into `versions.json`. |
| `skillVersion` | string | Must equal the `version` of `SKILL.md` (currently `3.0.0`). |
| `createdAt` | string (ISO) | Creation date of the set. |
| `goldenCorpus` | string | Base directory of the `golden` fields. **Problem:** the current value is a phrase, not a path. `scripts/run_variations.sh` builds `goldenCorpus + "/" + golden`, so that script does not work with the current value. See "Known problems". |
| `notes` | array of string | Context notes for the set. Not read by scripts. |
| `implicitRules` | object | Rules checked on every response, with no dedicated case: `R-json-only`, `R-dangling-refs`, `R-no-extra-props`, `R-one-pass`. Not read by scripts; the coverage gate treats them as covered. |
| `cases` | array | The cases. See below. |

## Fields of `cases[]`

| Field | Type | Present in | Observed values | Read by |
|---|---|---|---|---|
| `id` | string | 21 | Unique. E.g.: `nogolden-pessoas-atendidas-quero-ver`. | `run_campaign.sh`, `score_case.mjs` |
| `kind` | string | 21 | `golden` (4), `rubric-only` (3), `trap` (3), `ambiguity` (1), `error` (4), `rule-gate` (5), `clarify` (1) | `run_variations.sh` only distinguishes `refusal`; no script reads the others |
| `prompt` | string | 21 | Text in pt-BR, as a user would write it. | `run_campaign.sh`, `run_variations.sh`, `score_case.mjs` |
| `default` | boolean | 1 | `true` only on the default case (`nogolden-pessoas-atendidas-quero-ver`). | **Not read.** Step 0 of `SKILL.md` depends on it, but no script reads it yet. |
| `golden` | string | 7 | File name relative to `GEOVIS_GOLDEN_DIR` (e.g.: `_pessoas-atendidas.json`). Exception: `references/goldens/coropletico-cozinhas-clarify.json`, which is relative to the skill root. | `run_variations.sh` (with the `goldenCorpus` problem) |
| `gate` | string | 2 | Path of a gate script (`scripts/gate_pessoas_total.mjs`). | **Not read.** |
| `expect` | object | 21 | See the `expect` table below. | `score_case.mjs` (`expected-outcome` check and shape checks) |
| `coversRules` | array of string | 21 | `R-*` IDs covered by the case. E.g.: `R-mapdataid-real`, `R-choropleth-not-absolute`. 29 distinct IDs in total. | Coverage gate (Step 5, item 4) |
| `rubric` | string | 21 | Text criterion for the grader (axis b). Describes the expected answer and the rule it protects. | Human grader or `agents/grader.md` (not automated) |

## Fields of `expect`

| Field | Type | Used in | Meaning |
|---|---|---|---|
| `outcome` | string | 14 | Expected outcome of the route. Values: `clarify`, `error`, `error-or-clarify`, `clarify-or-default-with-note`, `spec-with-rate-or-error`, `spec-with-coverage-caveat`, `error-or-default-basemap`. Values with `-or-` are free-text alternatives, not an enum. |
| `dataset` | string | 7 | Expected dataset id (`cozinhas_pessoas_atendidas`, `cozinhas_geolocalizadas`, etc.). |
| `variable` | string | 2 | Expected dataset field (`pessoasAtendidas`). Only in the `nogolden-pessoas-atendidas*` cases with the D13 default. |
| `form` | string | 6 | Expected cartographic form (`point+sizeBy`, `polygon`, `point`). |
| `geometry` | string | 4 | Expected geometry source (e.g.: `/geo/geojs-100-mun.json`). |
| `legendScale` | string | 6 | `quantitative` or `categorical`. |
| `total` | object | 2 | `{ source, field, tolerance }`. Defines the total oracle: `gateway.getCozinhasPorMunicipio`, field `pessoasAtendidas`, tolerance `0`. |
| `facet` | string | 1 | Expected clarification facet: `mapType`. Only in the `golden-coropletico` case. |
| `default` | string | 1 | Default value of the clarification facet: `proportionalCircles`. Not to be confused with the `default` field of `cases[]`. |
| `reason` | string | 1 | Textual reason for the expectation. Only in the `golden-coropletico` case. |

## Known problems

1. `goldenCorpus` in `evals.json` is a phrase, not a path. `run_variations.sh` breaks. Suggested fix:
   restore a path (`tmp/specs/full/verifield`) and document the environment variable in another field.
3. `default` in `cases[]` is not read. Step 0 depends on it. A reader needs to be created, or the
   default case needs to be selected by `id`.
4. `gate` in `cases[]` is not read by any script.
5. `kind` is not used for decisions, except `refusal` in `run_variations.sh`. The `clarify` value of the
   `golden-coropletico` case is not handled specially.

These items were not fixed in this documentation. See the pending decision in `decisions.md`.
