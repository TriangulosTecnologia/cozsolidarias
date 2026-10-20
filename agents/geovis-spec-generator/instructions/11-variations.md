## Resolution per variation — minimal spec

Always start from the map request. The rules below are the default when the request
says otherwise; an explicit user request takes precedence over them.

### Minimum required

- Include only what the request needs to render the requested variable and its legend.
- Every `sources[]` item is used by at least one layer; every `mapData[]` is linked by at
  least one layer (`mapDataId`); every `legends[]` is pointed to by an `activeLegendId`.
  Nothing orphaned.
- Never include an invisible layer (`visible: false`) or a layer "for later": if the
  request does not show it, the spec does not have it.
- Omit `view`, `viewPresets`, `control`, `basemap`, `paint`, `transition`, `click`,
  `hoverTooltip`, `title` and `description` when the request does not ask for them —
  the app applies its defaults.

### Default sources

- Painted area: `/geo/geojs-100-mun.json` (municipalities, join by `codarea`). It is the
  default for every municipal variable.
- Outline: `/geo/estados.json`, only as a context line, never painted, without `mapDataId`
  and without its own legend. Include it when the request mentions states/UF or when the
  variation is about settlements.
- Exception — settlements: the geometry is `/geo/assentamentos.json` and the relevant
  outline granularity is the state, so use `/geo/estados.json` as the outline and do not
  include the municipality mesh.

### Kitchens: points × bubbles

- `/api/cozinhas` — one point per kitchen, at the kitchen's own location. Use it for
  requests about location, "where they are", and each kitchen's status/operation.
- `/api/cozinhas/bolhas` — one circle per municipality, with the number of kitchens in
  that municipality. Use it for requests about quantity per municipality
  (`proportionalCircles`).
- Never use bubbles for a request about kitchen locations, nor points for a request about
  quantity per municipality. Do not include both in the same spec unless the request asks
  for both.

### Dataset choice

1. Identify the institutional collection whose theme covers the request
   (`collections[].description`, when present in the catalogue). The collection is decision
   context — it never goes into the spec.
2. Within it, choose the dataset whose `description` (and `fields[].description`) matches
   the requested variable. E.g., a request about social vulnerability → IPEA collection →
   `municipios_ivs`.
3. Support datasets that the app uses in tooltips or as denominators (`municipios_nomes`,
   `municipios_populacao`, `municipios_cadunico`) are not renderable: they never go into
   `mapData` — the server rejects them (`unsupported-dataset`) and the app already resolves
   name/population in the tooltip.
4. `mapData[].mapDataId` is always an id from `renderableDatasets`.
