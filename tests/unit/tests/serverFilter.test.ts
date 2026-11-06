import { validateCandidate } from 'src/app/api/ai/spec/candidateValidation';
import type { FilterDomain } from 'src/app/api/ai/spec/fieldFilters';
import { withLegendNotes } from 'src/app/api/ai/spec/legendNotes';
import { preflightPrompt } from 'src/app/api/ai/spec/preflight';
import { appendRealMapData } from 'src/app/api/ai/spec/specValidation';
import { validateDatasetId } from 'src/app/api/ai/spec/validateDatasetId';
import type { CozinhasSituacaoPorMunicipio } from 'src/data-gateway/schema';

import { gateway } from '@/gateway';

import filterDomains from '../fixtures/filterDomains.json';
import golden from '../fixtures/preflightGolden.json';

jest.mock('@ttoss/geovis', () => {
  return {
    validateSpec: (spec: { mapData?: unknown[] }) => {
      // Mirrors geovis: a mapData entry takes no property outside its schema.
      const extra = (spec.mapData ?? []).some((entry) => {
        return typeof entry === 'object' && entry !== null && 'filter' in entry;
      });
      return extra
        ? {
            status: 'invalid',
            issues: [
              {
                code: 'invalid-schema',
                subject: { path: '/mapData/0' },
                message: '/mapData/0 must NOT have additional properties',
              },
            ],
          }
        : { status: 'resolved', warnings: [] };
    },
  };
});

const DOMAINS = filterDomains as FilterDomain[];

const SNAPSHOT_2025: CozinhasSituacaoPorMunicipio = {
  situacoesCobertas: null,
  semLocalizacao: 0,
  porMunicipio: [
    {
      codigoIbge: '111',
      municipio: 'Alpha',
      quantidadePorSituacao: { Habilitada: 2, Mapeada: 5 },
    },
  ],
};

afterEach(() => {
  jest.restoreAllMocks();
});

