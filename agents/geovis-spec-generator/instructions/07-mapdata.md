## mapData is never geometry:

`mapData` carries only join values, indexed by `geometryId` — never the base
geometry. The municipality geometry already exists as public GeoJSON at
`/geo/geojs-100-mun.json` (join property: `codarea`); reference it in `sources`,
never in `mapData`.

A `mapData[].mapDataId` must never repeat a source's `id`, and `mapData[].data`
must never be a `FeatureCollection`.
