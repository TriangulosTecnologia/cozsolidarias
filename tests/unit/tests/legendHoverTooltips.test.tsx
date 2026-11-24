import type { VisualizationSpec } from '@ttoss/geovis';
import {
  paintsCadinsan,
  paintsCadunicoCoverage,
  withLegendHoverTooltips,
} from 'src/app/(features)/ia/legendHoverTooltips';
import type {
  CadinsanByCity,
  KitchenRateByCity,
} from 'src/data-gateway/schema';

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

/** Altamira/PA, as `/api/cadinsan/por-municipio` serves it. */
const ALTAMIRA: CadinsanByCity = {
  codigoIbge: '1500602',
  municipio: 'Altamira',
  uf: 'Pará',
  regiao: 'Norte',
  absolutoComPbf: 2616,
  absolutoSemPbf: 5779,
  cadastrosCadunico: 14656,
  proporcaoComPbf: 17.85,
  proporcaoSemPbf: 39.43,
};

/** The shape `/api/ai/spec` serves for a CADINSAN share: the `/mapas` ruler and labels on the legend. */
const cadinsanSpec = (mapDataId: string) => {
  return {
    engine: 'maplibre',
    sources: [
      { id: 'municipios', type: 'geojson', data: '/geo/geojs-100-mun.json' },
    ],
    layers: [
      {
        id: 'municipios-fill',
        sourceId: 'municipios',
        geometry: 'polygon',
        mapDataId,
        activeLegendId: 'l',
      },
    ],
    mapData: [{ mapDataId, mapId: 'municipios', title: 'Insegurança' }],
    legends: [
      {
        id: 'l',
        colorBy: {
          type: 'quantitative',
          scale: 'threshold',
          thresholds: [0, 10, 20, 30, 40],
          colors: ['#v0', '#c1', '#c2', '#c3', '#c4', '#c5'],
        },
        labelFormat: {
          type: 'labels',
          labels: [
            'Sem dado',
            '< 10%',
            '10 – 20%',
            '20 – 30%',
            '30 – 40%',
            '40%+',
          ],
        },
      },
    ],
  } as unknown as VisualizationSpec;
};

const cadinsanRender = (params: {
  mapDataId: string;
  cadinsan?: Map<string, CadinsanByCity>;
}) => {
  const render = withLegendHoverTooltips({
    spec: cadinsanSpec(params.mapDataId),
    names: new Map([['1500602', 'Altamira']]),
    cadinsan: params.cadinsan,
  }).layers?.[0].hoverTooltip?.render;
  if (!render) {
    throw new Error('the fill layer got no hoverTooltip.render');
  }
  return render;
};

describe('withLegendHoverTooltips on a CADINSAN share', () => {
  const cadinsan = new Map([['1500602', ALTAMIRA]]);

  test('reads the /mapas CADINSAN lines with the faixa after the share', () => {
    expect(
      cadinsanRender({ mapDataId: 'municipios_cadinsan_sem_pbf', cadinsan })({
        ...info,
        featureId: '1500602',
        value: 39.43,
      })
    ).toMatchObject({
      props: {
        name: 'Altamira',
        swatchColor: '#c4',
        primary:
          '39,4% em insegurança alimentar (sem o Bolsa Família) · 30 – 40%',
        secondary: '5.779 de 14.656 famílias do CadÚnico neste cenário',
        details: ['Com o Bolsa Família, cai para 17,9% (2.616 famílias)'],
      },
    });
    expect(
      cadinsanRender({ mapDataId: 'municipios_cadinsan', cadinsan })({
        ...info,
        featureId: '1500602',
        value: 17.85,
      })
    ).toMatchObject({
      props: {
        swatchColor: '#c2',
        primary:
          '17,9% em insegurança alimentar (com o Bolsa Família) · 10 – 20%',
        details: ['Sem o Bolsa Família, seria 39,4% (5.779 famílias)'],
      },
    });
  });

  test('keeps the plain band card without the município row, and "Sem dado" for no value', () => {
    const render = cadinsanRender({ mapDataId: 'municipios_cadinsan' });

    expect(render({ ...info, featureId: '1500602', value: 0 })).toMatchObject({
      props: { swatchColor: '#c1', primary: 'Insegurança 0 · < 10%' },
    });
    expect(
      cadinsanRender({ mapDataId: 'municipios_cadinsan', cadinsan })({
        ...info,
        featureId: '1500602',
        value: undefined,
      })
    ).toMatchObject({
      props: { swatchColor: '#v0', primary: 'Sem dado de Insegurança' },
    });
  });
});

describe('paintsCadinsan', () => {
  test('is true only for a spec whose mapData paints a CADINSAN share', () => {
    expect(paintsCadinsan(cadinsanSpec('municipios_cadinsan_sem_pbf'))).toBe(
      true
    );
    expect(paintsCadinsan(ivsSpec)).toBe(false);
    expect(paintsCadinsan({ ...ivsSpec, mapData: undefined })).toBe(false);
  });
});

/** Salvador/BA, as `/api/cozinhas/por-municipio` serves it. */
const SALVADOR: KitchenRateByCity = {
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
};

/**
 * A CadÚnico coverage spec: the CADINSAN shape on the `/mapas` 10 mil ruler,
 * with the rate `normalization` the route writes when `rateBase` is given.
 */
