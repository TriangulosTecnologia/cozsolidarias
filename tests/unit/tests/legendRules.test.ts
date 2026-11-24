import { validateSpec } from '@ttoss/geovis';
import {
  CADINSAN_COLORS,
  CADINSAN_LEGEND_LABELS,
  CADINSAN_THRESHOLDS,
  CADUNICO_COLORS,
  CADUNICO_LEGEND_LABELS,
  CADUNICO_THRESHOLDS,
  PESSOAS_COZINHA_COLORS,
  PESSOAS_COZINHA_LEGEND_LABELS,
  PESSOAS_COZINHA_THRESHOLDS,
  WITHOUT_KITCHEN_COLOR,
} from 'src/app/(features)/mapas/geovisChoroplethScales';
import baseVisualizationSpecJson from 'src/app/api/ai/spec/instructions/baseVisualizationSpec.json';
import {
  applyAppLegendRules,
  splitAgentLegends,
} from 'src/app/api/ai/spec/legendRules';
import { RENDERABLE_DATASET_FETCHERS } from 'src/app/api/ai/spec/mapDataCatalogue';
import {
  resolveCandidate,
  resolveServedSpec,
} from 'src/app/api/ai/spec/serveSpec';
import { mergeSpecs } from 'src/app/api/ai/spec/specDefaults';
import type { UnknownRecord } from 'src/app/api/ai/spec/specValidation';

import { gateway } from '@/gateway';

// The real `validateSpec` and resolver: Jest does not transform the ESM entry
// of `@ttoss/geovis`, so load its CJS build. Its UI peers are ESM too and only
// render components, which these tests never do.
jest.mock('@ttoss/react-i18n', () => {
  return {
    defineMessages: (messages: unknown) => {
      return messages;
    },
  };
});
jest.mock('@ttoss/react-icons', () => {
  return {};
});
jest.mock('@ttoss/ui', () => {
  return {};
});
jest.mock('@ttoss/geovis', () => {
  return jest.requireActual(
    '../../../node_modules/@ttoss/geovis/dist/index.cjs'
  );
});

describe('splitAgentLegends', () => {
  test('splits off the id-less legends the agent wrote', () => {
    expect(
      splitAgentLegends({ legends: [{ title: 'IVS' }, { id: 'l' }] })
    ).toEqual({
      spec: { legends: [{ id: 'l' }] },
      agentLegends: [{ title: 'IVS' }],
    });
  });

  test('leaves a spec with no legends list untouched', () => {
    const spec = { title: 'Mapa' };

    expect(splitAgentLegends(spec)).toEqual({ spec, agentLegends: [] });
  });
});

describe('applyAppLegendRules', () => {
  test('puts the agent text and the official faixas on the legend painting mapData[0]', () => {
    const spec = applyAppLegendRules({
      spec: {
        mapData: [{ mapDataId: 'municipios_idhm', title: 'IDHM' }],
        layers: [{ mapDataId: 'municipios_idhm', activeLegendId: 'l' }],
        legends: [{ id: 'l', title: 'Circle size = IDHM' }],
      },
      agentLegends: [{ title: 'Desenvolvimento humano', subtitle: 'PNUD' }],
    });

    expect(spec['legends']).toEqual([
      expect.objectContaining({
        id: 'l',
        title: 'Desenvolvimento humano',
        subtitle: 'PNUD',
        colorBy: expect.objectContaining({ scale: 'threshold' }),
      }),
    ]);
  });

  test('carries the agent reference and no-data label onto the resolver legend', () => {
    const spec = applyAppLegendRules({
      spec: {
        mapData: [{ mapDataId: 'cozinhas_geolocalizadas', title: 'InSAN' }],
        layers: [{ mapDataId: 'cozinhas_geolocalizadas', activeLegendId: 'l' }],
        legends: [{ id: 'l', title: 'InSAN', reference: 'geovis' }],
      },
      agentLegends: [
        {
          title: 'InSAN',
          reference: 'Fonte: CadÚnico',
          noDataLabel: 'Sem dado',
        },
      ],
    });

    expect(spec['legends']).toEqual([
      {
        id: 'l',
        title: 'InSAN',
        reference: 'Fonte: CadÚnico',
        noDataLabel: 'Sem dado',
        position: 'bottom-right',
      },
    ]);
  });

  test('keeps a position the resolver already set', () => {
    const spec = applyAppLegendRules({
      spec: {
        mapData: [{ mapDataId: 'cozinhas_geolocalizadas', title: 'N' }],
        layers: [{ mapDataId: 'cozinhas_geolocalizadas', activeLegendId: 'l' }],
        legends: [{ id: 'l', position: 'top-left' }],
      },
      agentLegends: [],
    });

    expect(spec['legends']).toEqual([
      { id: 'l', title: 'N', position: 'top-left' },
    ]);
  });

  test('keeps an agent legend on a spec with no legends or layers yet', () => {
    expect(
      applyAppLegendRules({ spec: {}, agentLegends: [{ title: 'Cozinhas' }] })
    ).toEqual({
      legends: [
        { id: 'legend-1', position: 'bottom-right', title: 'Cozinhas' },
      ],
    });
  });
});

