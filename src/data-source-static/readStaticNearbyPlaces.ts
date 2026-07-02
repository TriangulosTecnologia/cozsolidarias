import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { StaticNearbyPlacesSource } from './types';

/** Root of the per-provider nearby snapshots (`<provider>/<cozinhaId>.geojson`). */
const NEARBY_DIR = join(
  process.cwd(),
  'src',
  'data-source-static',
  'data',
  'nearby'
);

/**
 * Reads a raw nearby-POI snapshot for one cozinha under one provider.
 *
 * Server-only: reads from disk with `fs`. Returns the parsed file untouched
 * (source-native); validation and narrowing happen in the gateway transformer.
 * Fails loudly when the snapshot is missing.
 *
 * @param params - `provider` (`osm` | `google`) and `cozinhaId` (e.g. `CS014558`).
 * @returns The parsed snapshot as {@link StaticNearbyPlacesSource}.
 * @throws If the snapshot file does not exist.
 *
 * @example
 * const raw = await readStaticNearbyPlaces({ provider: 'osm', cozinhaId: 'CS014558' });
 * raw.features.length; // number of POIs in the snapshot
 */
export const readStaticNearbyPlaces = async (params: {
  provider: 'osm' | 'google';
  cozinhaId: string;
}): Promise<StaticNearbyPlacesSource> => {
  const path = join(NEARBY_DIR, params.provider, `${params.cozinhaId}.geojson`);

  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch {
    throw new Error(
      `[data-source-static] nearby snapshot not found: ${params.provider}/${params.cozinhaId}.geojson. ` +
        `Generate it with scripts/minha-cozinha-nearby.`
    );
  }

  return JSON.parse(raw) as StaticNearbyPlacesSource;
};
