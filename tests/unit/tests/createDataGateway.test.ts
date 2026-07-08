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
      // Every município carries its share (%) of Brazil's cozinhas, derived
      // from the national total — always a positive number here (quantidade ≥ 1).
      expect(typeof entry.percentualDoBrasil).toBe('number');
      expect(entry.percentualDoBrasil).toBeGreaterThan(0);
      // CadÚnico registrations and their derived metrics join from the MDS/SAGI
      // snapshot; all three are nullable when a município is missing from it.
      expect(
        entry.pessoasCadUnico === null ||
          typeof entry.pessoasCadUnico === 'number'
      ).toBe(true);
      expect(
        entry.porDezMilCadUnico === null ||
          typeof entry.porDezMilCadUnico === 'number'
      ).toBe(true);
      expect(
        entry.pessoasPorCozinha === null ||
          typeof entry.pessoasPorCozinha === 'number'
      ).toBe(true);
    }

    // At least one município joins a population and yields a positive rate.
    expect(
      byCity.some((entry) => {
        return entry.porCemMil !== null && entry.porCemMil > 0;
      })
    ).toBe(true);

    // At least one município joins the CadÚnico snapshot and yields a positive rate.
    expect(
      byCity.some((entry) => {
        return entry.porDezMilCadUnico !== null && entry.porDezMilCadUnico > 0;
      })
    ).toBe(true);

    // The shares add up to ~100% of what the choropleth paints. The tolerance is
    // wide because rounding each of ~870 shares to two decimals — many just above
    // 0.019% → 0.02% — systematically drifts the sum a percent or so above 100.
    const totalShare = byCity.reduce((sum, entry) => {
      return sum + entry.percentualDoBrasil;
    }, 0);
    expect(totalShare).toBeGreaterThan(97);
    expect(totalShare).toBeLessThan(103);
  });

  test('returns the same canonical rows across repeated calls (snapshots are memoized)', async () => {
    const gateway = createDataGateway();

    const first = await gateway.getCozinhasPorMunicipio();
    const second = await gateway.getCozinhasPorMunicipio();

    // The population and CadÚnico snapshots are cached for the process lifetime,
    // so a second read returns the cached map and the projection is identical.
    expect(second).toEqual(first);
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
