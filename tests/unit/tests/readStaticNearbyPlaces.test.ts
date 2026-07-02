import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  listStaticNearbyCozinhaIds,
  readStaticNearbyPlaces,
} from 'src/data-source-static/readStaticNearbyPlaces';

const DIR = join(
  process.cwd(),
  'src',
  'data-source-static',
  'data',
  'nearby',
  'osm'
);
const ID = 'CS999001';
const FILE = join(DIR, `${ID}.geojson`);

describe('readStaticNearbyPlaces', () => {
  beforeAll(async () => {
    await mkdir(DIR, { recursive: true });
    await writeFile(
      FILE,
      JSON.stringify({ type: 'FeatureCollection', features: [] }),
      'utf8'
    );
  });

  afterAll(async () => {
    await rm(FILE, { force: true });
  });

  test('reads and parses an existing snapshot', async () => {
    const raw = await readStaticNearbyPlaces({
      provider: 'osm',
      cozinhaId: ID,
    });

    expect(raw.type).toBe('FeatureCollection');
  });

  test('throws a clear error when the snapshot is missing', async () => {
    await expect(
      readStaticNearbyPlaces({ provider: 'osm', cozinhaId: 'CS000404' })
    ).rejects.toThrow(/not found/);
  });

  test('lists the cozinha ids present for a provider', async () => {
    const ids = await listStaticNearbyCozinhaIds('osm');

    expect(ids).toContain(ID);
  });

  test('returns an array (empty when the provider folder is absent)', async () => {
    const ids = await listStaticNearbyCozinhaIds('google');

    expect(Array.isArray(ids)).toBe(true);
  });
});
