# Baseline: old deployed agent against the minimal-spec server

This is a baseline, not proof of the minimal-spec protocol. The new formation (`agents/geovis-spec-generator/formation.json`, 1.4 KB `output_schema`) was not deployed, so the agent that answered still returns full specs while the server now expects minimal ones.

Only the `*.score.json` files are versioned. The raw responses (about 5 MB) stay out of the repository.

## Result

7 of 19 scored cases pass; 12 fail. 3 of the 22 cases in `evals/evals.json` have no score: `rule-basemap-inventado` (raw output, never scored), `rule-source-inventada` and `rule-dotdensity-absoluto` (never run).

| Group | Cases | Cause |
| --- | --- | --- |
| Pass | `error-assentamentos`, `error-cafs`, `error-dataset-inexistente`, `error-grain-estado`, `nogolden-cozinhas-2025`, `rule-choropleth-absolute`, `trap-cadinsan-sem-pbf` | expected outcome reached |
| Fail, `invalid-schema` | `golden-ivs`, `trap-idhm`, `trap-ivs-subindice` | the old agent writes legend `colorBy`, which the resolver rejects as additional properties |
| Fail, `ambiguous_request` | `golden-cadinsan`, `golden-coropletico` | the agent returned its error branch for a request the server can serve |
| Fail, `point-layer-on-polygon-source` | `nogolden-pessoas-atendidas` | point layer drawn on the município polygons |
| Fail, 422 without an issue code | `ambig-ano-cozinhas`, `golden-circulos`, `golden-pontos`, `nogolden-pontos-ano`, `nogolden-pontos-heatmap`, `rule-coverage-partial` | message-only rejection (e.g. `golden-pontos`: no `mapData`) |

## Next

Deploy the new formation and rerun `scripts/run_campaign.sh` over all 22 cases into a new run directory.
