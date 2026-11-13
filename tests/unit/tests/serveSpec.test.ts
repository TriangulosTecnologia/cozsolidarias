import { collectStructuralIssues } from 'src/app/api/ai/spec/candidateValidation';
import baseVisualizationSpecJson from 'src/app/api/ai/spec/instructions/baseVisualizationSpec.json';
import {
  RENDERABLE_DATASET_FETCHERS,
  RENDERABLE_DATASET_IDS,
} from 'src/app/api/ai/spec/mapDataCatalogue';
import {
  deriveAgentStructure,
  resolveCandidate,
} from 'src/app/api/ai/spec/serveSpec';
import { mergeSpecs } from 'src/app/api/ai/spec/specDefaults';
import type { UnknownRecord } from 'src/app/api/ai/spec/specValidation';

import { IVS_FAMILY_THRESHOLDS } from '@/app/(features)/mapas/geovisScoreScales';
import { gateway } from '@/gateway';

// `@ttoss/geovis` ships ESM that Jest does not transform. This mirrors the
// documented `resolveSpecFromMapType` contract of the installed 0.32.0 (one
// generated layer bound to `mapData[0]` and one `${mapDataId}-legend`, titled
// `Circle size = …` for proportional circles); a spec without `mapType` is
// returned unchanged.
jest.mock('@ttoss/geovis', () => {
  type MockSpec = {
    mapType?: string;
    mapData?: Array<{ mapDataId: string; mapId: string; title?: string }>;
    layers: unknown[];
    legends?: unknown[];
  };
  return {
    validateSpec: jest.fn().mockReturnValue({ status: 'resolved' }),
    createBoundaryGroup: (options: { id: string; data: string }) => {
      return {
        sources: [{ id: options.id, type: 'geojson', data: options.data }],
        layers: [
          { id: `${options.id}-line`, sourceId: options.id, geometry: 'line' },
        ],
      };
    },
    appendBoundaryGroup: (
      spec: { sources: unknown[]; layers: unknown[] },
      group: { sources: unknown[]; layers: unknown[] }
    ) => {
      return {
        ...spec,
        sources: [...spec.sources, ...group.sources],
        layers: [...spec.layers, ...group.layers],
      };
    },
    resolveSpecFromMapType: (spec: MockSpec) => {
      const entry = spec.mapData?.[0];
      if (!spec.mapType || !entry) {
        return spec;
      }
      const legendId = `${entry.mapDataId}-legend`;
      const circles = spec.mapType === 'proportionalCircles';
      return {
        ...spec,
        __resolved: true,
        layers: [
          ...spec.layers,
          {
            id: `${entry.mapId}-${circles ? 'proportional-circles' : 'fill'}`,
            sourceId: entry.mapId,
            geometry: circles ? 'point' : 'polygon',
            mapDataId: entry.mapDataId,
            activeLegendId: legendId,
          },
        ],
        legends: [
          {
            id: legendId,
            title: circles ? `Circle size = ${entry.title}` : entry.title,
            colorBy: { type: 'quantitative', thresholds: [0.2, 0.35] },
          },
        ],
      };
    },
  };
});

const withBase = (spec: UnknownRecord): UnknownRecord => {
  return mergeSpecs(baseVisualizationSpecJson as UnknownRecord, spec);
};

const ROWS = [
  { geometryId: '3550308', value: 0.31 },
  { geometryId: '3304557', value: 0.42 },
  { geometryId: '5300108', value: 0.18 },
];

const recordsOf = (value: unknown): UnknownRecord[] => {
  return Array.isArray(value) ? (value as UnknownRecord[]) : [];
};

afterEach(() => {
  jest.restoreAllMocks();
});

