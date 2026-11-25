import { collectStructuralIssues } from 'src/app/api/ai/spec/candidateValidation';
import {
  CATEGORY_BY_CODE,
  categoryOf,
  normalizeIssues,
} from 'src/app/api/ai/spec/issueCategories';

jest.mock('@ttoss/geovis', () => {
  return {
    validateSpec: jest.fn(),
    resolveSpecFromMapType: jest.fn(),
    createBoundaryGroup: jest.fn(),
    appendBoundaryGroup: jest.fn(),
  };
});

describe('categoryOf', () => {
  test('files a code the map does not list, like every geovis code, as structural', () => {
    expect(categoryOf('invalid-schema')).toBe('structural');
    expect(categoryOf('constructor')).toBe('structural');
  });

  test.each([
    ['unresolvable-spec', 'data-resolution'],
    ['period-not-covered', 'data-resolution'],
    ['ignored-user-map-type', 'semantic'],
    ['semantic-drift', 'semantic'],
    ['missing-default-period-caveat', 'semantic'],
    ['unsupported-dataset', 'capability'],
    ['choropleth-on-absolute-total', 'capability'],
    ['point-layer-on-polygon-source', 'capability'],
    ['legend-count-mismatch', 'structural'],
  ])('files %s as %s', (code, category) => {
    expect(categoryOf(code)).toBe(category);
  });

  test('lists every code collectStructuralIssues emits', () => {
    const codes = [
      ...collectStructuralIssues({
        mapType: 'choropleth',
        basemap: { styleUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png' },
        sources: [
          { id: 'mun', type: 'geojson', data: '/inventada.json' },
          { id: 'poly', type: 'geojson', data: '/geo/geojs-100-mun.json' },
        ],
        mapData: [
          { mapDataId: 'mun' },
          { mapDataId: 'cozinhas_pessoas_atendidas' },
        ],
        layers: [
          { id: 'dots', sourceId: 'poly', geometry: 'point' },
          { id: 'lost', sourceId: 'nowhere' },
        ],
      }),
      ...collectStructuralIssues({
        layers: [{ mapDataId: 'municipios_ivs', activeLegendId: 'l' }],
        legends: [{ id: 'l', colorBy: { thresholds: [0.1, 0.9] } }],
      }),
    ].map((issue) => {
      return issue.code;
    });

    expect(new Set(codes)).toEqual(
      new Set([
        'unknown-source-url',
        'unresolvable-layer-source',
        'unknown-basemap-style',
        'geometry-in-map-data',
        'missing-legend',
        'point-layer-on-polygon-source',
        'choropleth-on-absolute-total',
        'reclassified-official-index',
        'unsupported-dataset',
      ])
    );
    for (const code of codes) {
      expect(Object.hasOwn(CATEGORY_BY_CODE, code)).toBe(true);
    }
  });
});

describe('normalizeIssues', () => {
  const ISSUES = [
    { code: 'unsupported-dataset', path: 'mapData[x].mapDataId', message: 'a' },
    { code: 'missing-legend', path: 'legends', message: 'b' },
    { code: 'concept-drift', path: 'mapData[x].mapDataId', message: 'c' },
    { code: 'unresolvable-spec', path: '', message: 'd' },
    { code: 'invalid-schema', path: 'layers', message: 'e' },
    { code: 'invalid-schema', message: 'f' },
    { code: 'invalid-schema', path: 'layers', message: 'a' },
  ];

  test('orders by category, then code, path and message, each issue carrying its category', () => {
    expect(normalizeIssues(ISSUES)).toEqual([
      { code: 'invalid-schema', message: 'f', category: 'structural' },
      {
        code: 'invalid-schema',
        path: 'layers',
        message: 'a',
        category: 'structural',
      },
      {
        code: 'invalid-schema',
        path: 'layers',
        message: 'e',
        category: 'structural',
      },
      {
        code: 'missing-legend',
        path: 'legends',
        message: 'b',
        category: 'structural',
      },
      {
        code: 'unresolvable-spec',
        path: '',
        message: 'd',
        category: 'data-resolution',
      },
      {
        code: 'concept-drift',
        path: 'mapData[x].mapDataId',
        message: 'c',
        category: 'semantic',
      },
      {
        code: 'unsupported-dataset',
        path: 'mapData[x].mapDataId',
        message: 'a',
        category: 'capability',
      },
    ]);
  });

  test('yields one identical list for shuffled input carrying duplicates', () => {
    const shuffled = [...ISSUES].reverse();

    expect(normalizeIssues([...shuffled, ISSUES[1], ISSUES[4]])).toEqual(
      normalizeIssues(ISSUES)
    );
  });
});
