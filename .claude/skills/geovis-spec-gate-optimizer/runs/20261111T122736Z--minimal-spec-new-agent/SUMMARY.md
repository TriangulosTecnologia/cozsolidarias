# Eval: new agent against the minimal-spec server

Agent: `geovis-spec-generator-loop`, deployed from `agents/geovis-spec-generator/formation.json` at `8b9afed8` (1.4 KB `output_schema`, `temperature` 0, provider claude-opus-5.5). Server: the PR #114 code at the same commit. One run of all 22 cases in `evals/evals.json`, no retries.

Only the `*.score.json` files and `campaign.log` are versioned. The raw responses stay out of the repository.

## Result

18 of 22 cases pass (baseline with the old agent, `20261110T200342Z--minimal-spec-old-agent`: 7 of 19 scored).

| Group | Cases | Note |
| --- | --- | --- |
| Pass, map served (11) | `ambig-ano-cozinhas`, `golden-cadinsan`, `golden-circulos`, `golden-pontos`, `nogolden-cozinhas-2025`, `nogolden-pessoas-atendidas`, `nogolden-pontos-ano`, `nogolden-pontos-heatmap`, `rule-coverage-partial`, `rule-dotdensity-absoluto`, `trap-cadinsan-sem-pbf` | dataset, geometry URL and legend as expected |
| Pass, error expected (7) | `error-assentamentos`, `error-cafs`, `error-dataset-inexistente`, `error-grain-estado`, `rule-basemap-inventado`, `rule-choropleth-absolute`, `rule-source-inventada` | see the caveat below |
| Fail (4) | `golden-ivs`, `trap-ivs-subindice`, `trap-idhm`, `golden-coropletico` | causes below |

## Failures

| Case | Response | Cause | Issue |
| --- | --- | --- | --- |
| `golden-ivs`, `trap-ivs-subindice`, `trap-idhm` | 422 `invalid-schema` at `/legends/0/colorBy` | the server puts `labels` in `colorBy`; geovis 0.32 only accepts `labelFormat: {type: 'labels', labels}` | #115 |
| `golden-coropletico` | 422 `missing_data` | the agent refuses a choropleth of kitchen counts while the server has a canonical one | #117 |

## Caveats

- `error-dataset-inexistente` passes, but its 422 is the same `colorBy` error as #115, not the guard it is meant to exercise. It will need a recheck once #115 is fixed.
- A single run: the earlier campaigns flipped one case (`nogolden-pontos-heatmap`) between runs, so a failing or passing case here is not proof of stability.
- The old-format cases in #116 do not appear with this agent.
