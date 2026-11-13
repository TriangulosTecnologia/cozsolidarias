# Step 1 — what to prune, per source, with a justification per item

Basis: `references/determinism-map.md` (33 rules, 25 with deterministic enforcement), measured on
2026-09-18 against HEAD `4da685dd` and `@ttoss/geovis@0.21.1`.

Size of the two sources, per request:

| Source | Approx. tokens | Nature |
|---|---|---|
| `~/geovis-spec-generator.md` (`system:` block) | ~3,577 | fixed in the agent, enters every turn |
| `INSTRUCTIONS` (static text) | ~4,640 | per request, plus the interpolated tables |

## Conclusion that reverses the premise: `INSTRUCTIONS` is not a pruning target

The skill was designed on the assumption that a rule covered by a validator is fat in the prompt. For the
`INSTRUCTIONS` side this premise is **explicitly rejected in the code itself** (`instructions.ts`, module
docstring):

> *Rules that a deterministic check in `specValidation.legends.ts` (or its sibling modules)
> already rejects are still stated here: the check turns a violation into a 422 the user has to
> retry, while the instruction stops the violation from happening. They are two halves of one
> rule, never a duplication to prune on one side alone.*

This is not an unstated convention that can be reinterpreted: it is a written decision, with its reason
attached. The argument is about UX, not correctness — every pruned rule that the model violates becomes a
422 that the user has to absorb by rephrasing the request. Proposing pruning here requires **eval evidence
against a declared decision**, not a reading of redundancy. Three additional reasons, verified:

1. **Already minimal per rule.** Almost every rule occupies one table row. There is no redundant paragraph
   to cut — only whole rules, and cutting a whole rule is what the docstring forbids.
2. **Cannot diverge from the code.** `instructions.ts` imports `NO_DATA_COLOR`, `buildSourcesTable()` and
   `buildCanonicalScalesTable()` and interpolates the values into the text. The sources table and the
   canonical scales table *are* the validator's, not copies. This pattern should be replicated, not pruned.
3. **Already handles the catalog traps.** The section "what each mapDataId actually paints" exists exactly
   because the `description` of `municipios_ivs` promises IDHM and sub-indices that
   `RENDERABLE_DATASET_FETCHERS` does not serve. The divergence is known and mitigated.

**A real defect, independent of pruning:** the "sources" section states *"this application does not serve a
tile server"*. This is false — production serves `/tiles/caf-h3-r{3,4,5,6}/{z}/{x}/{y}.pbf` in `cafs` mode.
The policy (restricting the agent to geojson) remains correct; the justification is wrong and must be
rewritten to what actually holds: *these URLs are assembled by the map builder and are not exposed to the
agent, so any non-geojson type in the response is an invented URL.*

## Real target: the agent's system prompt

42% of it (~1,499 tokens) is schema dump. The cuts below, in order of risk.

### Tier 1 — safe cut (the route forbids or rejects what the section enables)

| Item | Tokens | Why it is safe |
|---|---|---|
| GeoJSON `$defs` (`Position`, `LinearRing`, `Point`…`FeatureCollection`) | ~551 | The agent never emits inline geometry: `INSTRUCTIONS` forbids it, `findGeometryInMapData` rejects `mapData.data` as a `FeatureCollection`, and `findInvalidGeojsonSource` rejects an empty `FeatureCollection` in `sources`. Documenting how to write a `Polygon` enables only what the route refuses. |
| Source type enum (`vector-tiles`, `raster-tiles`, `image`, `raster-dem`, `video`) | ~30 | `findUnsupportedSourceType` rejects all of them. Listing them teaches five ways to get a 422. Reducing the enum to `geojson` removes the temptation at the source. |

### Tier 2 — probable cut, decide by eval

| Item | Tokens | Tension |
|---|---|---|
| Paragraph *"Everything else the consumer already rejects by name"* | ~108 | Lists the deterministic mesh and **admits its own uselessness**: *"Getting them right saves a round trip; restating them to yourself does not."* Against the cut: it is the only place that tells the agent the mesh exists, which may change how it handles uncertainty. |
| `LabelFormatSpec` variants (`count`, `percentage`, `stdDev`, `custom`) | ~180 | `applyCanonicalScales` rewrites the `labelFormat` of the active legend. Only the `labels` variant survives on a known dataset. Against the cut: a legend for a dataset outside the canonical table is not rewritten. |
| `NormalizationSpec` variants | ~120 | Same logic. |
| `control`, `viewPresets`, `adapterHints` | ~200 | No agent spec needs them — production assembles `control` by hand in `buildSpec`. Against the cut: no validator rejects them if the agent emits them, and a request for "layer control" would lose its vocabulary. |

### Tier 3 — do not cut

- **`Invariants`.** Contains `R-double-legend`, the only one of the 33 rules **with no validator at all**
  (`validateSpec` returns `resolved` — verified, see `scripts/probe_validate_spec.mjs`). Cutting that line
  removes the only defense that exists.
- **`Output rules`** and steps 1–4 of `Resolution instructions`. They are the output contract and the
  semantic judgment; nothing else covers them.

### Defect to fix before any measurement

The `sizeBy` block (lines ~76–91) has corrupted text — line breaks in the middle of words (`array<numb\ner>`,
`Min an\nd max symbol sizes`, `mode: enum ['continuous', 's\ntepped']`). This is text the model reads, in a
field that governs `R-sqrt-continuous` and `R-sizeby-range`. Fix it **before** running the first variant:
measuring pruning against a corrupted control measures the corruption, not the pruning.

## Design of the first campaign

Control `atual-sem-poda` is mandatory. Variants, in order:

1. `agente-tier1` — only the safe cuts. Hypothesis: no regression on the gate, ~580 fewer tokens.
2. `agente-tier1+2` — adds the Tier 2 items. Hypothesis: this is where the gate starts to flag, if it does.
3. `instructions-tile-fix` — corrects the false statement without pruning anything. Not a pruning variant: it
   is a control showing that a factual correction does not move the needle, which validates the instrument itself.

No variant on the `INSTRUCTIONS` side beyond 3 until a round produces evidence against the docstring.
