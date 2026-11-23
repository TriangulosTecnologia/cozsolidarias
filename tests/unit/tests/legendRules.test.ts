import { validateSpec } from '@ttoss/geovis';
import {
  CADINSAN_COLORS,
  CADINSAN_LEGEND_LABELS,
  CADINSAN_THRESHOLDS,
  CADUNICO_COLORS,
  flooredBinLabels,
  PESSOAS_COZINHA_COLORS,
  WITHOUT_KITCHEN_COLOR,
} from 'src/app/(features)/mapas/geovisChoroplethScales';
import type { MapMode } from 'src/app/(features)/mapas/geovisMapMode';
import { jenksBreaksForMode } from 'src/app/(features)/mapas/geovisScales';
import baseVisualizationSpecJson from 'src/app/api/ai/spec/instructions/baseVisualizationSpec.json';
import {
  applyAppLegendRules,
  splitAgentLegends,
} from 'src/app/api/ai/spec/legendRules';
import { RENDERABLE_DATASET_FETCHERS } from 'src/app/api/ai/spec/mapDataCatalogue';
import { resolveCandidate } from 'src/app/api/ai/spec/serveSpec';
import { mergeSpecs } from 'src/app/api/ai/spec/specDefaults';
import type { UnknownRecord } from 'src/app/api/ai/spec/specValidation';

import type { KitchenRateByCity } from '@/data-gateway/schema';
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

describe('CadÚnico coverage legend', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  /** Eight municípios with 100 mil CadÚnico people and 1 to 8 cozinhas. */
  const ROWS: KitchenRateByCity[] = [
    '3550308',
    '3304557',
    '5300108',
    '2927408',
    '1302603',
    '2304400',
    '4106902',
    '1501402',
  ].map((codigoIbge, index) => {
    return {
      codigoIbge,
      municipio: codigoIbge,
      quantidade: index + 1,
      pessoasAtendidas: null,
      populacao: null,
      porCemMil: null,
      percentualDoBrasil: 0,
      pessoasCadUnico: 100_000,
      porDezMilCadUnico: null,
      pessoasPorCozinha: Math.round(100_000 / (index + 1)),
    };
  });

  const legendOf = async (mapDataId: string): Promise<UnknownRecord> => {
    jest.spyOn(gateway, 'getCozinhasPorMunicipio').mockResolvedValue(ROWS);
    const resolved = await resolveCandidate(
      mergeSpecs(baseVisualizationSpecJson as UnknownRecord, {
        mapType: 'choropleth',
        mapData: [{ mapDataId, title: 'Cobertura do CadÚnico' }],
      })
    );
    expect(validateSpec(resolved)).toEqual(
      expect.objectContaining({ status: 'resolved' })
    );
    const [legend] = (resolved as UnknownRecord)['legends'] as UnknownRecord[];
    return legend;
  };

  test.each([
    [
      'cozinhas_por_10mil_cadunico',
      'coropletico-cadunico',
      CADUNICO_COLORS,
      [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
    ],
    [
      'cozinhas_por_100mil_cadunico',
      'coropletico-cadunico',
      CADUNICO_COLORS,
      [1, 2, 3, 4, 5, 6, 7, 8],
    ],
    [
      'cadunico_pessoas_por_cozinha',
      'coropletico-pessoas-cozinha',
      PESSOAS_COZINHA_COLORS,
      ROWS.map((row) => {
        return row.pessoasPorCozinha;
      }),
    ],
  ] as const)(
    '%s gets the /mapas %s legend: its Jenks breaks, colors and labels',
    async (mapDataId, mode: MapMode, colors, values) => {
      const thresholds = jenksBreaksForMode(mode, values);
      if (!thresholds) {
        throw new Error('expected Jenks breaks for the fixture');
      }

      expect(await legendOf(mapDataId)).toEqual(
        expect.objectContaining({
          colorBy: {
            type: 'quantitative',
            property: 'value',
            scale: 'threshold',
            thresholds,
            colors,
            defaultColor: WITHOUT_KITCHEN_COLOR,
          },
          labelFormat: {
            type: 'labels',
            labels: flooredBinLabels('Sem cozinha', thresholds),
          },
        })
      );
    }
  );

  test('the 100 mil legend does not reuse the 10 mil values', async () => {
    const perTenThousand = await legendOf('cozinhas_por_10mil_cadunico');
    const perHundredThousand = await legendOf('cozinhas_por_100mil_cadunico');

    expect(perHundredThousand['labelFormat']).not.toEqual(
      perTenThousand['labelFormat']
    );
  });

  test('keeps the resolver legend when the values are too few to split', () => {
    const legend = { id: 'l', colorBy: { thresholds: [1] } };

    expect(
      applyAppLegendRules({
        spec: {
          mapData: [
            {
              mapDataId: 'cozinhas_por_10mil_cadunico',
              data: [{ value: 0.4 }, { value: 'sem dado' }],
            },
          ],
          layers: [
            { mapDataId: 'cozinhas_por_10mil_cadunico', activeLegendId: 'l' },
          ],
          legends: [legend],
        },
        agentLegends: [],
      })['legends']
    ).toEqual([expect.objectContaining({ colorBy: legend.colorBy })]);
  });
});