const coverageSpec = (
  mapDataId: string,
  rateBase?: number
): VisualizationSpec => {
  const spec = cadinsanSpec(mapDataId);
  return {
    ...spec,
    mapData: [{ mapDataId, mapId: 'municipios', title: 'Cobertura' }],
    legends: [
      {
        id: 'l',
        ...(rateBase === undefined
          ? {}
          : {
              normalization: {
                type: 'rate' as const,
                numeratorLabel: 'cozinhas',
                denominatorLabel: 'pessoas no CadÚnico',
                rateBase,
              },
            }),
        colorBy: {
          type: 'quantitative',
          scale: 'threshold',
          thresholds: [0.01, 0.2, 0.5, 1, 2, 4],
          colors: ['#v0', '#c1', '#c2', '#c3', '#c4', '#c5', '#c6'],
        },
        labelFormat: {
          type: 'labels',
          labels: [
            'Sem cozinha',
            '< 0,2',
            '0,2 – 0,5',
            '0,5 – 1',
            '1 – 2',
            '2 – 4',
            '4+',
          ],
        },
      },
    ],
  };
};

const coverageRender = (params: {
  mapDataId: string;
  rateBase?: number;
  cozinhas?: Map<string, KitchenRateByCity>;
}) => {
  const render = withLegendHoverTooltips({
    spec: coverageSpec(params.mapDataId, params.rateBase),
    names: new Map([['2927408', 'Salvador']]),
    cozinhas: params.cozinhas,
  }).layers?.[0].hoverTooltip?.render;
  if (!render) {
    throw new Error('the fill layer got no hoverTooltip.render');
  }
  return render;
};

describe('withLegendHoverTooltips on a CadÚnico coverage', () => {
  const cozinhas = new Map([['2927408', SALVADOR]]);

  test.each([
    [
      'cozinhas_por_10mil_cadunico',
      10_000,
      0.22,
      '#c2',
      '0,22 por 10 mil no CadÚnico · 0,2 – 0,5',
    ],
    [
      'cozinhas_por_100mil_cadunico',
      100_000,
      2.25,
      '#c5',
      '2,25 por 100 mil no CadÚnico · 2 – 4',
    ],
    [
      // Any base: the one the legend carries.
      'cozinhas_por_50mil_cadunico',
      50_000,
      1.12,
      '#c4',
      '1,12 por 50 mil no CadÚnico · 1 – 2',
    ],
    [
      'cadunico_pessoas_por_cozinha',
      undefined,
      44531,
      '#c6',
      '44.531 pessoas por cozinha · 4+',
    ],
  ])(
    'reads %s (base %s) with the /mapas lines and the faixa after the value',
    (mapDataId, rateBase, value, swatchColor, primary) => {
      expect(
        coverageRender({ mapDataId, rateBase, cozinhas })({
          ...info,
          featureId: '2927408',
          value,
        })
      ).toMatchObject({
        props: {
          name: 'Salvador',
          swatchColor,
          primary,
          secondary: '26 cozinhas · 1.157.799 no CadÚnico',
        },
      });
    }
  );

  test('writes a base of one thousand as "mil" and a single cozinha in the singular', () => {
    expect(
      coverageRender({
        mapDataId: 'cozinhas_por_1mil_cadunico',
        rateBase: 1_000,
        cozinhas: new Map([['2927408', { ...SALVADOR, quantidade: 1 }]]),
      })({ ...info, featureId: '2927408', value: 0.02 })
    ).toMatchObject({
      props: {
        primary: '0,02 por mil no CadÚnico · < 0,2',
        secondary: '1 cozinha · 1.157.799 no CadÚnico',
      },
    });
  });

  test('keeps the plain band card for a rate whose legend carries no base', () => {
    expect(
      coverageRender({ mapDataId: 'cozinhas_por_10mil_cadunico', cozinhas })({
        ...info,
        featureId: '2927408',
        value: 0.22,
      })
    ).toMatchObject({ props: { primary: 'Cobertura 0,22 · 0,2 – 0,5' } });
  });

  test('says "Sem cozinha registrada" for a município with no value, as /mapas does', () => {
    expect(
      coverageRender({
        mapDataId: 'cozinhas_por_10mil_cadunico',
        rateBase: 10_000,
        cozinhas,
      })({
        ...info,
        featureId: '2927408',
        value: undefined,
      })
    ).toMatchObject({
      props: {
        swatchColor: '#v0',
        primary: 'Sem cozinha registrada',
        secondary: undefined,
      },
    });
  });

  test('keeps the value line without the município row', () => {
    expect(
      coverageRender({
        mapDataId: 'cozinhas_por_10mil_cadunico',
        rateBase: 10_000,
      })({
        ...info,
        featureId: '2927408',
        value: 0.22,
      })
    ).toMatchObject({
      props: {
        primary: '0,22 por 10 mil no CadÚnico · 0,2 – 0,5',
        secondary: undefined,
      },
    });
  });
});

describe('paintsCadunicoCoverage', () => {
  test('is true only for a spec whose mapData paints a CadÚnico coverage', () => {
    expect(
      paintsCadunicoCoverage(coverageSpec('cadunico_pessoas_por_cozinha'))
    ).toBe(true);
    expect(
      paintsCadunicoCoverage(cadinsanSpec('municipios_cadinsan_sem_pbf'))
    ).toBe(false);
    expect(
      paintsCadunicoCoverage(coverageSpec('cozinhas_por_50mil_cadunico'))
    ).toBe(true);
    expect(paintsCadunicoCoverage({ ...ivsSpec, mapData: undefined })).toBe(
      false
    );
  });
});
