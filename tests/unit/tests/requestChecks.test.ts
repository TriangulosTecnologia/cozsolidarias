import {
  buildConceptIndex,
  type ConceptEntry,
} from 'src/app/api/ai/spec/conceptIndex';
import {
  collectRequestIssues,
  type SpecRequest,
} from 'src/app/api/ai/spec/requestChecks';

import { gateway } from '@/gateway';

jest.mock('@ttoss/geovis', () => {
  return {
    validateSpec: jest.fn(),
    resolveSpecFromMapType: jest.fn(),
    createBoundaryGroup: jest.fn(),
    appendBoundaryGroup: jest.fn(),
  };
});

const IVS_FAMILY = [
  'municipios_ivs',
  'municipios_ivs_infraestrutura',
  'municipios_ivs_capital_humano',
  'municipios_ivs_renda_trabalho',
];

let concepts: ConceptEntry[];

beforeAll(async () => {
  concepts = buildConceptIndex(await gateway.getCatalogue());
});

/** An IVS choropleth that keeps every part of an IVS request. */
const IVS_SPEC = {
  mapType: 'choropleth',
  title: 'Vulnerabilidade social por município',
  description: 'Dados de 2010.',
  mapData: [{ mapDataId: 'municipios_ivs', title: 'IVS' }],
  legends: [{ title: 'IVS' }],
};

const codesOf = (params: {
  spec: Record<string, unknown>;
  request: Omit<SpecRequest, 'concepts'>;
}): string[] => {
  return collectRequestIssues({
    spec: params.spec,
    request: { ...params.request, concepts },
  }).map((issue) => {
    return issue.code;
  });
};

