import {
  datasetsForMode,
  fetchMapDataset,
} from 'src/app/(features)/mapas/mapBootstrap';

const CAF_UF_POINTS = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-40.76, -12.34] },
      properties: { nome: 'Bahia', quantidade: 712_480 },
    },
  ],
};

afterEach(() => {
  jest.restoreAllMocks();
});

describe('fetchMapDataset', () => {
  test('fetches one snapshot per key, parsed', async () => {
    global.fetch = jest.fn(() => {
      return Promise.resolve({
        json: () => {
          return Promise.resolve(CAF_UF_POINTS);
        },
      } as Response);
    }) as jest.Mock;

    // The UF anchors are fetched by the app rather than left to the map source,
    // so the `cafs` hover join reads the same numbers its labels draw.
    expect(await fetchMapDataset('cafPontosPorUf')).toEqual(CAF_UF_POINTS);
    expect(global.fetch).toHaveBeenCalledWith('/api/cafs/pontos-por-uf');

    await fetchMapDataset('cadinsanByCity');
    expect(global.fetch).toHaveBeenCalledWith('/api/cadinsan/por-municipio');
  });

  /*
   * The rejection is the contract: it is what releases the sidebar menus the
   * pick locked, and what leaves the previous mode's paint on the map. A
   * `catch` here would resolve with nothing and repaint everything as "sem
   * dado" instead.
   */
  test('rejects instead of resolving empty when the request fails', async () => {
    global.fetch = jest.fn(() => {
      return Promise.reject(new Error('offline'));
    }) as jest.Mock;

    await expect(fetchMapDataset('ivs')).rejects.toThrow('offline');
  });
});

describe('datasetsForMode', () => {
  test('every mode carries the base pair the fill and its tooltip read', () => {
    expect(datasetsForMode('coropletico')).toEqual(['data', 'nomes']);
    expect(datasetsForMode('pontos')).toEqual(['data', 'nomes']);
    expect(datasetsForMode('circulos')).toEqual(['data', 'nomes']);
  });

  test('a mode adds only the snapshot it paints from', () => {
    expect(datasetsForMode('coropletico-cafs-percentual')).toContain(
      'cafsByCity'
    );
    expect(datasetsForMode('coropletico-cadinsan-sem-pbf')).toContain(
      'cadinsanByCity'
    );
    expect(datasetsForMode('coropletico-ivs-capital-humano')).toContain('ivs');
    expect(datasetsForMode('coropletico-idhm-educacao')).toContain('ivs');
    expect(datasetsForMode('assentamentos')).toContain('settlements');

    // Nothing bleeds across: the IVS family never pulls the CAF or CADINSAN
    // snapshots, which is the whole point of splitting the mount fetch.
    expect(datasetsForMode('coropletico-ivs')).not.toContain('cafsByCity');
    expect(datasetsForMode('coropletico-ivs')).not.toContain('cadinsanByCity');
  });

  /*
   * The CAF mode reads two: `cafPontosPorUf` joins the country level, and the
   * município tooltip under it reports that município's own CAF count.
   */
  test('the CAF hierarchy needs the UF anchors and the per-município counts', () => {
    expect(datasetsForMode('cafs')).toEqual([
      'data',
      'nomes',
      'cafPontosPorUf',
      'cafsByCity',
    ]);
  });
});
