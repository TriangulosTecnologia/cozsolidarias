# AI Spec Route (`src/app/api/ai/spec/`)

`POST /api/ai/spec` (the `/ia` playground) lets the agent reference only datasets listed in `RENDERABLE_DATASET_FETCHERS` (`mapDataCatalogue.ts`). Catalogued datasets that are not there are visible to the agent as "not renderable" and are answered with an error. Rules for the layer boundary live in [`src/app/CLAUDE.md`](../../../CLAUDE.md).

## Adding a renderable dataset

Source of truth for what exists: `public/dataset_catalogue.json`. A catalogued dataset is a valid candidate; no extra approval list gates it.

1. **Read the catalogue entry** — `id`, `schema.fields` (name, unit, description), `spatial.grain`, `spatial.coverage`. The route paints municipality-grain values only.
2. **Reach the data through the gateway** — add or reuse a `gateway.get*` member (see [`src/data-gateway/CLAUDE.md`](../../../data-gateway/CLAUDE.md)). Never read files or sources from the route.
3. **Register the fetcher** in `RENDERABLE_DATASET_FETCHERS`:
   - One id per painted value. Reuse `toMapDataRows(rows, pick)`; return `null` from `pick` for "sem dado" (never `0`).
   - A ratio gets its own id (e.g. one id per base: per 10 mil and per 100 mil are two ids), named after the measure, `snake_case`.
   - Ids that paint one field of a shared catalogue dataset also need a `CATALOGUE_VARIANTS` entry (`datasetId`, `fieldName`, optional `note` stating scale direction, optional `officialFaixas`).
4. **Classify the value kind** — an absolute total goes in `ABSOLUTE_TOTALS` (so `findChoroplethOnAbsoluteTotal` rejects a choropleth over it); counts in `COUNTS`; rates and shares need nothing.
5. **Official scales** — only for indexes with published bands (IVS, IDHM): set `officialFaixas`, so `applyCanonicalScales` and `findReclassifiedOfficialIndex` apply. Everything else keeps free scales.
6. **Variants a prompt can tell apart** — add the id to a `FAMILIES` entry in `datasetFamilies.ts` (`keyword`, `defaultId`, `match`) so the preflight can pick between them. Keep `match` regexes over the accent-stripped, lower-cased prompt.
7. **Proxies** — only if a vague concept should resolve to the dataset (`PROXIES` in `catalogueFeedback.ts`); otherwise skip.
8. **Agent instructions** — if the dataset needs a rule the validators cannot enforce, edit `agents/geovis-spec-generator/instructions/` and `instructions/instructions.ts` together; they are two sources of one prompt. Prefer a validator in `specValidation.ts` / `candidateValidation.ts` over prose.

## Verify

- Unit test: the fetcher maps gateway rows to `{ geometryId, value }` and drops `null`s (`tests/unit/tests/aiSpecRoute.test.ts` is the nearest home).
- Eval: add a case to `.claude/skills/geovis-spec-gate-optimizer/evals/evals.json`; its fields are described in the file's `notes`. Remove the case's "to be added" rubric caveat once the fetcher lands.
- Run the quality gates from the root `CLAUDE.md`.

## Do not

- Declare `runtime = 'edge'` (the gateway needs Node).
- Hand-write geometry or `mapData` rows in specs: `appendRealMapData` replaces the agent's placeholder `data` with the fetcher's rows.
- Add an id the catalogue does not back, or paint a field marked `sensitive`.
