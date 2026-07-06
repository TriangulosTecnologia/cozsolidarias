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
      // Population and the derived rate join from the Census snapshot; both are
      // nullable when a município is missing from it.
      expect(
        entry.populacao === null || typeof entry.populacao === 'number'
      ).toBe(true);
      expect(
        entry.porCemMil === null || typeof entry.porCemMil === 'number'
      ).toBe(true);
    }

    // At least one município joins a population and yields a positive rate.
    expect(
      byCity.some((entry) => {
        return entry.porCemMil !== null && entry.porCemMil > 0;
      })
    ).toBe(true);
  });

  test('returns one bubble Point feature per municipality from the default static source', async () => {
    const gateway = createDataGateway();

    const bubbles = await gateway.getCozinhasBubbles();

    expect(bubbles.type).toBe('FeatureCollection');
    expect(bubbles.features.length).toBeGreaterThan(0);

    for (const feature of bubbles.features) {
      expect(feature.geometry.type).toBe('Point');
      expect(typeof feature.properties.codarea).toBe('string');
      expect(feature.properties.quantidade).toBeGreaterThan(0);
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
