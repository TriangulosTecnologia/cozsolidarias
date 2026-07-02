# nearby (Minha Cozinha experiment data)

Per-provider nearby-POI snapshots, one GeoJSON per kitchen, read by
`readStaticNearbyPlaces` and served through the gateway's `getNearbyPlaces`.

```
nearby/
  osm/<cozinhaId>.geojson      committed (ODbL, © OpenStreetMap contributors)
  google/<cozinhaId>.geojson   gitignored (Google Places ToS: do not store/publish)
```

Generate/refresh with `scripts/minha-cozinha-nearby` (the fetchers write straight
into these folders). This dataset is part of the throwaway OSM-vs-Google
comparison and will be pruned to the chosen provider afterwards.
