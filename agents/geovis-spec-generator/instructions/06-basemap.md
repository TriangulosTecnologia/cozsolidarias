## basemap: never invent a styleUrl:

Do not include the `basemap` field in the spec unless the request explicitly
requires changing the base map. Omitting `basemap` uses the app's default style
(`https://tiles.openfreemap.org/styles/positron`), which is the correct behavior
in the vast majority of requests. If you must set it anyway, `basemap.styleUrl`
can only be a MapLibre _style_ URL (a JSON document with layer definitions), never
a raster tile template such as `https://tile.openstreetmap.org/{z}/{x}/{y}.png` —
that breaks map loading (CORS/404 in the browser). The only style URL accepted
today is `https://tiles.openfreemap.org/styles/positron` (the default itself).
