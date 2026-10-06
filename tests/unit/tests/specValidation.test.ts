import {
  buildCatalogueContext,
  officialFaixasOf,
  RENDERABLE_DATASET_IDS,
} from 'src/app/api/ai/spec/mapDataCatalogue';
import {
  appendRealMapData,
  appendRealSourceData,
  buildSourcesTable,
  errorResponse,
  findGeometryInMapData,
  findInvalidBasemapStyleUrl,
  findInvalidGeojsonSource,
  findMissingLegend,
  findReclassifiedOfficialIndex,
  hoistLayerLegends,
  invalidSpecResponse,
  isRecord,
  KNOWN_BASEMAP_STYLE_URLS,
  KNOWN_SOURCE_URLS,
  SOURCE_METADATA,
} from 'src/app/api/ai/spec/specValidation';

import type { CadinsanByCity, MunicipioIvs } from '@/data-gateway/schema';
import { gateway } from '@/gateway';

describe('isRecord', () => {
  test('returns true for plain objects', () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord({ a: 1 })).toBe(true);
  });

  test('returns false for non-objects', () => {
    expect(isRecord(null)).toBe(false);
    expect(isRecord(undefined)).toBe(false);
    expect(isRecord('string')).toBe(false);
    expect(isRecord(123)).toBe(false);
  });

  test('returns false for arrays', () => {
    expect(isRecord([])).toBe(false);
    expect(isRecord([1, 2, 3])).toBe(false);
  });
});

describe('invalidSpecResponse', () => {
  test('returns a 422 response with default error message when no params provided', () => {
    const response = invalidSpecResponse();

    expect(response.status).toBe(422);
  });

  test('includes custom error message when provided', async () => {
    const response = invalidSpecResponse({ message: 'Custom error' });
    const body = await response.json();

    expect(body).toEqual({ error: true, message: 'Custom error' });
    expect(response.status).toBe(422);
  });

  test('includes spec in response when provided', async () => {
    const spec = { test: 'data' };
    const response = invalidSpecResponse({ spec });
    const body = await response.json();

    expect(body.spec).toEqual(spec);
  });

  test('includes issues array when provided', async () => {
    const issues = [{ code: 'ERROR_CODE', message: 'Something went wrong' }];
    const response = invalidSpecResponse({ issues });
    const body = await response.json();

    expect(body.issues).toEqual(issues);
  });
});

describe('buildSourcesTable', () => {
  test('returns a markdown table string', () => {
    const table = buildSourcesTable();

    expect(typeof table).toBe('string');
    expect(table).toContain('| URL servida | Arquivo real | Descrição |');
  });

  test('includes all known source URLs in the table', () => {
    const table = buildSourcesTable();

    for (const url of KNOWN_SOURCE_URLS) {
      expect(table).toContain(`\`${url}\``);
    }
  });

  test('marks static files with their paths', () => {
    const table = buildSourcesTable();

    expect(table).toContain('public/geo/geojs-100-mun.json');
    expect(table).toContain('public/geo/estados.json');
    expect(table).toContain('public/geo/assentamentos.json');
  });

  test('marks API-backed sources as "(resolvido no servidor)"', () => {
    const table = buildSourcesTable();

    expect(table).toContain('(resolvido no servidor)');
  });
});

describe('SOURCE_METADATA', () => {
  test('has entries for all KNOWN_SOURCE_URLS', () => {
    for (const url of KNOWN_SOURCE_URLS) {
      expect(url in SOURCE_METADATA).toBe(true);
    }
  });

  test('static files have filepath and null resolver', () => {
    const staticUrl = '/geo/geojs-100-mun.json';
    const meta = SOURCE_METADATA[staticUrl];

    expect(meta.filepath).toBe('public/geo/geojs-100-mun.json');
    expect(meta.resolver).toBeNull();
  });

  test('API-backed sources have null filepath and a resolver function', () => {
    const apiUrl = '/api/cozinhas';
    const meta = SOURCE_METADATA[apiUrl];

    expect(meta.filepath).toBeNull();
    expect(typeof meta.resolver).toBe('function');
  });

  test('all entries have a description', () => {
    for (const meta of Object.values(SOURCE_METADATA)) {
      expect(meta.description).toBeDefined();
      expect(typeof meta.description).toBe('string');
      expect(meta.description.length).toBeGreaterThan(0);
    }
  });
});

