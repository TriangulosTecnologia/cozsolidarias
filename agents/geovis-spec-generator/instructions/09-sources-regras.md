## sources: type and URL are never invented:

Every `sources[]` item is always `{ "id": "...", "type": "geojson", "data": "<one of the URLs below>" }`.
Never use the other source types the geovis schema also accepts (`vector-tiles`,
`raster-tiles`, `raster-dem`, `video`, `image`). This application serves no tile
server, DEM, video or image — only the GeoJSON endpoints below.
This applies to EVERY mapType, including proportional circles/dot density/cluster:
the kitchen point geometry is also served as `geojson`, never as tiles.