describe('collectRequestIssues', () => {
  test('reports nothing for a spec that keeps the request', () => {
    expect(
      codesOf({
        spec: IVS_SPEC,
        request: {
          prompt: 'mapa do ivs',
          mapType: 'choropleth',
          conceptIds: IVS_FAMILY,
        },
      })
    ).toEqual([]);
  });

  test('reports a map type other than the one the user chose, or none', () => {
    const request = { prompt: 'mapa do ivs', mapType: 'dotDensity' as const };

    expect(codesOf({ spec: IVS_SPEC, request })).toEqual([
      'ignored-user-map-type',
    ]);
    expect(
      codesOf({ spec: { ...IVS_SPEC, mapType: undefined }, request })
    ).toEqual(['ignored-user-map-type']);
    expect(
      codesOf({ spec: { ...IVS_SPEC, mapType: 'dotDensity' }, request })
    ).toEqual([]);
  });

  test('reports a dataset other than the one the user chose, or none', () => {
    const request = {
      prompt: 'mapa do ivs',
      datasetId: 'municipios_ivs_renda_trabalho',
    };

    expect(codesOf({ spec: IVS_SPEC, request })).toEqual([
      'ignored-user-dataset',
    ]);
    expect(codesOf({ spec: { ...IVS_SPEC, mapData: [] }, request })).toEqual([
      'ignored-user-dataset',
    ]);
    expect(
      codesOf({
        spec: {
          ...IVS_SPEC,
          mapData: [{ mapDataId: 'municipios_ivs_renda_trabalho' }],
        },
        request,
      })
    ).toEqual([]);
  });

  test('reports a painted dataset that does not cover the year the prompt names, on its mapDataId', () => {
    const issues = collectRequestIssues({
      spec: IVS_SPEC,
      request: { prompt: 'IVS dos municípios em 2022', concepts },
    });

    expect(issues).toEqual([
      expect.objectContaining({
        code: 'period-not-covered',
        path: 'mapData[municipios_ivs].mapDataId',
        message: expect.stringContaining('2022'),
      }),
    ]);
    expect(
      codesOf({ spec: IVS_SPEC, request: { prompt: 'ivs de 2010' } })
    ).toEqual([]);
    expect(
      codesOf({ spec: IVS_SPEC, request: { prompt: 'mapa do ivs' } })
    ).toEqual([]);
  });

  test('reports more than one painted variable', () => {
    expect(
      codesOf({
        spec: {
          ...IVS_SPEC,
          mapData: [
            { mapDataId: 'municipios_ivs' },
            { mapDataId: 'municipios_idhm' },
          ],
          legends: [{ title: 'IVS' }, { title: 'IDHM' }],
        },
        request: { prompt: 'mapa do ivs' },
      })
    ).toEqual(['multiple-painted-variables']);
  });

  test('reports declared legends that do not match the painted variables one to one', () => {
    const request = { prompt: 'mapa do ivs' };

    expect(
      codesOf({
        spec: { ...IVS_SPEC, legends: [{ title: 'a' }, { title: 'b' }] },
        request,
      })
    ).toEqual(['legend-count-mismatch']);
    expect(
      codesOf({ spec: { ...IVS_SPEC, legends: undefined }, request })
    ).toEqual([]);
    expect(
      codesOf({
        spec: {
          title: 'Cozinhas',
          layers: [{ sourceId: 'cozinhas', geometry: 'point' }],
          legends: [{ title: 'Cozinhas' }, { title: 'Outra' }],
        },
        request,
      })
    ).toEqual([]);
  });

  test('reports a points or heatmap spec that also carries a map type or mapData', () => {
    const heatmap = {
      title: 'Concentração de cozinhas',
      layers: [{ sourceId: 'cozinhas', geometry: 'heatmap' }],
    };
    const request = { prompt: 'mapa de calor das cozinhas' };

    expect(
      codesOf({ spec: { ...heatmap, mapType: 'choropleth' }, request })
    ).toEqual(['points-spec-with-map-data']);
    expect(
      codesOf({
        spec: {
          ...heatmap,
          mapData: [{ mapDataId: 'cozinhas_geolocalizadas' }],
        },
        request,
      })
    ).toContain('points-spec-with-map-data');
    expect(codesOf({ spec: heatmap, request })).toEqual([]);
  });

  test('reports a painted dataset outside the families the prompt resolved to', () => {
    const request = { prompt: 'mapa do ivs', conceptIds: IVS_FAMILY };

    expect(
      collectRequestIssues({
        spec: {
          ...IVS_SPEC,
          mapData: [{ mapDataId: 'cozinhas_geolocalizadas' }],
        },
        request: { ...request, concepts },
      })
    ).toEqual([
      expect.objectContaining({
        code: 'concept-drift',
        path: 'mapData[cozinhas_geolocalizadas].mapDataId',
      }),
    ]);
    expect(
      codesOf({
        spec: {
          ...IVS_SPEC,
          mapData: [{ mapDataId: 'municipios_ivs_capital_humano' }],
        },
        request,
      })
    ).toEqual([]);
  });

  test('does not judge the concept of a prompt the preflight could not resolve', () => {
    const spec = {
      ...IVS_SPEC,
      mapData: [{ mapDataId: 'cozinhas_pessoas_atendidas' }],
    };

    expect(codesOf({ spec, request: { prompt: 'um mapa' } })).toEqual([]);
    expect(
      codesOf({ spec, request: { prompt: 'um mapa', conceptIds: [] } })
    ).toEqual([]);
  });

  test('counts a CadÚnico rate on any base as a variant of a family holding a CadÚnico rate', () => {
    const conceptIds = [
      'cozinhas_por_10mil_cadunico',
      'cozinhas_por_100mil_cadunico',
      'cadunico_pessoas_por_cozinha',
    ];
    const spec = (mapDataId: string) => {
      return { ...IVS_SPEC, mapData: [{ mapDataId }] };
    };
    const request = {
      prompt: 'cozinhas por 50 mil pessoas no cadunico',
      conceptIds,
    };

    expect(
      codesOf({ spec: spec('cozinhas_por_50mil_cadunico'), request })
    ).toEqual([]);
    expect(
      codesOf({
        spec: spec('cozinhas_por_50mil_cadunico'),
        request: { ...request, conceptIds: IVS_FAMILY },
      })
    ).toEqual(['concept-drift']);
  });

  describe('completeness-claim-on-partial-coverage', () => {
    const cozinhas = (title: string) => {
      return {
        mapType: 'proportionalCircles',
        title,
        description: 'Dados de 2026.',
        mapData: [{ mapDataId: 'cozinhas_geolocalizadas' }],
      };
    };
    const request = { prompt: 'mapa das cozinhas' };

    test('reports a title claiming completeness over a dataset with partial coverage', () => {
      expect(
        collectRequestIssues({
          spec: cozinhas('Todas as cozinhas do Brasil'),
          request: { ...request, concepts },
        })
      ).toEqual([
        expect.objectContaining({
          code: 'completeness-claim-on-partial-coverage',
          path: 'title',
        }),
      ]);
      expect(
        codesOf({ spec: cozinhas('Mapa COMPLETO das cozinhas'), request })
      ).toEqual(['completeness-claim-on-partial-coverage']);
    });

    test.each([
      'Cozinhas mapeadas por município',
      'Cozinhas solidárias cadastradas, por município',
      'Completude do cadastro de cozinhas',
    ])('accepts the title "%s"', (title) => {
      expect(codesOf({ spec: cozinhas(title), request })).toEqual([]);
    });

    test('accepts a completeness word over a dataset with exhaustive coverage', () => {
      expect(
        codesOf({
          spec: { ...IVS_SPEC, title: 'IVS de todos os municípios' },
          request: { prompt: 'mapa do ivs' },
        })
      ).toEqual([]);
    });
  });

  describe('missing-proxy-caveat', () => {
    const note =
      'Fome não é medida diretamente; a insegurança alimentar das famílias do CadÚnico (CADINSAN) é o indicador mais próximo.';
    const cadinsan = (description?: string) => {
      return {
        mapType: 'choropleth',
        title: 'Insegurança alimentar por município',
        ...(description === undefined ? {} : { description }),
        mapData: [{ mapDataId: 'municipios_cadinsan' }],
      };
    };
    const request = {
      prompt: 'mapa da fome',
      datasetId: 'municipios_cadinsan',
      note,
    };

    test('reports a proxy map with no description, or one that does not state the proxy', () => {
      expect(
        collectRequestIssues({
          spec: cadinsan(),
          request: { ...request, concepts },
        })
      ).toEqual([
        expect.objectContaining({
          code: 'missing-proxy-caveat',
          path: 'description',
        }),
      ]);
      expect(
        codesOf({
          spec: cadinsan('Famílias do CadÚnico em insegurança alimentar.'),
          request,
        })
      ).toEqual(['missing-proxy-caveat']);
    });

    test.each([
      note,
      'O mapa usa a insegurança alimentar do CadÚnico como aproximação da fome.',
      'Indicador indireto: a fome não é medida no catálogo.',
      'CADINSAN é o dado mais próximo da fome disponível.',
    ])('accepts the description "%s"', (description) => {
      expect(codesOf({ spec: cadinsan(description), request })).toEqual([]);
    });

    test('does not ask for a caveat when the server noted no proxy', () => {
      expect(
        codesOf({ spec: cadinsan(), request: { prompt: 'mapa do cadinsan' } })
      ).toEqual([]);
    });
  });

  describe('missing-default-period-caveat', () => {
    // `cozinhas_geolocalizadas_2025` is held by the 2025 and 2026 kitchen
    // datasets: its catalogue extent covers two years.
    const cozinhas2025 = (description?: string) => {
      return {
        mapType: 'proportionalCircles',
        title: 'Cozinhas por município',
        ...(description === undefined ? {} : { description }),
        mapData: [{ mapDataId: 'cozinhas_geolocalizadas_2025' }],
      };
    };
    const request = { prompt: 'mapa das cozinhas' };

    test('reports a multi-year dataset painted for a prompt with no year when the description names no year it covers', () => {
      expect(
        collectRequestIssues({
          spec: cozinhas2025(),
          request: { ...request, concepts },
        })
      ).toEqual([
        expect.objectContaining({
          code: 'missing-default-period-caveat',
          path: 'description',
        }),
      ]);
      expect(
        codesOf({ spec: cozinhas2025('Cozinhas mapeadas.'), request })
      ).toEqual(['missing-default-period-caveat']);
      expect(
        codesOf({ spec: cozinhas2025('Dados de 2019.'), request })
      ).toEqual(['missing-default-period-caveat']);
    });

    test.each([
      'Dados de 2025.',
      'Cozinhas mapeadas em 2025, o ano escolhido por padrão.',
      'Levantamento de cozinhas (2025).',
    ])('accepts the description "%s"', (description) => {
      expect(codesOf({ spec: cozinhas2025(description), request })).toEqual([]);
    });

    test('does not ask for the year when the prompt names one or the dataset has one edition', () => {
      expect(
        codesOf({
          spec: cozinhas2025(),
          request: { prompt: 'mapa das cozinhas em 2025' },
        })
      ).toEqual([]);
      expect(
        codesOf({
          spec: { ...IVS_SPEC, description: undefined },
          request: { prompt: 'mapa do ivs' },
        })
      ).toEqual([]);
    });
  });
});
