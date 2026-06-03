import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { GeoJSONFeatureCollection } from '@ttoss/geovis';

/**
 * Same file the map fetches from the browser (`/geo/municipios-sp.json`), read
 * here from disk so the server can run point-in-polygon against it.
 */
const GEOJSON_PATH = join(process.cwd(), 'public', 'geo', 'municipios-sp.json');

let cache: GeoJSONFeatureCollection | null = null;

/**
 * Reads and parses the SP municipalities GeoJSON snapshot.
 *
 * Server-only: reads from disk with `fs`, so it must be called from a Server
 * Component, route handler or other server context. The parsed result is
 * memoized for the lifetime of the process.
 *
 * @returns The municipalities `FeatureCollection` (645 SP municípios, keyed by
 * `properties.codarea`).
 */
export const readStaticMunicipiosSp =
  async (): Promise<GeoJSONFeatureCollection> => {
    if (cache) {
      return cache;
    }

    const raw = await readFile(GEOJSON_PATH, 'utf8');
    cache = JSON.parse(raw) as GeoJSONFeatureCollection;

    return cache;
  };
