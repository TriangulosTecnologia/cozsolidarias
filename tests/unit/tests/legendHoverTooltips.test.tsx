import type { VisualizationSpec } from '@ttoss/geovis';
import { withLegendHoverTooltips } from 'src/app/(features)/ia/legendHoverTooltips';

const info = { layerId: 'l', sourceId: 's', point: { x: 0, y: 0 } };

/** The shape `/api/ai/spec` serves for `golden-ivs`: the fill layer has no `hoverTooltip`. */
const ivsSpec = {
  engine: 'maplibre',
  sources: [
    { id: 'municipios', type: 'geojson', data: '/geo/geojs-100-mun.json' },
  ],
  layers: [
    {
      id: 'municipios-boundary-line',
      sourceId: 'municipios',
      geometry: 'line',
    },
    {
      id: 'municipios-fill',
      sourceId: 'municipios',
      geometry: 'polygon',
      mapDataId: 'municipios_ivs',
      activeLegendId: 'municipios_ivs-legend',
      hoverPaint: { lineWidth: 2 },
    },
  ],
  mapData: [
    {
      mapDataId: 'municipios_ivs',
      mapId: 'municipios',
      title: 'IVS',
      data: [{ geometryId: '5300108', value: 0.294 }],
    },
  ],
  legends: [
    {
      id: 'municipios_ivs-legend',
      colorBy: {
        type: 'quantitative',
        scale: 'threshold',
        thresholds: [0.001, 0.2, 0.3, 0.4, 0.5],
        colors: ['#g0', '#c1', '#c2', '#c3', '#c4', '#c5'],
      },
      labelFormat: {
        type: 'labels',
        labels: [
          'Sem dado',
          'Muito baixa (≤ 0,200)',
          'Baixa (0,201–0,300)',
          'Média (0,301–0,400)',
          'Alta (0,401–0,500)',
          'Muito alta (≥ 0,501)',
        ],
      },
    },
  ],
} as unknown as VisualizationSpec;

const fillRender = (names: Map<string, string>) => {
  const result = withLegendHoverTooltips({ spec: ivsSpec, names });
  const render = result.layers?.find((layer) => {
    return layer.id === 'municipios-fill';
  })?.hoverTooltip?.render;
  if (!render) {
    throw new Error('the fill layer got no hoverTooltip.render');
  }
  return render;
};

describe('withLegendHoverTooltips', () => {
  const names = new Map([['5300108', 'Brasília']]);

  test('gives the legend-driven fill layer a card: name, band color, value and faixa, as /mapas does', () => {
    expect(
      fillRender(names)({ ...info, featureId: '5300108', value: 0.294 })
    ).toMatchObject({
      props: {
        name: 'Brasília',
        swatchColor: '#c2',
        primary: 'IVS 0,294 · Baixa',
      },
    });
  });

  test('reads the band from the legend thresholds, the same step rule that paints the map', () => {
    expect(
      fillRender(names)({ ...info, featureId: '5300108', value: 0.5 })
    ).toMatchObject({
      props: { swatchColor: '#c5', primary: 'IVS 0,5 · Muito alta' },
    });
  });

  test('says "Sem dado" for a value under the floor or a non-number, with the grey swatch', () => {
    expect(
      fillRender(names)({ ...info, featureId: '5300108', value: 0 })
    ).toMatchObject({
      props: { swatchColor: '#g0', primary: 'Sem dado de IVS' },
    });
    expect(
      fillRender(names)({ ...info, featureId: '5300108', value: undefined })
    ).toMatchObject({
      props: { swatchColor: '#g0', primary: 'Sem dado de IVS' },
    });
  });

  test('falls back to the codarea when the município has no name', () => {
    expect(
      fillRender(new Map())({ ...info, featureId: '1', value: 0.294 })
    ).toMatchObject({
      props: { name: 'Município 1' },
    });
  });

  test('leaves alone layers with a render already, lines, layers with no mapData and legends that are not a labelled threshold scale', () => {
    const base = ivsSpec.layers ?? [];
    const rendered = {
      ...base[1],
      hoverTooltip: {
        render: () => {
          return null;
        },
      },
    };
    const noData = { ...base[1], id: 'bare', mapDataId: undefined };
    const categorical = {
      ...ivsSpec,
      layers: [base[1]],
      legends: [
        {
          id: 'municipios_ivs-legend',
          colorBy: { type: 'categorical', mapping: {} },
        },
      ],
    } as unknown as VisualizationSpec;
    const unlabelled = {
      ...ivsSpec,
      legends: [
        {
          id: 'municipios_ivs-legend',
          colorBy: {
            type: 'quantitative',
            scale: 'threshold',
            thresholds: [1],
            colors: ['a', 'b'],
          },
        },
      ],
    } as unknown as VisualizationSpec;
    const unknownLegend = {
      ...ivsSpec,
      legends: [],
    } as unknown as VisualizationSpec;
    const noCuts = {
      ...ivsSpec,
      legends: [
        {
          id: 'municipios_ivs-legend',
          colorBy: { type: 'quantitative', scale: 'threshold' },
          labelFormat: { type: 'labels', labels: ['a'] },
        },
      ],
    } as unknown as VisualizationSpec;
    const withRendered = {
      ...ivsSpec,
      layers: [base[0], rendered, noData],
    } as unknown as VisualizationSpec;

    expect(
      withLegendHoverTooltips({ spec: withRendered, names }).layers
    ).toEqual(withRendered.layers);
    expect(
      withLegendHoverTooltips({ spec: categorical, names }).layers
    ).toEqual(categorical.layers);
    expect(withLegendHoverTooltips({ spec: unlabelled, names }).layers).toEqual(
      unlabelled.layers
    );
    expect(withLegendHoverTooltips({ spec: noCuts, names }).layers).toEqual(
      noCuts.layers
    );
    expect(
      withLegendHoverTooltips({ spec: unknownLegend, names }).layers
    ).toEqual(unknownLegend.layers);
    expect(
      withLegendHoverTooltips({
        spec: { ...ivsSpec, layers: undefined },
        names,
      }).layers
    ).toBeUndefined();
  });

  test('keeps the style of a bare hoverTooltip and drops the label when mapData has no title', () => {
    const base = ivsSpec.layers ?? [];
    const styled = {
      ...ivsSpec,
      layers: [{ ...base[1], hoverTooltip: { style: { color: 'red' } } }],
      mapData: [{ ...(ivsSpec.mapData ?? [])[0], title: undefined }],
    } as unknown as VisualizationSpec;
    const layer = withLegendHoverTooltips({ spec: styled, names }).layers?.[0];

    expect(layer?.hoverTooltip?.style).toEqual({ color: 'red' });
    expect(
      layer?.hoverTooltip?.render?.({
        ...info,
        featureId: '5300108',
        value: 0.294,
      })
    ).toMatchObject({
      props: { primary: '0,294 · Baixa' },
    });
    expect(
      layer?.hoverTooltip?.render?.({ ...info, featureId: '5300108', value: 0 })
    ).toMatchObject({ props: { primary: 'Sem dado' } });
  });
});
