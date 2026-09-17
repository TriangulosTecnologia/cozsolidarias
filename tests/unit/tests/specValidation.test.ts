import {
  appendRealSourceData,
  buildSourcesTable,
  findGeometryInMapData,
  findInvalidBasemapStyleUrl,
  findInvalidGeojsonSource,
  invalidSpecResponse,
  isRecord,
  KNOWN_BASEMAP_STYLE_URLS,
  KNOWN_SOURCE_URLS,
  SOURCE_METADATA,
} from 'src/app/api/ai/spec/specValidation';

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

    expect(body.error).toBe('Custom error');
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
    expect(body.error).toContain('desconhecida');
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
    expect(body.error).toContain('cozinhas');
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
