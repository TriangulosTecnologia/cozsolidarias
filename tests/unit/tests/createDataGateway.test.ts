import { createDataGateway } from 'src/data-gateway/createDataGateway';
import { readStaticCafProducao } from 'src/data-source-static/readStaticCafProducao';
import { readStaticCozinhas } from 'src/data-source-static/readStaticCozinhas';

describe('createDataGateway', () => {
  test('returns kitchens as a GeoJSON FeatureCollection from the default static source', async () => {
    const gateway = createDataGateway();

    const kitchens = await gateway.getCozinhas();

    expect(kitchens.type).toBe('FeatureCollection');
    expect(Array.isArray(kitchens.features)).toBe(true);
  });

  test('returns the detail of an existing cozinha by its registration code', async () => {
    const gateway = createDataGateway();
    // Read a real code from the source so the test survives snapshot churn.
    const [first] = await readStaticCozinhas();

    const detail = await gateway.getCozinhaByCodigo(first.codigo);

    expect(detail).not.toBeNull();
    expect(detail?.codigo).toBe(first.codigo);
    expect(detail?.nome).toBe(first.nome);
    expect(detail?.municipio).toBe(first.municipio);
  });

  test('returns null when no cozinha carries the given code', async () => {
    const gateway = createDataGateway();

    expect(await gateway.getCozinhaByCodigo('__no_such_code__')).toBeNull();
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

  test('returns one IVS row per município with a valid score from the default static source', async () => {
    const gateway = createDataGateway();

    const ivs = await gateway.getIvsPorMunicipio();

    expect(Array.isArray(ivs)).toBe(true);
    expect(ivs.length).toBeGreaterThan(0);

    for (const entry of ivs) {
      expect(typeof entry.codigoIbge).toBe('string');
      expect(entry.codigoIbge).not.toBe('');
      expect(typeof entry.municipio).toBe('string');
      // The index is defined on the closed interval [0, 1].
      expect(entry.ivs).toBeGreaterThanOrEqual(0);
      expect(entry.ivs).toBeLessThanOrEqual(1);
    }
  });

  test('returns CAF areas as a GeoJSON FeatureCollection from the default static source', async () => {
    const gateway = createDataGateway();

    const cafs = await gateway.getCafs();

    expect(cafs.type).toBe('FeatureCollection');
    expect(cafs.features.length).toBeGreaterThan(0);
    expect(cafs.features[0].geometry.type).toBe('Point');
  });

  test('returns the production detail of an existing CAF by its number', async () => {
    const gateway = createDataGateway();
    // Read a real nrCaf from the source so the test survives snapshot churn.
    const [first] = await readStaticCafProducao();

    const detail = await gateway.getCafByNrCaf(first.nrCaf);

    expect(detail).not.toBeNull();
    expect(detail?.nrCaf).toBe(first.nrCaf);
    expect(detail?.producao.length).toBeGreaterThan(0);
  });

  test('returns null when no CAF carries the given number', async () => {
    const gateway = createDataGateway();

    expect(await gateway.getCafByNrCaf('__no_such_caf__')).toBeNull();
  });

  test('aggregates CAFs per município with their share of Brazil from the default static source', async () => {
    const gateway = createDataGateway();

    const byCity = await gateway.getCafsPorMunicipio();

    expect(Array.isArray(byCity)).toBe(true);
    expect(byCity.length).toBeGreaterThan(0);

    for (const entry of byCity) {
      expect(typeof entry.codigoIbge).toBe('string');
      expect(entry.codigoIbge).not.toBe('');
      expect(typeof entry.municipio).toBe('string');
      expect(entry.quantidade).toBeGreaterThanOrEqual(0);
      // Every município carries its share (%) of Brazil's CAFs, derived from
      // the national total (sum of the snapshot counts).
      expect(typeof entry.percentualDoBrasil).toBe('number');
      expect(entry.percentualDoBrasil).toBeGreaterThanOrEqual(0);
    }

    // At least one município has CAFs and a positive share.
    expect(
      byCity.some((entry) => {
        return entry.quantidade > 0 && entry.percentualDoBrasil > 0;
      })
    ).toBe(true);

    // The shares add up to ~100% of what the choropleth paints. Six-decimal
    // rounding over ~5.5k municípios keeps the sum tight around 100.
    const totalShare = byCity.reduce((sum, entry) => {
      return sum + entry.percentualDoBrasil;
    }, 0);
    expect(totalShare).toBeGreaterThan(99);
    expect(totalShare).toBeLessThan(101);
  });

  test('returns CADINSAN food-insecurity shares per município from the default static source', async () => {
    const gateway = createDataGateway();

    const byCity = await gateway.getCadinsanPorMunicipio();

    expect(Array.isArray(byCity)).toBe(true);
    expect(byCity.length).toBeGreaterThan(5000);

    for (const entry of byCity) {
      expect(typeof entry.codigoIbge).toBe('string');
      expect(entry.codigoIbge).not.toBe('');
      expect(entry.absolutoSemPbf).toBeGreaterThanOrEqual(0);
      expect(entry.cadastrosCadunico).toBeGreaterThanOrEqual(0);
      // The share is null only when there is no CadÚnico denominator.
      if (entry.cadastrosCadunico === 0) {
        expect(entry.proporcaoSemPbf).toBeNull();
      } else {
        expect(typeof entry.proporcaoSemPbf).toBe('number');
      }
    }

    // Spot-check a known município (Altamira/PA) against the source CSV row.
    const altamira = byCity.find((entry) => {
      return entry.codigoIbge === '1500602';
    });
    expect(altamira?.absolutoComPbf).toBe(2616);
    expect(altamira?.absolutoSemPbf).toBe(5779);
    expect(altamira?.cadastrosCadunico).toBe(14656);
    expect(altamira?.proporcaoSemPbf).toBe(39.43);
  });

  test('returns the data catalogue, redacted, from the default static source', async () => {
    const gateway = createDataGateway();

    const catalogue = await gateway.getCatalogue();

    expect(catalogue.meta.title).toBe(
      'Catálogo de Dados — Cozinhas Solidárias'
    );
    expect(catalogue.datasets).toHaveLength(12);
    for (const dataset of catalogue.datasets) {
      expect(dataset.source.title).not.toBe('');
      expect(Array.isArray(dataset.fields)).toBe(true);
    }
    // The contract carries no origin URL, repository path or checksum, so the
    // app cannot leak them regardless of how a component renders it.
    expect(JSON.stringify(catalogue)).not.toMatch(
      /https?:\/\/|sha256:|src\/data-source-static/
    );
  });

  test('re-reads the catalogue per call so a hand edit needs no restart', async () => {
    const gateway = createDataGateway();

    const first = await gateway.getCatalogue();
    const second = await gateway.getCatalogue();

    expect(second).not.toBe(first);
    expect(second).toEqual(first);
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