describe('official IVS/IDHM legend', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test.each(['municipios_ivs', 'municipios_idhm'] as const)(
    'resolves %s into a spec the real validateSpec accepts, with the faixa labels',
    async (mapDataId) => {
      jest.spyOn(RENDERABLE_DATASET_FETCHERS, mapDataId).mockResolvedValue([
        { geometryId: '3550308', value: 0.31 },
        { geometryId: '3304557', value: 0.62 },
      ] as never);

      const resolved = await resolveCandidate(
        mergeSpecs(baseVisualizationSpecJson as UnknownRecord, {
          mapType: 'choropleth',
          mapData: [{ mapDataId, title: 'Índice' }],
        })
      );

      expect(validateSpec(resolved)).toEqual(
        expect.objectContaining({ status: 'resolved' })
      );
      expect((resolved as UnknownRecord)['legends']).toEqual([
        expect.objectContaining({
          labelFormat: { type: 'labels', labels: expect.any(Array) },
        }),
      ]);
    }
  );
});

describe('CADINSAN legend', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test.each(['municipios_cadinsan', 'municipios_cadinsan_sem_pbf'] as const)(
    'resolves %s onto the /mapas ruler and labels, not Jenks breaks',
    async (mapDataId) => {
      jest.spyOn(RENDERABLE_DATASET_FETCHERS, mapDataId).mockResolvedValue([
        { geometryId: '3550308', value: 3.2 },
        { geometryId: '3304557', value: 7.9 },
        { geometryId: '5300108', value: 12.4 },
        { geometryId: '2927408', value: 18.1 },
        { geometryId: '1302603', value: 26.5 },
        { geometryId: '2304400', value: 33.7 },
      ] as never);

      const resolved = await resolveCandidate(
        mergeSpecs(baseVisualizationSpecJson as UnknownRecord, {
          mapType: 'choropleth',
          mapData: [{ mapDataId, title: 'Insegurança alimentar' }],
        })
      );

      expect(validateSpec(resolved)).toEqual(
        expect.objectContaining({ status: 'resolved' })
      );
      expect((resolved as UnknownRecord)['legends']).toEqual([
        expect.objectContaining({
          colorBy: {
            type: 'quantitative',
            property: 'value',
            scale: 'threshold',
            thresholds: CADINSAN_THRESHOLDS,
            colors: CADINSAN_COLORS,
            defaultColor: WITHOUT_KITCHEN_COLOR,
          },
          labelFormat: { type: 'labels', labels: CADINSAN_LEGEND_LABELS },
        }),
      ]);
    }
  );
});

