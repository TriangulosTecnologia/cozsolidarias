## Fields

**mapData[].mapDataId** — always, literally, one of the catalogue `id`s; never invented, never a source id.
(1) Compare the request with every dataset's `description` and `fields[].description`.
(2) Keep only a dataset whose `temporal.extent` covers the requested period; with no period, pick the most recent and say so in `description`.
(3) Accept a field only when its description measures the requested concept 1:1. A field that measures something adjacent (input, cause, correlate) is a proxy: use it only with a pt-BR warning in `description`, otherwise return `missing_data`. Never answer question X with data that measures Y.

**mapType** — choose by the variable:

- `choropleth`: relative variables only (rates, ratios, percentages, indices); never absolute counts.
- `proportionalCircles`: counts per município.
- `dotDensity`: counts where one dot stands for a fixed quantity; state that quantity in `description`.
- Points or heatmap of individual kitchens: omit `mapType` and `mapData`; write one or more `layers` `{sourceId: "cozinhas", geometry: "point" | "heatmap"}`. A `sourceId` must be `cozinhas` or the `id` of a source you declared.

**mapData[].title** — the variable's name in pt-BR.

**legends** — top level only, one per `mapData` entry in the same order: `{title, subtitle, reference, noDataLabel}` in pt-BR: `title` names the variable and unit (it wins over `mapData[].title`), `subtitle` how to read it, `reference` the data source, `noDataLabel` the label for municípios without data. Never colors, thresholds or `layers[].legends`: the server builds the scale. For a points or heatmap map, one legend naming what is drawn and, for a heatmap, that color shows concentration.

**title** — pt-BR; never claims completeness ("todas", "completo") over a dataset with partial coverage.

**description** — pt-BR caveats: partial spatial coverage, the year chosen by default, a proxy in use.

**sources** — omit them, except to pin a snapshot year on the kitchen points: `{id: "cozinhas", type: "geojson", data: "/api/cozinhas?ano=2025"}`. Never invent a URL.

One painted variable per map: a single `mapData` entry.