describe('findInvalidGeojsonSource', () => {
  test('returns null when spec has no sources', () => {
    expect(findInvalidGeojsonSource({})).toBeNull();
    expect(findInvalidGeojsonSource({ sources: null })).toBeNull();
  });

  test('returns null when sources is not an array', () => {
    expect(findInvalidGeojsonSource({ sources: {} })).toBeNull();
    expect(findInvalidGeojsonSource({ sources: 'not-an-array' })).toBeNull();
  });

  test('skips non-geojson sources', () => {
    const spec = {
      sources: [
        { id: 'vector-source', type: 'vector' },
        { id: 'raster-source', type: 'raster' },
      ],
    };
    expect(findInvalidGeojsonSource(spec)).toBeNull();
  });

  test('detects empty inline FeatureCollections', () => {
    const spec = {
      sources: [
        {
          id: 'bad-source',
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        },
      ],
    };
    expect(findInvalidGeojsonSource(spec)).toBe('bad-source');
  });

  test('detects unknown source URLs', () => {
    const spec = {
      sources: [
        {
          id: 'hallucinated',
          type: 'geojson',
          data: '/geo/unknown-file.json',
        },
      ],
    };
    expect(findInvalidGeojsonSource(spec)).toBe('hallucinated');
  });

  test('ignores valid known source URLs', () => {
    const spec = {
      sources: [
        { id: 'good-source', type: 'geojson', data: '/geo/geojs-100-mun.json' },
      ],
    };
    expect(findInvalidGeojsonSource(spec)).toBeNull();
  });

  test('returns "desconhecida" when source has no id', () => {
    const spec = {
      sources: [
        {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        },
      ],
    };
    expect(findInvalidGeojsonSource(spec)).toBe('desconhecida');
  });

  test('skips sources that are not records', () => {
    const spec = {
      sources: [
        'not-a-record',
        { id: 'valid', type: 'geojson', data: '/geo/geojs-100-mun.json' },
      ],
    };
    expect(findInvalidGeojsonSource(spec)).toBeNull();
  });

  test('returns first invalid source when multiple exist', () => {
    const spec = {
      sources: [
        {
          id: 'first-invalid',
          type: 'geojson',
          data: '/geo/unknown.json',
        },
        {
          id: 'second-invalid',
          type: 'geojson',
          data: '/geo/also-unknown.json',
        },
      ],
    };
    expect(findInvalidGeojsonSource(spec)).toBe('first-invalid');
  });

  test('ignores FeatureCollections with features', () => {
    const spec = {
      sources: [
        {
          id: 'valid-inline',
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: [{ type: 'Feature', geometry: null }],
          },
        },
      ],
    };
    expect(findInvalidGeojsonSource(spec)).toBeNull();
  });
});