describe('CadÚnico coverage legends', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  /** The rate `normalization` a CadÚnico rate legend carries, on `rateBase`. */
  const rateOn = (rateBase: number) => {
    return {
      type: 'rate',
      numeratorLabel: 'cozinhas',
      denominatorLabel: 'pessoas no CadÚnico',
      rateBase,
    };
  };

  /** Kitchen rows for three municípios, as `/api/cozinhas/por-municipio` serves them. */
  const kitchenRow = (codigoIbge: string, quantidade: number) => {
    return {
      codigoIbge,
      municipio: codigoIbge,
      quantidade,
      pessoasAtendidas: null,
      populacao: null,
      porCemMil: null,
      percentualDoBrasil: 0,
      pessoasCadUnico: 100_000,
      porDezMilCadUnico: null,
      pessoasPorCozinha: Math.round(100_000 / quantidade),
    };
  };

  test.each([
    [
      'cozinhas_por_10mil_cadunico',
      CADUNICO_THRESHOLDS,
      CADUNICO_COLORS,
      CADUNICO_LEGEND_LABELS,
      rateOn(10_000),
    ],
    [
      // The /mapas 10 mil ruler on a 100 mil base: every cutpoint × 10, so the
      // labels read in the base the map paints, never the 10 mil values.
      'cozinhas_por_100mil_cadunico',
      [0.1, 2, 5, 10, 20, 40],
      CADUNICO_COLORS,
      ['Sem cozinha', '< 2', '2 – 5', '5 – 10', '10 – 20', '20 – 40', '40+'],
      rateOn(100_000),
    ],
    [
      // Any base its id names: the ruler × 5.
      'cozinhas_por_50mil_cadunico',
      [0.05, 1, 2.5, 5, 10, 20],
      CADUNICO_COLORS,
      ['Sem cozinha', '< 1', '1 – 2,5', '2,5 – 5', '5 – 10', '10 – 20', '20+'],
      rateOn(50_000),
    ],
    [
      'cadunico_pessoas_por_cozinha',
      PESSOAS_COZINHA_THRESHOLDS,
      PESSOAS_COZINHA_COLORS,
      PESSOAS_COZINHA_LEGEND_LABELS,
      undefined,
    ],
  ] as const)(
    'resolves %s onto its /mapas ruler and labels, not Jenks breaks',
    async (mapDataId, thresholds, colors, labels, normalization) => {
      jest
        .spyOn(gateway, 'getCozinhasPorMunicipio')
        .mockResolvedValue([
          kitchenRow('3550308', 3),
          kitchenRow('3304557', 8),
          kitchenRow('2927408', 26),
        ]);

      const resolved = await resolveCandidate(
        mergeSpecs(baseVisualizationSpecJson as UnknownRecord, {
          mapType: 'choropleth',
          mapData: [{ mapDataId, title: 'Cobertura das cozinhas' }],
        })
      );

      expect(validateSpec(resolved)).toEqual(
        expect.objectContaining({ status: 'resolved' })
      );
      const [legend] = (resolved as UnknownRecord)[
        'legends'
      ] as UnknownRecord[];
      expect(legend).toEqual(
        expect.objectContaining({
          colorBy: {
            type: 'quantitative',
            property: 'value',
            scale: 'threshold',
            thresholds,
            colors,
            defaultColor: WITHOUT_KITCHEN_COLOR,
          },
          labelFormat: { type: 'labels', labels },
        })
      );
      expect(legend['normalization']).toEqual(normalization);
    }
  );

  test("serves the rate under the id of the prompt's base, with its values and legend", async () => {
    jest.spyOn(gateway, 'getCozinhasPorMunicipio').mockResolvedValue([
      {
        codigoIbge: '2927408',
        municipio: 'SALVADOR',
        quantidade: 26,
        pessoasAtendidas: 45897,
        populacao: 2417678,
        porCemMil: 1.08,
        percentualDoBrasil: 1.87,
        pessoasCadUnico: 1157799,
        porDezMilCadUnico: 0.22,
        pessoasPorCozinha: 44531,
      },
    ]);

    const served = await resolveServedSpec({
      prompt:
        'Mapa de cozinhas por 50 mil pessoas no CadÚnico em cada município',
      spec: mergeSpecs(baseVisualizationSpecJson as UnknownRecord, {
        mapType: 'choropleth',
        mapData: [{ mapDataId: 'cozinhas_por_10mil_cadunico' }],
      }),
    });

    const spec = served as UnknownRecord;
    const [entry] = spec['mapData'] as UnknownRecord[];
    const [layer] = (spec['layers'] as UnknownRecord[]).filter((candidate) => {
      return candidate['mapDataId'] !== undefined;
    });
    const [legend] = spec['legends'] as UnknownRecord[];
    // The agent picked the 10 mil id; the prompt's base renames it.
    expect(entry['mapDataId']).toBe('cozinhas_por_50mil_cadunico');
    expect(layer['mapDataId']).toBe('cozinhas_por_50mil_cadunico');
    expect(entry['data']).toEqual([{ geometryId: '2927408', value: 1.12 }]);
    expect(legend['normalization']).toEqual(rateOn(50_000));
  });
});
