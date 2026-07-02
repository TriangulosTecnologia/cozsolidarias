import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { createDataGateway } from 'src/data-gateway/createDataGateway';

describe('createDataGateway', () => {
  test('returns kitchens as a GeoJSON FeatureCollection from the default static source', async () => {
    const gateway = createDataGateway();

    const kitchens = await gateway.getCozinhas();

    expect(kitchens.type).toBe('FeatureCollection');
    expect(Array.isArray(kitchens.features)).toBe(true);
  });

  test('aggregates kitchens per municipality from the default static source', async () => {
    const gateway = createDataGateway();

    const byCity = await gateway.getCozinhasPorMunicipio();

    expect(Array.isArray(byCity)).toBe(true);
    expect(byCity.length).toBeGreaterThan(0);

    for (const entry of byCity) {
      expect(typeof entry.codigoIbge).toBe('string');
      expect(typeof entry.municipio).toBe('string');
      expect(entry.quantidade).toBeGreaterThan(0);
    }
  });

  test('throws on an unknown DATA_SOURCE', () => {
    const previous = process.env['DATA_SOURCE'];
    process.env['DATA_SOURCE'] = 'bogus';

    try {
      expect(() => {
        return createDataGateway();
      }).toThrow(/Unknown DATA_SOURCE/);
    } finally {
      if (previous === undefined) {
        delete process.env['DATA_SOURCE'];
      } else {
        process.env['DATA_SOURCE'] = previous;
      }
    }
  });
});

describe('createDataGateway.getNearbyPlaces', () => {
  const ID = 'CS999002';
  const DIR = join(
    process.cwd(),
    'src',
    'data-source-static',
    'data',
    'nearby',
    'osm'
  );
  const FILE = join(DIR, `${ID}.geojson`);

  beforeAll(async () => {
    await mkdir(DIR, { recursive: true });
    await writeFile(
      FILE,
      JSON.stringify({
        type: 'FeatureCollection',
        metadata: {
          provider: 'osm',
          cozinhaId: ID,
          center: { latitude: -30, longitude: -51 },
          radiusMeters: 3000,
          generatedAt: '2026-07-02T00:00:00.000Z',
          attribution: '© OpenStreetMap contributors',
          truncatedCategories: [],
        },
        features: [],
      }),
      'utf8'
    );
  });

  afterAll(async () => {
    await rm(FILE, { force: true });
  });

  test('returns the nearby contract for a valid cozinha', async () => {
    const gateway = createDataGateway();

    const result = await gateway.getNearbyPlaces({
      cozinhaId: ID,
      provider: 'osm',
    });

    expect(result.type).toBe('FeatureCollection');
    expect(result.metadata.cozinhaId).toBe(ID);
  });

  test('rejects an invalid cozinhaId (path traversal guard)', async () => {
    const gateway = createDataGateway();

    await expect(
      gateway.getNearbyPlaces({ cozinhaId: '../secrets', provider: 'osm' })
    ).rejects.toThrow(/Invalid cozinhaId/);
  });
});

describe('createDataGateway.getNearbyKitchens', () => {
  // A real kitchen code present in the CSV snapshot (Porto Alegre).
  const REAL_ID = 'CS014558';
  const DIR = join(
    process.cwd(),
    'src',
    'data-source-static',
    'data',
    'nearby',
    'osm'
  );
  const FILE = join(DIR, `${REAL_ID}.geojson`);
  // A snapshot whose code is not in the CSV — exercises the "skip unknown" path.
  const UNKNOWN_ID = 'CS999998';
  const UNKNOWN_FILE = join(DIR, `${UNKNOWN_ID}.geojson`);

  beforeAll(async () => {
    await mkdir(DIR, { recursive: true });
    const empty = JSON.stringify({ type: 'FeatureCollection', features: [] });
    await writeFile(FILE, empty, 'utf8');
    await writeFile(UNKNOWN_FILE, empty, 'utf8');
  });

  afterAll(async () => {
    await rm(FILE, { force: true });
    await rm(UNKNOWN_FILE, { force: true });
  });

  test('joins available snapshots with kitchen name and coordinates', async () => {
    const gateway = createDataGateway();

    const kitchens = await gateway.getNearbyKitchens();
    const entry = kitchens.find((kitchen) => {
      return kitchen.codigo === REAL_ID;
    });

    expect(entry).toBeDefined();
    expect(entry?.municipio).toBe('Porto Alegre');
    expect(typeof entry?.latitude).toBe('number');
    expect(typeof entry?.longitude).toBe('number');
  });

  test('skips snapshots whose code is not in the CSV', async () => {
    const gateway = createDataGateway();

    const kitchens = await gateway.getNearbyKitchens();

    expect(
      kitchens.find((kitchen) => {
        return kitchen.codigo === UNKNOWN_ID;
      })
    ).toBeUndefined();
  });
});
