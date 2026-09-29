import { type GeoVisIssue, validateSpec } from '@ttoss/geovis';
import {
  applyLocalRepairs,
  collectStructuralIssues,
  validateCandidate,
  validateWithLocalRepairs,
} from 'src/app/api/ai/spec/candidateValidation';

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