describe('findInvalidBasemapStyleUrl', () => {
  test('returns null when spec has no basemap', () => {
    expect(findInvalidBasemapStyleUrl({})).toBeNull();
  });

  test('returns null when basemap is not a record', () => {
    expect(findInvalidBasemapStyleUrl({ basemap: null })).toBeNull();
    expect(findInvalidBasemapStyleUrl({ basemap: 'string' })).toBeNull();
  });

  test('returns null when styleUrl is undefined', () => {
    expect(findInvalidBasemapStyleUrl({ basemap: {} })).toBeNull();
    expect(
      findInvalidBasemapStyleUrl({ basemap: { other: 'prop' } })
    ).toBeNull();
  });

  test('returns null for known valid style URLs', () => {
    const spec = {
      basemap: { styleUrl: 'https://tiles.openfreemap.org/styles/positron' },
    };
    expect(findInvalidBasemapStyleUrl(spec)).toBeNull();
  });

  test('detects unknown style URLs', () => {
    const spec = {
      basemap: { styleUrl: 'https://example.com/unknown-style.json' },
    };
    expect(findInvalidBasemapStyleUrl(spec)).toBe(
      'https://example.com/unknown-style.json'
    );
  });

  test('detects raster tile template URLs', () => {
    const spec = {
      basemap: { styleUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png' },
    };
    expect(findInvalidBasemapStyleUrl(spec)).toBe(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
    );
  });

  test('returns "desconhecido" when styleUrl is not a string', () => {
    const spec = {
      basemap: { styleUrl: 123 },
    };
    expect(findInvalidBasemapStyleUrl(spec)).toBe('desconhecido');
  });

  test('returns "desconhecido" when styleUrl is null', () => {
    const spec = {
      basemap: { styleUrl: null },
    };
    expect(findInvalidBasemapStyleUrl(spec)).toBe('desconhecido');
  });
});

describe('findGeometryInMapData', () => {
  test('returns null when mapData is not an array', () => {
    expect(findGeometryInMapData({})).toBeNull();
    expect(findGeometryInMapData({ mapData: null })).toBeNull();
    expect(findGeometryInMapData({ mapData: {} })).toBeNull();
  });

  test('returns null when sources is not an array of records', () => {
    const spec = {
      mapData: [{ mapDataId: 'some-id' }],
      sources: null,
    };
    expect(findGeometryInMapData(spec)).toBeNull();
  });

  test('detects when mapDataId collides with a source id', () => {
    const spec = {
      mapData: [{ mapDataId: 'source-geometry' }],
      sources: [{ id: 'source-geometry', type: 'geojson', data: {} }],
    };
    expect(findGeometryInMapData(spec)).toBe('source-geometry');
  });

  test('detects when mapData entry contains inline FeatureCollection', () => {
    const spec = {
      mapData: [
        {
          mapDataId: 'inline-geometry',
          data: { type: 'FeatureCollection', features: [] },
        },
      ],
      sources: [],
    };
    expect(findGeometryInMapData(spec)).toBe('inline-geometry');
  });

  test('allows valid mapData with join string values', () => {
    const spec = {
      mapData: [{ mapDataId: 'valid-id', data: 'join-value' }],
      sources: [{ id: 'geometry-source', type: 'geojson', data: {} }],
    };
    expect(findGeometryInMapData(spec)).toBeNull();
  });

  test('returns first invalid mapDataId when multiple collisions exist', () => {
    const spec = {
      mapData: [
        { mapDataId: 'first-collision' },
        { mapDataId: 'second-collision' },
      ],
      sources: [
        { id: 'first-collision', type: 'geojson', data: {} },
        { id: 'second-collision', type: 'geojson', data: {} },
      ],
    };
    expect(findGeometryInMapData(spec)).toBe('first-collision');
  });

  test('ignores mapData entries that are not records', () => {
    const spec = {
      mapData: ['not-a-record', { mapDataId: 'valid-id', data: 'join-value' }],
      sources: [],
    };
    expect(findGeometryInMapData(spec)).toBeNull();
  });

  test('ignores non-record entries in sources array', () => {
    const spec = {
      mapData: [{ mapDataId: 'test-id' }],
      sources: ['not-a-record', { id: 'other-id', type: 'geojson' }],
    };
    expect(findGeometryInMapData(spec)).toBeNull();
  });
});

describe('appendRealSourceData', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('returns spec unchanged when sources is not an array', async () => {
    const spec = { sources: null };
    expect(await appendRealSourceData(spec)).toEqual(spec);
  });

  test('leaves non-geojson sources untouched', async () => {
    const spec = { sources: [{ id: 'raster-source', type: 'raster' }] };
    expect(await appendRealSourceData(spec)).toEqual({
      sources: [{ id: 'raster-source', type: 'raster' }],
    });
  });

  test('leaves static geojson sources (no resolver) untouched', async () => {
    const spec = {
      sources: [
        { id: 'municipios', type: 'geojson', data: '/geo/geojs-100-mun.json' },
      ],
    };
    expect(await appendRealSourceData(spec)).toEqual(spec);
  });

  test('leaves geojson sources with an unknown URL untouched (no resolver)', async () => {
    const spec = {
      sources: [
        { id: 'hallucinated', type: 'geojson', data: '/geo/unknown.json' },
      ],
    };
    expect(await appendRealSourceData(spec)).toEqual(spec);
  });

  test('returns "desconhecida" in the 422 message when the empty source has no id', async () => {
    jest.spyOn(gateway, 'getCozinhas').mockResolvedValue({
      type: 'FeatureCollection',
      features: [],
    } as never);

    const spec = {
      sources: [{ type: 'geojson', data: '/api/cozinhas' }],
    };
    const result = await appendRealSourceData(spec);

    expect(result).toBeInstanceOf(Response);
    const body = await (result as Response).json();
    expect(body.message).toContain('desconhecida');
  });

  test('resolves /api/cozinhas source data via the gateway', async () => {
    const resolved = {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', geometry: null }],
    };
    jest.spyOn(gateway, 'getCozinhas').mockResolvedValue(resolved as never);

    const spec = {
      sources: [{ id: 'cozinhas', type: 'geojson', data: '/api/cozinhas' }],
    };
    const result = await appendRealSourceData(spec);

    expect(gateway.getCozinhas).toHaveBeenCalledWith();
    expect(result).toEqual({
      sources: [{ id: 'cozinhas', type: 'geojson', data: resolved }],
    });
  });

  test('resolves /api/cozinhas/bolhas source data via the gateway', async () => {
    const resolved = {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', geometry: null }],
    };
    jest
      .spyOn(gateway, 'getCozinhasBubbles')
      .mockResolvedValue(resolved as never);

    const spec = {
      sources: [
        { id: 'bolhas', type: 'geojson', data: '/api/cozinhas/bolhas' },
      ],
    };
    const result = await appendRealSourceData(spec);

    expect(gateway.getCozinhasBubbles).toHaveBeenCalledWith();
    expect(result).toEqual({
      sources: [{ id: 'bolhas', type: 'geojson', data: resolved }],
    });
  });

  test('returns a 422 response when the resolved source has no features', async () => {
    jest.spyOn(gateway, 'getCozinhas').mockResolvedValue({
      type: 'FeatureCollection',
      features: [],
    } as never);

    const spec = {
      sources: [{ id: 'cozinhas', type: 'geojson', data: '/api/cozinhas' }],
    };
    const result = await appendRealSourceData(spec);

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(422);
    const body = await (result as Response).json();
    expect(body.message).toContain('cozinhas');
  });
});

