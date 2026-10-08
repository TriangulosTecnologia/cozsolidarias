import { type GeoVisIssue, validateSpec } from '@ttoss/geovis';
import {
  applyLocalRepairs,
  collectStructuralIssues,
  validateCandidate,
  validateWithLocalRepairs,
} from 'src/app/api/ai/spec/candidateValidation';
import {
  alignMapDataJoin,
  linkOrphanMapData,
  repointPointLayers,
  separateStateKeys,
} from 'src/app/api/ai/spec/specRepairs';

jest.mock('@ttoss/geovis', () => {
  return {
    validateSpec: jest
      .fn()
      .mockReturnValue({ status: 'resolved', warnings: [] }),
  };
});

describe('collectStructuralIssues', () => {
  test('reports every violation at once, each with its path', () => {
    const issues = collectStructuralIssues({
      mapType: 'choropleth',
      basemap: { styleUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png' },
      sources: [{ id: 'mun', type: 'geojson', data: '/inventada.json' }],
      mapData: [
        { mapDataId: 'mun' },
        { mapDataId: 'cozinhas_pessoas_atendidas' },
        'not-an-entry',
      ],
    });

    expect(
      issues.map((issue) => {
        return [issue.code, issue.path];
      })
    ).toEqual([
      ['unknown-source-url', 'sources[mun].data'],
      ['unknown-basemap-style', 'basemap.styleUrl'],
      ['geometry-in-map-data', 'mapData[mun]'],
      ['missing-legend', 'legends'],
      ['choropleth-on-absolute-total', 'mapType'],
      ['unsupported-dataset', 'mapData[mun].mapDataId'],
    ]);
  });

  test('flags an IVS legend that reclassifies the official faixas', () => {
    const issues = collectStructuralIssues({
      mapData: [{ mapDataId: 'municipios_ivs' }],
      layers: [{ mapDataId: 'municipios_ivs', activeLegendId: 'l' }],
      legends: [{ id: 'l', colorBy: { thresholds: [0.1, 0.22, 0.31, 0.47] } }],
    });

    expect(
      issues.map((issue) => {
        return [issue.code, issue.path];
      })
    ).toEqual([['reclassified-official-index', 'mapData[municipios_ivs]']]);
  });

  test.each([
    ['municipios_ivs_renda_trabalho', '0.2, 0.3, 0.4, 0.5'],
    ['municipios_idhm', '0.5, 0.6, 0.7, 0.8'],
  ])('tells the model the official faixas of %s', (mapDataId, breaks) => {
    const [issue] = collectStructuralIssues({
      layers: [{ mapDataId, activeLegendId: 'l' }],
      legends: [{ id: 'l', colorBy: { thresholds: [0.1, 0.9] } }],
    });

    expect(issue.message).toContain(breaks);
  });

  test('flags a polygon layer painting an absolute total even when mapType is not set', () => {
    const base = {
      sources: [
        { id: 'mun', type: 'geojson', data: '/geo/geojs-100-mun.json' },
      ],
      legends: [{ id: 'l' }],
      mapData: [{ mapDataId: 'cozinhas_pessoas_atendidas', mapId: 'mun' }],
    };
    const polygon = {
      ...base,
      layers: [
        {
          id: 'fill',
          sourceId: 'mun',
          geometry: 'polygon',
          mapDataId: 'cozinhas_pessoas_atendidas',
        },
      ],
    };
    const circles = {
      ...base,
      layers: [
        {
          id: 'dots',
          sourceId: 'mun',
          geometry: 'point',
          mapDataId: 'cozinhas_pessoas_atendidas',
        },
      ],
    };

    expect(
      collectStructuralIssues(polygon).map((issue) => {
        return issue.code;
      })
    ).toContain('choropleth-on-absolute-total');
    expect(
      collectStructuralIssues(circles).map((issue) => {
        return issue.code;
      })
    ).not.toContain('choropleth-on-absolute-total');
  });

  test('flags a point layer drawn on a polygon source', () => {
    const spec = (sourceId: string, data: string) => {
      return {
        sources: [{ id: sourceId, type: 'geojson', data }],
        legends: [{ id: 'l' }],
        layers: [{ id: 'dots', sourceId, geometry: 'point' }],
      };
    };

    expect(
      collectStructuralIssues(spec('mun', '/geo/geojs-100-mun.json')).map(
        (issue) => {
          return [issue.code, issue.path];
        }
      )
    ).toContainEqual([
      'point-layer-on-polygon-source',
      'layers[dots].sourceId',
    ]);
    expect(
      collectStructuralIssues(spec('b', '/api/cozinhas/bolhas')).map(
        (issue) => {
          return issue.code;
        }
      )
    ).not.toContain('point-layer-on-polygon-source');
  });

  test('returns no issues for a spec that passes every check', () => {
    expect(
      collectStructuralIssues({
        sources: [
          { id: 'mun', type: 'geojson', data: '/geo/geojs-100-mun.json' },
        ],
        mapData: [{ mapDataId: 'municipios_ivs', mapId: 'mun' }],
        legends: [{ id: 'l' }],
      })
    ).toEqual([]);
  });
});

const issueWith = (repair: GeoVisIssue['repair']): GeoVisIssue => {
  return {
    code: 'unsupported-engine',
    subject: { path: 'engine' },
    message: 'm',
    repair,
  };
};

describe('alignMapDataJoin', () => {
  const spec = {
    sources: [
      { id: 'municipios-boundary', type: 'geojson', data: '/geo/m.json' },
      { id: 'bolhas', type: 'geojson', data: '/api/cozinhas/bolhas' },
    ],
    layers: [
      { id: 'circles', sourceId: 'bolhas', mapDataId: 'pessoas' },
      { id: 'fill', sourceId: 'municipios-boundary', mapDataId: 'ok' },
    ],
    mapData: [
      { mapDataId: 'pessoas', mapId: 'municipios' },
      { mapDataId: 'ok', mapId: 'municipios-boundary', joinKey: 'id' },
    ],
  };

  test('points a mapId naming no source at the layer source and defaults the join to codarea', () => {
    const aligned = alignMapDataJoin(spec);

    expect(aligned['mapData']).toEqual([
      { mapDataId: 'pessoas', mapId: 'bolhas', joinKey: 'codarea' },
      { mapDataId: 'ok', mapId: 'municipios-boundary', joinKey: 'id' },
    ]);
  });

  test('also realigns a declared mapId that differs from the source its layer draws', () => {
    const aligned = alignMapDataJoin({
      sources: [{ id: 'mun' }, { id: 'bolhas' }],
      layers: [{ id: 'dots', sourceId: 'bolhas', mapDataId: 'p' }],
      mapData: [{ mapDataId: 'p', mapId: 'mun', joinKey: 'codarea' }],
    });

    expect(aligned['mapData']).toEqual([
      { mapDataId: 'p', mapId: 'bolhas', joinKey: 'codarea' },
    ]);
  });

  test('leaves a spec with no mapData untouched', () => {
    const bare = { sources: [], layers: [] };

    expect(alignMapDataJoin(bare)).toBe(bare);
  });

  test('passes a non-object mapData entry through for the structural checks to report', () => {
    const aligned = alignMapDataJoin({ sources: [], mapData: ['x'] });

    expect(aligned['mapData']).toEqual(['x']);
  });
});

describe('repointPointLayers', () => {
  const sources = [
    { id: 'mun', type: 'geojson', data: '/geo/geojs-100-mun.json' },
    { id: 'bolhas', type: 'geojson', data: '/api/cozinhas/bolhas' },
  ];

  test('moves a point layer off a polygon source onto the only unused API point source', () => {
    const spec = {
      sources,
      layers: [
        { id: 'fill', sourceId: 'mun', geometry: 'polygon' },
        { id: 'dots', sourceId: 'mun', geometry: 'point' },
      ],
    };

    expect(repointPointLayers(spec)['layers']).toEqual([
      { id: 'fill', sourceId: 'mun', geometry: 'polygon' },
      { id: 'dots', sourceId: 'bolhas', geometry: 'point' },
    ]);
  });

  test('leaves the spec alone when no single unused point source can take the layer', () => {
    const used = {
      sources,
      layers: [{ id: 'dots', sourceId: 'bolhas', geometry: 'point' }],
    };
    const none = {
      sources: [sources[0]],
      layers: [{ id: 'dots', sourceId: 'mun', geometry: 'point' }],
    };
    const two = {
      sources: [
        ...sources,
        { id: 'b2', type: 'geojson', data: '/api/cozinhas/bolhas' },
      ],
      layers: [{ id: 'dots', sourceId: 'mun', geometry: 'point' }],
    };
    const wrongKey = {
      sources: [
        sources[0],
        { id: 'pts', type: 'geojson', data: '/api/cozinhas' },
      ],
      layers: [{ id: 'dots', sourceId: 'mun', geometry: 'point' }],
    };
    const junk = { sources: ['x'], layers: ['y'] };
    const bare = { layers: [] };

    expect(repointPointLayers(used)).toBe(used);
    expect(repointPointLayers(none)).toBe(none);
    expect(repointPointLayers(two)).toBe(two);
    expect(repointPointLayers(wrongKey)).toBe(wrongKey);
    expect(repointPointLayers(junk)).toBe(junk);
    expect(repointPointLayers(bare)).toBe(bare);
  });
});

describe('linkOrphanMapData', () => {
  const layers = (extra: Array<Record<string, unknown>> = []) => {
    return [
      { id: 'fill', sourceId: 'mun', geometry: 'polygon' },
      { id: 'dots', sourceId: 'b', geometry: 'point' },
      ...extra,
    ];
  };
  const mapData = [{ mapDataId: 'pessoas', mapId: 'mun' }];

  test('links the only point layer without a mapDataId to the only mapData no layer uses', () => {
    const linked = linkOrphanMapData({ layers: layers(), mapData });

    expect(linked['layers']).toEqual([
      { id: 'fill', sourceId: 'mun', geometry: 'polygon' },
      { id: 'dots', sourceId: 'b', geometry: 'point', mapDataId: 'pessoas' },
    ]);
  });

  test('leaves the spec alone when the match is ambiguous or already made', () => {
    const twoPoints = {
      layers: layers([{ id: 'x', geometry: 'point' }]),
      mapData,
    };
    const used = {
      layers: [{ id: 'dots', geometry: 'point', mapDataId: 'pessoas' }],
      mapData,
    };
    const bare = { layers: [] };
    const junk = { layers: ['x'], mapData };

    expect(linkOrphanMapData(junk)).toBe(junk);
    expect(linkOrphanMapData(twoPoints)).toBe(twoPoints);
    expect(linkOrphanMapData(used)).toBe(used);
    expect(linkOrphanMapData(bare)).toBe(bare);
  });
});

describe('separateStateKeys', () => {
  test('gives each dimensioned entry on a shared source its own stateKey, keeping declared ones', () => {
    const separated = separateStateKeys({
      mapData: [
        { mapDataId: 'a', mapId: 's', dimension: 'size' },
        { mapDataId: 'b', mapId: 's', dimension: 'color', stateKey: 'dens' },
        { mapDataId: 'c', mapId: 'other', dimension: 'size' },
        { mapDataId: 'd', mapId: 'plain' },
      ],
    });

    expect(separated['mapData']).toEqual([
      { mapDataId: 'a', mapId: 's', dimension: 'size', stateKey: 'size' },
      { mapDataId: 'b', mapId: 's', dimension: 'color', stateKey: 'dens' },
      { mapDataId: 'c', mapId: 'other', dimension: 'size' },
      { mapDataId: 'd', mapId: 'plain' },
    ]);
  });

  test('leaves a spec without mapData untouched', () => {
    const bare = { sources: [] };

    expect(separateStateKeys(bare)).toBe(bare);
  });
});

describe('applyLocalRepairs', () => {
  test('applies set-value repairs and single-candidate allowed-values at id-keyed paths', () => {
    const spec = {
      engine: 'leaflet',
      view: { pitch: 30 },
      layers: [
        { id: 'fill', sourceId: 'wrong' },
        { id: 'other', sourceId: 'keep' },
      ],
      mapData: [{ mapDataId: 'md', mapId: 'wrong' }],
    };

    const repaired = applyLocalRepairs({
      spec,
      issues: [
        issueWith([{ kind: 'set-value', path: 'engine', value: 'maplibre' }]),
        issueWith([{ kind: 'set-value', path: 'view.pitch', value: 0 }]),
        issueWith([
          {
            kind: 'allowed-values',
            path: 'layers[fill].sourceId',
            values: ['mun'],
          },
          {
            kind: 'allowed-values',
            path: 'mapData[md].mapId',
            values: ['mun'],
          },
        ]),
      ],
    });

    expect(repaired).toEqual({
      engine: 'maplibre',
      view: { pitch: 0 },
      layers: [
        { id: 'fill', sourceId: 'mun' },
        { id: 'other', sourceId: 'keep' },
      ],
      mapData: [{ mapDataId: 'md', mapId: 'mun' }],
    });
  });

  test('leaves genuine choices, unresolvable paths and repair-free issues to the model', () => {
    const spec = { layers: 'not-a-list', view: 'flat', title: 't' };

    const repaired = applyLocalRepairs({
      spec,
      issues: [
        issueWith([
          {
            kind: 'allowed-values',
            path: 'layers[fill].sourceId',
            values: ['a', 'b'],
          },
          { kind: 'set-value', path: 'layers[fill].sourceId', value: 'a' },
          { kind: 'set-value', path: 'view.pitch', value: 0 },
          { kind: 'set-value', path: 'bad[path', value: 0 },
        ]),
        issueWith(undefined),
      ],
    });

    expect(repaired).toEqual(spec);
  });
});

describe('validateWithLocalRepairs', () => {
  test('re-validates once after repairing and reports what remains', () => {
    jest
      .mocked(validateSpec)
      .mockReturnValueOnce({
        status: 'unsupported',
        issues: [
          issueWith([{ kind: 'set-value', path: 'engine', value: 'maplibre' }]),
        ],
      })
      .mockReturnValueOnce({
        status: 'invalid',
        issues: [
          {
            code: 'invalid-threshold-order',
            subject: { path: 'legends[l].colorBy.thresholds' },
            message: 'order',
          },
        ],
      });

    expect(validateWithLocalRepairs({ engine: 'leaflet' })).toEqual({
      spec: { engine: 'maplibre' },
      issues: [
        {
          code: 'invalid-threshold-order',
          path: 'legends[l].colorBy.thresholds',
          message: 'order',
        },
      ],
    });
  });

  test('skips the second validation when no repair applies, and clears a fully repaired spec', () => {
    const issue: GeoVisIssue = {
      code: 'duplicate-map-data-id',
      subject: { path: 'mapData[x]' },
      message: 'dup',
    };
    jest
      .mocked(validateSpec)
      .mockReturnValueOnce({ status: 'invalid', issues: [issue] });
    const spec = { mapData: [] };

    expect(validateWithLocalRepairs(spec).spec).toBe(spec);
    expect(validateSpec).toHaveBeenCalledTimes(1);

    jest
      .mocked(validateSpec)
      .mockReturnValueOnce({
        status: 'unsupported',
        issues: [
          issueWith([{ kind: 'set-value', path: 'engine', value: 'maplibre' }]),
        ],
      })
      .mockReturnValueOnce({ status: 'resolved', warnings: [] });

    expect(validateWithLocalRepairs({ engine: 'x' }).issues).toEqual([]);
  });

  afterEach(() => {
    jest.mocked(validateSpec).mockClear();
  });
});

describe('validateCandidate', () => {
  test('rejects a non-object candidate', () => {
    expect(validateCandidate('text')).toEqual({
      spec: 'text',
      issues: [
        {
          code: 'invalid-spec-shape',
          path: '',
          message: 'A spec precisa ser um objeto JSON.',
        },
      ],
    });
  });

  test('hoists layer legends before checking, so they satisfy the legend rule', () => {
    const result = validateCandidate({
      mapData: [{ mapDataId: 'municipios_ivs' }],
      layers: [{ id: 'fill', legends: [{ id: 'l' }] }],
    });

    expect(result).toEqual({
      spec: {
        mapData: [{ mapDataId: 'municipios_ivs' }],
        layers: [{ id: 'fill' }],
        legends: [{ id: 'l' }],
      },
      issues: [],
    });
  });
});
