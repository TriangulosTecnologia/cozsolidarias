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
