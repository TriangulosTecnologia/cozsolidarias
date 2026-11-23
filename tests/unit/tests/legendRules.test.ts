import { validateSpec } from '@ttoss/geovis';
import {
  CADINSAN_COLORS,
  CADINSAN_LEGEND_LABELS,
  CADINSAN_THRESHOLDS,
  WITHOUT_KITCHEN_COLOR,
} from 'src/app/(features)/mapas/geovisChoroplethScales';
import baseVisualizationSpecJson from 'src/app/api/ai/spec/instructions/baseVisualizationSpec.json';
import {
  applyAppLegendRules,
  splitAgentLegends,
} from 'src/app/api/ai/spec/legendRules';
import { RENDERABLE_DATASET_FETCHERS } from 'src/app/api/ai/spec/mapDataCatalogue';
import { resolveCandidate } from 'src/app/api/ai/spec/serveSpec';
import { mergeSpecs } from 'src/app/api/ai/spec/specDefaults';
import type { UnknownRecord } from 'src/app/api/ai/spec/specValidation';

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
        mapData: [{ mapDataId: 'municipios_cadinsan', title: 'InSAN' }],
        layers: [{ mapDataId: 'municipios_cadinsan', activeLegendId: 'l' }],
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