describe('option A: filter parameters never leave the server', () => {
  test('the preflight answers the base id plus a server-side filter', () => {
    expect(
      preflightPrompt({
        prompt: 'Cozinhas habilitadas em 2025',
        filterDomains: DOMAINS,
      })
    ).toEqual({
      status: 'resolved',
      datasetId: 'cozinhas_geolocalizadas_2025',
      filter: { field: 'situacao', value: 'Habilitada' },
    });
  });

  test('no golden verdict carries a parameterized id', () => {
    for (const entry of golden as Array<{ input: { prompt: string } }>) {
      const verdict = preflightPrompt({
        prompt: entry.input.prompt,
        filterDomains: DOMAINS,
      });
      expect(JSON.stringify(verdict)).not.toMatch(/"[a-z_0-9]+\?/);
    }
  });

  test('a parameterized datasetId is refused at the request boundary', () => {
    const refused = validateDatasetId({
      datasetId: 'cozinhas_geolocalizadas?situacao=Habilitada',
    });
    expect(refused).toBeInstanceOf(Response);
  });

  test('validate_spec takes filters beside the spec and hands them back outside it', () => {
    const filters = [
      {
        mapDataId: 'cozinhas_geolocalizadas_2025',
        filter: { situacao: 'Mapeada' },
      },
    ];
    const result = validateCandidate({
      spec: {
        mapData: [{ mapDataId: 'cozinhas_geolocalizadas_2025' }],
        legends: [{ id: 'l', title: 'Mapeadas' }],
      },
      filters,
    });

    expect(result.issues).toEqual([]);
    expect(result.filters).toEqual(filters);
    expect(result.spec).toMatchObject({
      mapData: [{ mapDataId: 'cozinhas_geolocalizadas_2025' }],
    });
  });

  test('validate_spec moves a filter written on an entry out of the spec it returns', () => {
    const result = validateCandidate({
      spec: {
        mapData: [
          {
            mapDataId: 'cozinhas_geolocalizadas_2025',
            filter: { situacao: 'Habilitada' },
          },
        ],
        legends: [{ id: 'l', title: 'Habilitadas' }],
      },
    });

    expect(result.issues).toEqual([]);
    expect(result.filters).toEqual([
      {
        mapDataId: 'cozinhas_geolocalizadas_2025',
        filter: { situacao: 'Habilitada' },
      },
    ]);
    expect(
      (result.spec as { mapData: object[] }).mapData[0]
    ).not.toHaveProperty('filter');
  });

  test.each([
    {
      filters: [{ mapDataId: 'municipios_ivs', filter: { situacao: 'x' } }],
      path: 'filters[0]',
    },
    { filters: 'situacao=Mapeada', path: 'filters' },
  ])(
    'validate_spec reports filters that name no mapData entry ($path)',
    ({ filters, path }) => {
      const result = validateCandidate({
        spec: { mapData: [{ mapDataId: 'cozinhas_geolocalizadas_2025' }] },
        filters,
      });

      expect(result.issues).toContainEqual(
        expect.objectContaining({ code: 'invalid-filter', path })
      );
    }
  );

  test('validate_spec reports a filter off the allowlist or on a non-filterable dataset', () => {
    const issues = validateCandidate({
      mapData: [
        { mapDataId: 'cozinhas_geolocalizadas', filter: { cnpj: '1' } },
        { mapDataId: 'municipios_ivs', filter: { situacao: 'Mapeada' } },
      ],
    }).issues;

    expect(
      issues.filter((issue) => {
        return issue.code === 'invalid-filter';
      })
    ).toHaveLength(2);
  });

  test('the append applies the filter and serves the base id without filter', async () => {
    jest
      .spyOn(gateway, 'getCozinhasSituacaoPorMunicipio')
      .mockResolvedValue(SNAPSHOT_2025);

    expect(
      await appendRealMapData({
        mapData: [
          {
            mapDataId: 'cozinhas_geolocalizadas_2025',
            filter: { situacao: 'Mapeada' },
          },
        ],
      })
    ).toEqual({
      mapData: [
        {
          mapDataId: 'cozinhas_geolocalizadas_2025',
          data: [{ geometryId: '111', value: 5 }],
        },
      ],
    });
  });

  test.each([
    { spec: { legends: [] }, expected: { legends: [] } },
    {
      spec: { mapData: ['x', { mapDataId: 'cozinhas_geolocalizadas' }] },
      expected: { mapData: ['x', { mapDataId: 'cozinhas_geolocalizadas' }] },
    },
  ])(
    'validate_spec attaches filters without reshaping a spec with no entry to take them (%#)',
    ({ spec, expected }) => {
      const result = validateCandidate({
        spec,
        filters: [
          {
            mapDataId: 'cozinhas_geolocalizadas',
            filter: { situacao: 'Mapeada' },
          },
        ],
      });

      expect(result.spec).toMatchObject(expected);
    }
  );

  test('validate_spec passes a non-object mapData entry through untouched', () => {
    expect(
      validateCandidate({
        mapData: ['x', { mapDataId: 'cozinhas_geolocalizadas' }],
      }).spec
    ).toMatchObject({
      mapData: ['x', { mapDataId: 'cozinhas_geolocalizadas' }],
    });
  });

  test('withLegendNotes gives no note to a filter whose mapDataId is not text', async () => {
    const legends = [{ id: 'l', title: 'x' }];

    expect(
      await withLegendNotes({
        spec: {
          mapData: [
            {
              mapDataId: ['cozinhas_geolocalizadas_2025'],
              filter: { situacao: 'Mapeada' },
            },
          ],
        },
        served: { legends },
        serverFilters: new Map(),
        whole: false,
      })
    ).toEqual({ legends });
  });

  test('withLegendNotes gives an invalid filter no note', async () => {
    const legends = [{ id: 'l', title: 'IVS' }];

    expect(
      await withLegendNotes({
        spec: {
          mapData: [{ mapDataId: 'municipios_ivs', filter: { situacao: 'x' } }],
        },
        served: { legends },
        serverFilters: new Map(),
        whole: false,
      })
    ).toEqual({ legends });
  });

  test('validate_spec checks every filter, even on entries sharing a mapDataId (F2)', () => {
    const result = validateCandidate({
      mapData: [
        { mapDataId: 'cozinhas_geolocalizadas_2025', filter: { situacao: '' } },
        {
          mapDataId: 'cozinhas_geolocalizadas_2025',
          filter: { situacao: 'Habilitada' },
        },
      ],
      legends: [{ id: 'l', title: 'x' }],
    });

    expect(
      result.issues.filter((issue) => {
        return issue.code === 'invalid-filter';
      })
    ).toHaveLength(1);
    expect(
      result.filters.map((filter) => {
        return filter.filter;
      })
    ).toEqual([{ situacao: '' }, { situacao: 'Habilitada' }]);
  });

  test.each([
    { mapDataId: 5 },
    {},
    { mapDataId: ['cozinhas_geolocalizadas_2025'] },
  ])(
    'validate_spec reports and hands back a filter on an entry without a text mapDataId (%p)',
    (idPart) => {
      const result = validateCandidate({
        mapData: [{ ...idPart, filter: { situacao: 'Mapeada' } }],
        legends: [{ id: 'l', title: 'x' }],
      });

      expect(
        result.issues.some((issue) => {
          return issue.code === 'invalid-filter';
        })
      ).toBe(true);
      expect(result.filters).toEqual([
        { ...idPart, filter: { situacao: 'Mapeada' } },
      ]);
      expect(result.spec).toMatchObject({ mapData: [idPart] });
    }
  );
});