describe('deriveAgentStructure', () => {
  test.each(RENDERABLE_DATASET_IDS)(
    'gives %s a mapId that names a declared source',
    (mapDataId) => {
      const derived = deriveAgentStructure(
        withBase({ mapType: 'choropleth', mapData: [{ mapDataId }] })
      );
      const mapId = recordsOf(derived['mapData'])[0]?.['mapId'];
      const sourceIds = recordsOf(derived['sources']).map((source) => {
        return source['id'];
      });

      expect(mapId).toBe('municipios');
      expect(sourceIds).toContain(mapId);
    }
  );

  test('points kitchen-count circles at the per-município bubbles of the same year', () => {
    const derived = deriveAgentStructure(
      withBase({
        mapType: 'proportionalCircles',
        mapData: [{ mapDataId: 'cozinhas_geolocalizadas_2025' }],
      })
    );

    expect(recordsOf(derived['mapData'])[0]?.['mapId']).toBe('cozinhas-bolhas');
    expect(recordsOf(derived['sources'])).toContainEqual({
      id: 'cozinhas-bolhas',
      type: 'geojson',
      data: '/api/cozinhas/bolhas?ano=2025',
    });
  });

  test('leaves a layer without sourceId or geometry unnamed, never "undefined-undefined"', () => {
    const derived = deriveAgentStructure({ layers: [{ type: 'fill' }] });

    expect(recordsOf(derived['layers'])[0]).not.toHaveProperty('id');
  });

  test('declares the município source for a spec with no sources or layers yet', () => {
    expect(
      deriveAgentStructure({ mapData: [{ mapDataId: 'municipios_ivs' }] })
    ).toEqual({
      mapData: [{ mapDataId: 'municipios_ivs', mapId: 'municipios' }],
      sources: [
        { id: 'municipios', type: 'geojson', data: '/geo/geojs-100-mun.json' },
      ],
    });
  });

  test('draws kitchen-count dot density on the per-município bubbles, not on polygon vertices', () => {
    const derived = deriveAgentStructure(
      withBase({
        mapType: 'dotDensity',
        mapData: [{ mapDataId: 'cozinhas_geolocalizadas' }],
      })
    );

    expect(recordsOf(derived['mapData'])[0]?.['mapId']).toBe('cozinhas-bolhas');
  });

  test('injects a well-known point source and a default layer id', () => {
    const derived = deriveAgentStructure(
      withBase({
        layers: [
          { sourceId: 'cozinhas', geometry: 'point' },
          { id: 'mine', sourceId: 'cozinhas', geometry: 'heatmap' },
        ],
      })
    );

    expect(recordsOf(derived['sources'])).toContainEqual({
      id: 'cozinhas',
      type: 'geojson',
      data: '/api/cozinhas',
    });
    expect(
      recordsOf(derived['layers']).map((layer) => {
        return layer['id'];
      })
    ).toEqual(expect.arrayContaining(['cozinhas-point', 'mine']));
  });

  test('keeps a source the agent declared with a query', () => {
    const declared = {
      id: 'cozinhas',
      type: 'geojson',
      data: '/api/cozinhas?ano=2025',
    };
    const derived = deriveAgentStructure(
      withBase({
        sources: [declared],
        layers: [{ sourceId: 'cozinhas', geometry: 'point' }],
      })
    );

    expect(
      recordsOf(derived['sources']).filter((source) => {
        return source['id'] === 'cozinhas';
      })
    ).toEqual([declared]);
  });
});

