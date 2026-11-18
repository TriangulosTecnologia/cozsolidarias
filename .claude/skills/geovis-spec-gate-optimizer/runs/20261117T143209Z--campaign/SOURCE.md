# Source of this run

A campaign against a local dev server (`scripts/run_campaign.sh`), with one case overwritten afterwards, so the run is not a single configuration.

| Cases | Server config when they ran |
| --- | --- |
| 22 of 23 | `FORBID_ABSOLUTE_ON_CHOROPLETH` unset (the campaign itself) |
| `golden-coropletico` | overwritten with `run_eval_case.sh` and rescored, with `FORBID_ABSOLUTE_ON_CHOROPLETH=true`; the preflight answers `clarify` (decision D4) |

- `rule-choropleth-absolute` was not rerun: its stored 422 `missing_data` comes from the agent declining, which the flag now short-circuits into a `clarify`. `scripts/score_case.mjs` does not accept that outcome for the case (#127).
- `classification.json` drops the #117 group because `golden-coropletico` passes after the overwrite.
- `eval-report.json` and `SUMMARY.md` are generated from `cases/` and `classification.json`, so their totals (19/23) carry this mix.
- The flag lives only in a local `.env`; production does not set it.
