import * as geovisSpec from 'src/app/(features)/mapas/geovisSpec';
import {
  buildCozinhasChoroplethSpec,
  isCozinhasChoroplethRequest,
} from 'src/app/api/ai/spec/canonicalChoropleth';

import { gateway } from '@/gateway';

jest.mock('@ttoss/geovis', () => {
  return {
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
  };
});

const COZINHAS_MAP_DATA = [{ mapDataId: 'cozinhas_geolocalizadas' }];

describe('isCozinhasChoroplethRequest', () => {
  test('matches a choropleth mapType over the cozinhas dataset', () => {
    expect(
      isCozinhasChoroplethRequest({
        mapType: 'choropleth',
        mapData: COZINHAS_MAP_DATA,
      })
    ).toBe(true);
  });

  test('matches a polygon layer bound to the cozinhas dataset without a mapType', () => {
    expect(
      isCozinhasChoroplethRequest({
        mapData: COZINHAS_MAP_DATA,
        layers: [
          'not-a-layer',
          {
            id: 'fill',
            geometry: 'polygon',
            mapDataId: 'cozinhas_geolocalizadas',
          },
        ],
      })
    ).toBe(true);
  });

  test('does not match other datasets, other geometries or a spec without mapData', () => {
    expect(
      isCozinhasChoroplethRequest({
        mapType: 'choropleth',
        mapData: [{ mapDataId: 'municipios_ivs' }, 'not-an-entry'],
      })
    ).toBe(false);
    expect(
      isCozinhasChoroplethRequest({
        mapType: 'proportionalCircles',
        mapData: COZINHAS_MAP_DATA,
        layers: [
          {
            id: 'pts',
            geometry: 'point',
            mapDataId: 'cozinhas_geolocalizadas',
          },
        ],
      })
    ).toBe(false);
    expect(
      isCozinhasChoroplethRequest({
        mapType: 'proportionalCircles',
        mapData: COZINHAS_MAP_DATA,
      })
    ).toBe(false);
    expect(isCozinhasChoroplethRequest({ mapType: 'choropleth' })).toBe(false);
  });
});

describe('buildCozinhasChoroplethSpec', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('builds the /mapas coropletico spec with only the legends its layers show', async () => {
    jest.spyOn(gateway, 'getCozinhasPorMunicipio').mockResolvedValue([
      {
        codigoIbge: '3304557',
        municipio: 'Rio de Janeiro (RJ)',
        quantidade: 69,
        pessoasAtendidas: 1000,
        populacao: 6000000,
        porCemMil: 1.1,
        percentualDoBrasil: 2,
        pessoasCadUnico: 5000,
        porDezMilCadUnico: 1,
        pessoasPorCozinha: 90000,
      },
    ]);
    const points = {
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: [-43.7, -22.9] as [number, number],
          },
          properties: {
            codigo: 'CS016282',
            nome: 'Cozinha',
            emFuncionamento: 'Sim, está funcionando normalmente',
          },
        },
      ],
    };
    jest.spyOn(gateway, 'getCozinhas').mockResolvedValue(points);
    const buildSpecSpy = jest.spyOn(geovisSpec, 'buildSpec');

    const spec = await buildCozinhasChoroplethSpec();

    // The tooltip renders only exist to make `buildSpec` emit their style;
    // they must render nothing themselves.
    const [, mode, hoverRender, , overlays] = buildSpecSpy.mock.calls[0];
    expect(mode).toBe('coropletico');
    expect(
      hoverRender?.({} as Parameters<NonNullable<typeof hoverRender>>[0])
    ).toBeNull();
    expect(overlays?.cozinhaStatus).toEqual({
      CS016282: 'Sim, está funcionando normalmente',
    });

    expect(
      (spec['legends'] as Array<{ id: string }>).map((legend) => {
        return legend.id;
      })
    ).toEqual(['legenda-cozinhas', 'legenda-cozinhas-status']);
    expect(spec['sources']).toEqual([
      expect.objectContaining({ id: 'cozinhas', data: points }),
      expect.objectContaining({
        id: 'cozinhas-bubbles',
        data: '/api/cozinhas/bolhas',
      }),
      {
        id: 'municipios-boundary',
        type: 'geojson',
        data: '/geo/geojs-100-mun.json',
      },
      { id: 'estados-boundary', type: 'geojson', data: '/geo/estados.json' },
    ]);
    expect(
      (spec['layers'] as Array<{ id: string; hoverTooltip?: unknown }>).map(
        (layer) => {
          return layer.id;
        }
      )
    ).toEqual([
      'municipios-br-fill',
      'municipios-boundary-line',
      'estados-boundary-line',
      'cozinhas-bolhas',
      'cozinhas-pts',
    ]);
    const fill = (spec['layers'] as Array<{ hoverTooltip?: object }>)[0];
    expect(fill.hoverTooltip).toEqual({ style: expect.any(Object) });
  });
});