describe('resolveCandidate', () => {
  test('resolves a minimal IVS choropleth with the official faixas and no structural issue', async () => {
    jest
      .spyOn(RENDERABLE_DATASET_FETCHERS, 'municipios_ivs')
      .mockResolvedValue(ROWS as never);

    const resolved = await resolveCandidate(
      withBase({
        mapType: 'choropleth',
        title: 'Vulnerabilidade social',
        mapData: [{ mapDataId: 'municipios_ivs', title: 'IVS' }],
      })
    );

    expect(resolved).not.toBeInstanceOf(Response);
    const spec = resolved as UnknownRecord;
    const legends = recordsOf(spec['legends']);
    expect(legends).toHaveLength(1);
    expect(legends[0]['title']).toBe('IVS');
    expect((legends[0]['colorBy'] as UnknownRecord)['thresholds']).toEqual(
      IVS_FAMILY_THRESHOLDS
    );
    expect(collectStructuralIssues(spec)).toEqual([]);
  });

  test('titles the proportional-circles legend in pt-BR, with no second legend', async () => {
    jest
      .spyOn(RENDERABLE_DATASET_FETCHERS, 'cozinhas_geolocalizadas')
      .mockResolvedValue([
        { geometryId: '3550308', value: 12 },
        { geometryId: '3304557', value: 5 },
      ] as never);
    jest.spyOn(gateway, 'getCozinhasBubbles').mockResolvedValue({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [-46.6, -23.5] },
          properties: { codarea: '3550308' },
        },
      ],
    } as never);

    const resolved = await resolveCandidate(
      withBase({
        mapType: 'proportionalCircles',
        mapData: [
          {
            mapDataId: 'cozinhas_geolocalizadas',
            title: 'Número de cozinhas',
          },
        ],
        legends: [{ title: 'Cozinhas por município' }],
      })
    );

    const legends = recordsOf((resolved as UnknownRecord)['legends']);
    expect(legends).toHaveLength(1);
    expect(legends[0]['title']).toBe('Cozinhas por município');
  });

  test('puts the agent top-level legend text on the resolver legend, keeping the official faixas', async () => {
    jest
      .spyOn(RENDERABLE_DATASET_FETCHERS, 'municipios_ivs')
      .mockResolvedValue(ROWS as never);

    const resolved = await resolveCandidate(
      withBase({
        mapType: 'choropleth',
        mapData: [{ mapDataId: 'municipios_ivs', title: 'IVS' }],
        legends: [
          { title: 'Vulnerabilidade social (IVS)', subtitle: 'IPEA, 2010' },
        ],
      })
    );

    const legends = recordsOf((resolved as UnknownRecord)['legends']);
    expect(legends).toHaveLength(1);
    expect(legends[0]).toMatchObject({
      id: 'municipios_ivs-legend',
      title: 'Vulnerabilidade social (IVS)',
      subtitle: 'IPEA, 2010',
    });
    expect((legends[0]['colorBy'] as UnknownRecord)['thresholds']).toEqual(
      IVS_FAMILY_THRESHOLDS
    );
  });

  test('keeps an agent legend no resolver legend takes, with a generated id', async () => {
    jest.spyOn(gateway, 'getCozinhas').mockResolvedValue({
      type: 'FeatureCollection',
      features: [{ type: 'Feature' }],
    } as never);

    const resolved = await resolveCandidate(
      withBase({
        layers: [{ sourceId: 'cozinhas', geometry: 'point' }],
        legends: [{ title: 'Cozinhas solidárias' }],
      })
    );

    expect((resolved as UnknownRecord)['legends']).toEqual([
      {
        id: 'legend-1',
        position: 'bottom-right',
        title: 'Cozinhas solidárias',
      },
    ]);
  });

  test('keeps the resolver legend title when the mapData entry has none', async () => {
    jest
      .spyOn(RENDERABLE_DATASET_FETCHERS, 'municipios_cadinsan')
      .mockResolvedValue(ROWS as never);

    const resolved = await resolveCandidate(
      withBase({
        mapType: 'choropleth',
        mapData: [{ mapDataId: 'municipios_cadinsan' }],
        layers: [{ id: 'context', sourceId: 'municipios', geometry: 'line' }],
      })
    );

    const legends = recordsOf((resolved as UnknownRecord)['legends']);
    expect(legends).toHaveLength(1);
    expect(legends[0]['title']).toBeUndefined();
    expect(legends[0]['colorBy']).toEqual({
      type: 'quantitative',
      thresholds: [0.2, 0.35],
    });
  });

  test('serves a points map with no mapType and no mapData', async () => {
    jest.spyOn(gateway, 'getCozinhas').mockResolvedValue({
      type: 'FeatureCollection',
      features: [{ type: 'Feature' }],
    } as never);

    const resolved = await resolveCandidate(
      withBase({ layers: [{ sourceId: 'cozinhas', geometry: 'point' }] })
    );

    expect(resolved).not.toBeInstanceOf(Response);
    expect(recordsOf((resolved as UnknownRecord)['sources'])).toContainEqual({
      id: 'cozinhas',
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [{ type: 'Feature' }] },
    });
  });

  test('rejects a mapType with no mapData', async () => {
    const resolved = await resolveCandidate(
      withBase({ mapType: 'choropleth', mapData: [] })
    );

    expect(resolved).toBeInstanceOf(Response);
    expect((resolved as Response).status).toBe(422);
  });

  test('rejects a mapData entry the resolver does not paint', async () => {
    jest
      .spyOn(RENDERABLE_DATASET_FETCHERS, 'municipios_ivs')
      .mockResolvedValue(ROWS as never);
    jest
      .spyOn(RENDERABLE_DATASET_FETCHERS, 'municipios_idhm')
      .mockResolvedValue(ROWS as never);

    const resolved = await resolveCandidate(
      withBase({
        mapType: 'choropleth',
        mapData: [
          { mapDataId: 'municipios_ivs', title: 'IVS' },
          { mapDataId: 'municipios_idhm', title: 'IDHM' },
        ],
      })
    );

    expect(resolved).toBeInstanceOf(Response);
    expect((resolved as Response).status).toBe(422);
  });
});
