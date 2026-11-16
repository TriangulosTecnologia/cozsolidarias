# Map from prompt rule to deterministic validator

> **Outdated (audit of 2026-10-27).** Twelve `findX` cited as `coberta-repo` do not exist in `src/` or in `tests/`: `findDanglingActiveLegendId`, `findDotDensityWithoutRatio`, `findDuplicateLegendForSameVariable`, `findForeignNoDataColor`, `findLayerWithBothDataBindings`, `findLegendPropertyMismatch`, `findLegendScaleArityMismatch`, `findLegendValueTypeMismatch`, `findMapTypeWithoutMapData`, `findPaintedContextLayer`, `findSourceGeometryMismatch` and `findUnsupportedSourceType`. By this file's own rule, these lines are `validador-ausente` until a validator exists. Do not use their `coberta-repo` status as evidence for pruning. See `decisions.md`, D14.

Status: **verified empirically on 2026-09-18** against `@ttoss/geovis@0.21.1` and HEAD `4da685dd`. It is no longer a seed — each line below was confirmed by running the case against the validator, not by reading it.

## How it was verified (redo on every geovis bump)

The rules without their own `findX` were probed directly in the library's `validateSpec`, by assembling a minimal spec that violates each rule and reading the `status`/`issues` back. Repeat with `scripts/probe_validate_spec.mjs` whenever `geovisPackageVersion` changes: a rule that is `coberta-lib` today can become `não-coberta` in an upgrade without anything in the repo noticing.

The route rejects any `status !== 'resolved'` (`route.ts`, right after `applyCanonicalScales`), so `coberta-lib` is real enforcement in production, not theory.

## Verdicts

- **coberta-repo** — a `findX` in `specValidation*.ts` rejects it, and there is a unit test. Pruning
  candidate: measure in Step 4 before removing it from the prompt.
- **coberta-lib** — `validateSpec` of `@ttoss/geovis` rejects it with a named code. Pruning candidate
  as well, with the caveat that the guarantee belongs to a third party and disappears on an upgrade.
- **normalizada** — the route rewrites the field after the response (`applyCanonicalScales`), so what the
  model emitted there is discarded. Instructing on it is pure token waste.
- **não-coberta** — nothing rejects it. Keeping the instruction is the only defense.
- **semântica-essencial** — judgment that no code can perform. Never propose removing it.

## Table

| ID | Rule | Source | Where it is verified | Verdict |
|---|---|---|---|---|
| `R-json-only` | Respond only with the spec's JSON | agent | `stripCodeFence` + `JSON.parse` in the route (422 if it fails) | coberta-repo |
| `R-no-invent-url` | Never invent a source URL | agent + `INSTRUCTIONS` | `findInvalidGeojsonSource` | coberta-repo |
| `R-basemap-styleurl` | `basemap.styleUrl` only for a known style | `INSTRUCTIONS` | `findInvalidBasemapStyleUrl` | coberta-repo |
| `R-source-type-geojson` | Only `geojson` sources; never tiles/vector for a join | agent (step 2/3a) | `findUnsupportedSourceType` | coberta-repo |
| `R-geometry-match` | `point`/`symbol` never over a polygon source | agent (step 3b–e, "Geometry Type Constraint") | `findSourceGeometryMismatch` | coberta-repo |
| `R-sizeby-needs-points` | `point` + `sizeBy` requires Point features | agent ("Proportional Circles") | `findSourceGeometryMismatch` (subsumes) | coberta-repo |
| `R-no-geometry-in-mapdata` | `mapData` is a join, never geometry | `INSTRUCTIONS` | `findGeometryInMapData` | coberta-repo |
| `R-legend-required` | A painted variable requires a legend | `INSTRUCTIONS` + agent (step 4) | `findMissingLegend` | coberta-repo |
| `R-both-bindings` | A layer does not carry `mapDataId` **and** `propertyName` | agent ("everything else") | `findLayerWithBothDataBindings` | coberta-repo |
| `R-maptype-joins-source` | `mapType` needs `mapData.mapId` that matches a source | agent ("everything else") | `findMapTypeWithoutMapData` | coberta-repo |
| `R-grain-municipio` | Never paint a variable at state grain | `INSTRUCTIONS` (agent step 1) | `findPaintedContextLayer` | coberta-repo |
| `R-choropleth-not-absolute` | Choropleth never over an absolute total | `INSTRUCTIONS` | `findChoroplethOnAbsoluteTotal` | coberta-repo |
| `R-legend-matches-values` | Legend scale matches the type of the values | agent (step 4) | `findLegendValueTypeMismatch` (post-data) | coberta-repo |
| `R-dup-dimension` | Two `mapData` on the same `mapId` need distinct `dimension`/`stateKey` | agent (Invariants) | `validateSpec` → `duplicate-dimension` | coberta-lib |
| `R-sqrt-continuous` | `sizeBy.transform:'sqrt'` only with `mode:'continuous'` | agent (Invariants) | `validateSpec` → `invalid-schema` | coberta-lib |
| `R-dangling-refs` | Dangling `sourceId`/`mapDataId` | agent ("everything else") | `validateSpec` → `unknown-source` / `unknown-map-data-id` | coberta-lib |
| `R-threshold-order` | Ascending thresholds | agent ("everything else") | `validateSpec` → `invalid-threshold-order` | coberta-lib |
| `R-sizeby-range` | `sizeBy.range` not inverted | agent ("everything else") | `validateSpec` → `invalid-size-range` | coberta-lib |
| `R-no-extra-props` | No property outside the schema | agent ("everything else") | `validateSpec` → `invalid-schema` | coberta-lib |
| `R-canonical-thresholds` | Official bands of IVS/CadInSAN/kitchens | `INSTRUCTIONS` | `applyCanonicalScales` rewrites | **normalizada** |
| `R-double-legend` | `proportionalCircles` with both auto **and** manual legend | agent (Invariants) | **nothing** — `validateSpec` returns `resolved` | **não-coberta** |
| `R-one-pass` | Do not re-read its own output to re-score | agent (Output rules) | not verifiable server-side | não-coberta |
| `R-mapdataid-real` | `mapDataId` is a real id, chosen by semantic match of the `description` | `INSTRUCTIONS` | none | semântica-essencial |
| `R-variable-choice` | Choose the variable that answers the question | `INSTRUCTIONS` | none | semântica-essencial |
| `R-coverage-read` | Read `spatial.coverage`/`temporal.status` before promising the map | `INSTRUCTIONS` | none | semântica-essencial |
| `R-label-ptbr` | Readable label in pt-BR | `INSTRUCTIONS` | none | semântica-essencial |
| `R-error-when-impossible` | Return `{"error"}` instead of guessing | agent + `INSTRUCTIONS` | none (only the grader) | semântica-essencial |
| `R-nodata-color` | `colorBy.defaultColor` is always the gray "no data" color | `INSTRUCTIONS` | `findForeignNoDataColor` | coberta-repo |
| `R-legend-arity` | Number of colors matches the number of bands | `INSTRUCTIONS` | `findLegendScaleArityMismatch` | coberta-repo |
| `R-active-legend-exists` | `activeLegendId` points to a declared legend | `INSTRUCTIONS` | `findDanglingActiveLegendId` | coberta-repo |
| `R-legend-property` | `colorBy.property` matches the join key | `INSTRUCTIONS` | `findLegendPropertyMismatch` | coberta-repo |
| `R-official-faixas` | Official index (IVS) uses the published bands, not Jenks | `INSTRUCTIONS` | `findReclassifiedOfficialIndex` | coberta-repo |
| `R-dotdensity-ratio` | `dotDensity` only over a rate, never over an absolute total | `INSTRUCTIONS` | `findDotDensityWithoutRatio` | coberta-repo |

