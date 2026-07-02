# minha-cozinha-nearby (throwaway experiment)

Generates the "surroundings" data for the future **Minha Cozinha** page: for each
sample kitchen it fetches nearby points of interest (POIs) within 3 km and writes
one app-ready GeoJSON per kitchen per provider.

The goal is to **compare OpenStreetMap vs Google Places** coverage across dense
capitals and small interior towns, then decide which provider to keep. This whole
folder is isolated from the app's quality gates and is expected to be deleted once
the decision is made.

## Layout

```
kitchens.ts     10 sample kitchens (5 regions, capital + interior each)
crosswalk.ts    domain category -> OSM tags / Google place types (CRAS excluded)
geo.ts          haversine, ring bucketing, GeoJSON shapes, output writer
fetch-osm.ts    Overpass -> src/data-source-static/data/nearby/osm/<codigo>.geojson
fetch-google.ts Places (New) -> src/data-source-static/data/nearby/google/<codigo>.geojson
```

Output goes straight into the static source the app reads (`data/nearby/<provider>/`).

## Running

```bash
# OpenStreetMap — no key required
node scripts/minha-cozinha-nearby/fetch-osm.ts

# Google — copy .env.example to .env.local and set GOOGLE_MAPS_API_KEY first
node --env-file=scripts/minha-cozinha-nearby/.env.local \
  scripts/minha-cozinha-nearby/fetch-google.ts
```

Runs on Node 22.18+ (native TypeScript type stripping); no build step. The folder's
`package.json` (`"type": "module"`) scopes ESM here so `.ts` files use normal
`import`/top-level `await`.

## Licence — important

- **OSM** output is ODbL: fine to commit. Attribution: `© OpenStreetMap contributors`.
- **Google** output must **not** be cached long-term, committed, or published (only
  `place_id` may be stored). `data/nearby/google/` is gitignored; keep it local.

## Output shape

A GeoJSON `FeatureCollection` of `Point`s, servable straight to `@ttoss/geovis`, plus
a top-level `metadata` member (provider, kitchen, center, radius, attribution,
`truncatedCategories`). Each feature carries `category`, `sourceType`,
`distanceMeters` and `ring` (500 | 1500 | 3000) in `properties`.

Google Nearby Search caps at 20 results per request; a category that hits the cap is
listed in `metadata.truncatedCategories` — its count is a floor, not an exact total.