describe('KNOWN_BASEMAP_STYLE_URLS', () => {
  test('contains at least one valid style URL', () => {
    expect(KNOWN_BASEMAP_STYLE_URLS.length).toBeGreaterThan(0);
  });

  test('all entries are strings', () => {
    for (const url of KNOWN_BASEMAP_STYLE_URLS) {
      expect(typeof url).toBe('string');
    }
  });
});

describe('errorResponse', () => {
  test('always flags the failure and carries the given status, issues and spec', async () => {
    const response = errorResponse({
      status: 502,
      message: 'Falha',
      issues: [{ code: 'x', message: 'y' }],
      spec: { a: 1 },
    });

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: true,
      message: 'Falha',
      issues: [{ code: 'x', message: 'y' }],
      spec: { a: 1 },
    });
  });
});

describe('hoistLayerLegends', () => {
  test('moves layer-scoped legends to the top level, skipping ids already there', () => {
    const spec = {
      legends: [{ id: 'kept' }, 'not-a-legend'],
      layers: [
        { id: 'fill', legends: [{ id: 'kept' }, { id: 'moved' }] },
        { id: 'line' },
        'not-a-layer',
      ],
    };

    expect(hoistLayerLegends(spec)).toEqual({
      legends: [{ id: 'kept' }, 'not-a-legend', { id: 'moved' }],
      layers: [{ id: 'fill' }, { id: 'line' }, 'not-a-layer'],
    });
  });

  test('drops a non-array layer legends field and starts the top level when absent', () => {
    expect(
      hoistLayerLegends({ layers: [{ id: 'fill', legends: 'oops' }] })
    ).toEqual({ legends: [], layers: [{ id: 'fill' }] });
  });

  test('returns the same reference when no layer carries legends', () => {
    const spec = { layers: [{ id: 'fill' }] };
    expect(hoistLayerLegends(spec)).toBe(spec);
    const noLayers = { legends: [] };
    expect(hoistLayerLegends(noLayers)).toBe(noLayers);
  });
});

