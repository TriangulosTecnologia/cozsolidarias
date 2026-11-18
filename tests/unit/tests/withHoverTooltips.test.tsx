import type { VisualizationSpec } from '@ttoss/geovis';
import { withHoverTooltips } from 'src/app/(features)/ia/withHoverTooltips';

const spec: VisualizationSpec = {
  engine: 'maplibre',
  sources: [
    { id: 'mun', type: 'geojson', data: '/geo/geojs-100-mun.json' },
    {
      id: 'bolhas',
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [0, 0] },
            properties: { codarea: '1', municipio: 'ALFA' },
          },
        ],
      },
    },
  ],
  layers: [
    {
      id: 'circles',
      sourceId: 'bolhas',
      geometry: 'point',
      mapDataId: 'pessoas',
    },
  ],
  mapData: [
    {
      mapDataId: 'pessoas',
      mapId: 'bolhas',
      joinKey: 'codarea',
      title: 'Pessoas atendidas',
      data: [{ geometryId: '1', value: 10 }],
    },
  ],
  legends: [{ id: 'leg', colorBy: { type: 'categorical', mapping: {} } }],
} as unknown as VisualizationSpec;

describe('withHoverTooltips', () => {
  test('adds an invisible município polygon layer, with its own mapData, ahead of the point layer', () => {
    const result = withHoverTooltips(spec);

    expect(
      result.layers?.map((layer) => {
        return layer.id;
      })
    ).toEqual(['circles-hover', 'circles']);
    expect(result.layers?.[0]).toMatchObject({
      sourceId: 'mun',
      geometry: 'polygon',
      mapDataId: 'pessoas-hover',
      activeLegendId: 'leg',
    });
    expect(result.mapData?.[1]).toMatchObject({
      mapDataId: 'pessoas-hover',
      mapId: 'mun',
      joinKey: 'codarea',
    });
  });

  test('skips point layers whose mapData is not keyed by codarea', () => {
    const byCodigo = {
      ...spec,
      layers: [
        ...(spec.layers ?? []),
        {
          id: 'pts',
          sourceId: 'bolhas',
          geometry: 'point',
          mapDataId: 'status',
        },
      ],
      mapData: [
        ...(spec.mapData ?? []),
        {
          mapDataId: 'status',
          mapId: 'bolhas',
          joinKey: 'codigo',
          data: [{ geometryId: 'CS1', value: 'Em funcionamento' }],
        },
      ],
    } as unknown as VisualizationSpec;

    expect(
      withHoverTooltips(byCodigo).layers?.map((layer) => {
        return layer.id;
      })
    ).toEqual(['circles-hover', 'circles', 'pts']);
  });

  test('returns the spec untouched without a município boundary source', () => {
    const bare = { ...spec, sources: [spec.sources[1]] };

    expect(withHoverTooltips(bare)).toBe(bare);
  });

  test('renders the hovered município with its value, falling back to its code and to "Sem dado"', () => {
    const render = withHoverTooltips(spec).layers?.[0].hoverTooltip?.render;
    const info = { layerId: 'l', sourceId: 's', point: { x: 0, y: 0 } };

    expect(render?.({ ...info, featureId: '1', value: 10 })).toMatchObject({
      props: { name: 'ALFA', primary: '10 · Pessoas atendidas' },
    });
    expect(render?.({ ...info, featureId: '9', value: null })).toMatchObject({
      props: { name: 'Município 9', primary: 'Sem dado' },
    });
  });

  test('names every município from `nomes`, ahead of the upper-cased inline names, and also on bare polygon tooltips', () => {
    const withFill = {
      ...spec,
      layers: [
        ...(spec.layers ?? []),
        {
          id: 'fill',
          sourceId: 'mun',
          geometry: 'polygon',
          mapDataId: 'pessoas',
          hoverTooltip: { style: {} },
        },
      ],
    } as unknown as VisualizationSpec;
    const info = { layerId: 'l', sourceId: 's', point: { x: 0, y: 0 } };
    const result = withHoverTooltips(withFill, {
      nomes: { '1': 'Alfa', '2': 'Beta' },
    });
    const fillRender = result.layers?.find((layer) => {
      return layer.id === 'fill';
    })?.hoverTooltip?.render;

    expect(
      result.layers?.[0].hoverTooltip?.render?.({
        ...info,
        featureId: '2',
        value: 5,
      })
    ).toMatchObject({ props: { name: 'Beta' } });
    expect(fillRender?.({ ...info, featureId: '1', value: 10 })).toMatchObject({
      props: { name: 'Alfa', primary: '10 · Pessoas atendidas' },
    });
  });

  test('ignores sources without inline município features and layers with no matching mapData', () => {
    const odd = {
      engine: 'maplibre',
      sources: [
        { id: 'mun', type: 'geojson', data: '/geo/geojs-100-mun.json' },
        { id: 'tiles', type: 'vector', url: 'x' },
        {
          id: 'inline',
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: [
              { type: 'Feature', geometry: null },
              {
                type: 'Feature',
                geometry: null,
                properties: { codarea: 7, municipio: 'X' },
              },
            ],
          },
        },
      ],
      layers: [{ id: 'orphan', sourceId: 'mun', geometry: 'point' }],
      legends: [{ id: 'leg' }],
    } as unknown as VisualizationSpec;

    expect(withHoverTooltips(odd).layers).toEqual(odd.layers);
  });

  test('tolerates a spec with a boundary and legend but no layers or mapData', () => {
    const empty = {
      engine: 'maplibre',
      sources: [
        { id: 'mun', type: 'geojson', data: '/geo/geojs-100-mun.json' },
      ],
      legends: [{ id: 'leg' }],
    } as unknown as VisualizationSpec;

    expect(withHoverTooltips(empty)).toMatchObject({ layers: [], mapData: [] });
  });
});

describe('withHoverTooltips on a legend-driven choropleth', () => {
  test('gives the IVS-style fill layer the /mapas card, named from the spec features', () => {
    const choropleth = {
      engine: 'maplibre',
      sources: [
        {
          id: 'mun',
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [0, 0] },
                properties: { codarea: '1', municipio: 'ALFA' },
              },
            ],
          },
        },
      ],
      layers: [
        {
          id: 'fill',
          sourceId: 'mun',
          geometry: 'polygon',
          mapDataId: 'ivs',
          activeLegendId: 'leg',
        },
      ],
      mapData: [{ mapDataId: 'ivs', mapId: 'mun', title: 'IVS', data: [] }],
      legends: [
        {
          id: 'leg',
          colorBy: {
            type: 'quantitative',
            scale: 'threshold',
            thresholds: [0.001, 0.2],
            colors: ['#g', '#a', '#b'],
          },
          labelFormat: {
            type: 'labels',
            labels: ['Sem dado', 'Baixa (≤ 0,200)', 'Alta (≥ 0,201)'],
          },
        },
      ],
    } as unknown as VisualizationSpec;

    const render =
      withHoverTooltips(choropleth).layers?.[0].hoverTooltip?.render;

    expect(
      render?.({
        layerId: 'l',
        sourceId: 's',
        point: { x: 0, y: 0 },
        featureId: '1',
        value: 0.3,
      })
    ).toMatchObject({
      props: { name: 'ALFA', swatchColor: '#b', primary: 'IVS 0,3 · Alta' },
    });
  });
});