## Reading for Step 4

25 of the 33 rules are deterministic enforcement (19 in the repo, 6 in the lib) and 1 is normalized by the route. In other words: **almost all of the "Invariants" and "Conditional requirements" sections of the agent's system prompt are redundant with code that already runs.** That is the obvious pruning target — but only after measuring, because redundant instruction may still lower the 422 rate and save a round-trip.

The 5 `semântica-essencial` rules are the irreducible core of `INSTRUCTIONS`: none of them can have a validator, and all of them live on the cozsolidarias side, not in the generic agent.

`R-double-legend` is the only real enforcement gap. It is cosmetic (two legends for one scale, not a wrong map), so the choice is: keep the line in the prompt, or write `findDuplicateLegendForSameVariable`. Decide in Step 5, not here.

## Observed in a real run (2026-09-18, control)

- **The ```` ```json ```` fence is tolerated.** The agent wraps the response in a code fence despite "Reply with **only** the JSON object. Nothing before, nothing after." This is not a violation of `R-json-only`: `route.ts` calls `stripCodeFence` before `JSON.parse`. The prompt line that forbids the fence is therefore a pruning candidate — but measure first: without it the model may start emitting prose alongside the JSON, which `stripCodeFence` does not rescue.
- **Typical latency ~43s, route ceiling 60s** (`MAX_POLL_ATTEMPTS=60` × `POLL_INTERVAL_MS=1000`, in `anthropicSession.ts`). The first call to a freshly created agent took 81s (cold start) and the route returned 502 — but the session on the server stayed `idle`, i.e. the agent finished. A 17s margin is narrow: any pruning that increases reasoning pushes cases into 502. Efficiency axis (d) must look at this, not only at tokens.

## Scope of this table

The agent side (`~/geovis-spec-generator.md`) is enumerated in full — every Output rule, every Resolution step, every Invariant. The `INSTRUCTIONS` side is enumerated up to the point where it has enforcement: every rule there that has a matching `findX` is here. What is **not** here are the `INSTRUCTIONS` rules that are purely editorial (the color ramps per variable family, the polygon border color, the `reference` format). They have no validator and are not irreducible semantics — they are visual convention, and the route rewrites much of it via `applyCanonicalScales`. Enumerating them only makes sense if a run shows the model getting them wrong.

Design note worth preserving: `instructions.ts` imports `NO_DATA_COLOR` from `specValidation.ts` and interpolates the constant into the instruction text. Instruction and validator cannot diverge because they read the same symbol. This is the pattern to follow whenever a prompt rule has a validator — and the reason `R-nodata-color` is only safe to prune from the text if the validator stays in place.