describe('findMissingLegend', () => {
  test('only counts top-level legends', () => {
    expect(
      findMissingLegend({
        mapData: [{ mapDataId: 'x' }],
        layers: [{ id: 'a', legends: [{ id: 'l' }] }],
      })
    ).toBe(true);
    expect(
      findMissingLegend({
        mapData: [{ mapDataId: 'x' }],
        legends: [{ id: 'l' }],
      })
    ).toBe(false);
    expect(findMissingLegend({ mapData: [] })).toBe(false);
  });
});

describe('findReclassifiedOfficialIndex', () => {
  const specWith = (mapDataId: string, thresholds: number[]) => {
    return {
      mapData: [{ mapDataId }],
      layers: [{ mapDataId, activeLegendId: 'l' }],
      legends: [{ id: 'l', colorBy: { thresholds } }],
    };
  };

  test('flags a Jenks-style legend on an IVS or IDHM id', () => {
    expect(
      findReclassifiedOfficialIndex(
        specWith('municipios_ivs_capital_humano', [0.1, 0.22, 0.31, 0.47])
      )
    ).toBe('municipios_ivs_capital_humano');
    expect(
      findReclassifiedOfficialIndex(specWith('municipios_idhm', [0.4, 0.9]))
    ).toBe('municipios_idhm');
  });

  test('accepts the official faixas, with or without the floor', () => {
    expect(
      findReclassifiedOfficialIndex(
        specWith('municipios_ivs', [0.2, 0.3, 0.4, 0.5])
      )
    ).toBeNull();
    expect(
      findReclassifiedOfficialIndex(
        specWith('municipios_idhm_renda', [0.001, 0.5, 0.6, 0.7, 0.8])
      )
    ).toBeNull();
  });

  test('protects every IVS/IDHM renderable id, whatever its name prefix', () => {
    const family = RENDERABLE_DATASET_IDS.filter((id) => {
      return /ivs|idhm/.test(id);
    });

    expect(family).toHaveLength(10);
    for (const id of family) {
      expect(officialFaixasOf(id)).toBeDefined();
      expect(findReclassifiedOfficialIndex(specWith(id, [0.11, 0.37]))).toBe(
        id
      );
    }
  });

  test('ignores a spec without layers, legends or numeric thresholds', () => {
    const layers = [{ mapDataId: 'municipios_ivs', activeLegendId: 'l' }];

    expect(findReclassifiedOfficialIndex({ mapData: [] })).toBeNull();
    expect(findReclassifiedOfficialIndex({ layers })).toBeNull();
    expect(
      findReclassifiedOfficialIndex({
        layers,
        legends: ['not-a-record', { id: 'l' }, { id: 'l', colorBy: {} }],
      })
    ).toBeNull();
    expect(
      findReclassifiedOfficialIndex({
        layers: ['not-a-record', {}],
        legends: [],
      })
    ).toBeNull();
  });

  test('ignores datasets outside the official families', () => {
    expect(
      findReclassifiedOfficialIndex(
        specWith('municipios_cadinsan', [5, 15, 25])
      )
    ).toBeNull();
  });
});

describe('buildCatalogueContext', () => {
  const projectedEntries = async (
    filter: (dataset: { id: string }) => boolean = () => {
      return true;
    }
  ) => {
    const real = await gateway.getCatalogue();
    const { catalogue } = JSON.parse(
      buildCatalogueContext({ ...real, datasets: real.datasets.filter(filter) })
    );
    return Object.fromEntries(
      catalogue.datasets.map(
        (entry: { id: string; description: string; fields: unknown[] }) => {
          return [entry.id, entry];
        }
      )
    );
  };

  test('exposes every renderable id to the agent', async () => {
    const byId = await projectedEntries();

    expect(
      RENDERABLE_DATASET_IDS.filter((id) => {
        return !(id in byId);
      })
    ).toEqual([]);
  });

  test('describes each IVS/IDHM id with its own field and scale direction', async () => {
    const byId = await projectedEntries((dataset) => {
      return dataset.id === 'municipios_ivs';
    });

    expect(byId.municipios_ivs.description).toMatch(/maior = mais vulnerável/);
    expect(byId.municipios_idhm.description).toMatch(/escala oposta à do IVS/);
    expect(byId.municipios_idhm.fields).toHaveLength(1);
  });
});

describe('appendRealMapData', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('rejects a dataset outside the renderable list with a 422 naming it', async () => {
    const result = await appendRealMapData({
      mapData: [{ mapDataId: 'caf_areas' }],
    });

    if (!(result instanceof Response)) {
      throw new Error('expected a 422 Response');
    }
    expect(result.status).toBe(422);
    expect((await result.json()).message).toMatch(/"caf_areas"/);
  });

  const IVS_ROW: MunicipioIvs = {
    codigoIbge: '2927408',
    municipio: 'Salvador (BA)',
    ivs: 0.11,
    ivsInfraestruturaUrbana: 0.12,
    ivsCapitalHumano: 0.13,
    ivsRendaETrabalho: 0.14,
    idhm: 0.21,
    idhmLongevidade: 0.22,
    idhmEducacao: 0.23,
    idhmRenda: 0.24,
    idhmEducacaoEscolaridade: 0.25,
    idhmEducacaoFrequencia: 0.26,
  };

  test.each([
    ['municipios_ivs', 0.11],
    ['municipios_ivs_infraestrutura', 0.12],
    ['municipios_ivs_capital_humano', 0.13],
    ['municipios_ivs_renda_trabalho', 0.14],
    ['municipios_idhm', 0.21],
    ['municipios_idhm_longevidade', 0.22],
    ['municipios_idhm_educacao', 0.23],
    ['municipios_idhm_renda', 0.24],
    ['municipios_idhm_educacao_escolaridade', 0.25],
    ['municipios_idhm_educacao_frequencia', 0.26],
  ])('%s paints its own IVS/IDHM field', async (mapDataId, value) => {
    jest.spyOn(gateway, 'getIvsPorMunicipio').mockResolvedValue([IVS_ROW]);

    const result = await appendRealMapData({
      mapData: [{ mapDataId, data: [], keep: 'me' }],
    });

    expect(result).toEqual({
      mapData: [
        {
          mapDataId,
          keep: 'me',
          data: [{ geometryId: '2927408', value }],
        },
      ],
    });
  });

  test.each([
    ['municipios_cadinsan', 19.56],
    ['municipios_cadinsan_sem_pbf', 26.26],
  ])('%s paints its own CADINSAN share', async (mapDataId, value) => {
    const row: CadinsanByCity = {
      codigoIbge: '2927408',
      municipio: 'Salvador',
      uf: 'Bahia',
      regiao: 'Nordeste',
      absolutoComPbf: 57160,
      absolutoSemPbf: 76754,
      cadastrosCadunico: 292251,
      proporcaoComPbf: 19.56,
      proporcaoSemPbf: 26.26,
    };
    jest.spyOn(gateway, 'getCadinsanPorMunicipio').mockResolvedValue([row]);

    const result = await appendRealMapData({ mapData: [{ mapDataId }] });

    expect(result).toEqual({
      mapData: [{ mapDataId, data: [{ geometryId: '2927408', value }] }],
    });
  });

  test('drops a município with a null share instead of painting 0', async () => {
    jest.spyOn(gateway, 'getCadinsanPorMunicipio').mockResolvedValue([
      {
        codigoIbge: '1100015',
        municipio: 'Sem cadastro',
        uf: 'Rondônia',
        regiao: 'Norte',
        absolutoComPbf: 0,
        absolutoSemPbf: 0,
        cadastrosCadunico: 0,
        proporcaoComPbf: null,
        proporcaoSemPbf: null,
      },
    ]);

    const result = await appendRealMapData({
      mapData: [{ mapDataId: 'municipios_cadinsan_sem_pbf' }],
    });

    expect(result).toEqual({
      mapData: [{ mapDataId: 'municipios_cadinsan_sem_pbf', data: [] }],
    });
  });
});
