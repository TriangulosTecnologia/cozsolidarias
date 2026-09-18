import {
  findDanglingActiveLegendId,
  findDotDensityWithoutRatio,
  findForeignNoDataColor,
  findLegendPropertyMismatch,
  findLegendScaleArityMismatch,
  findReclassifiedOfficialIndex,
  NO_DATA_COLOR,
  OFFICIAL_CLASSIFICATIONS,
} from 'src/app/api/ai/spec/specValidation';

/** A well-formed IVS legend: official faixas, app palette, `value` property. */
const ivsLegend = {
  id: 'legenda-ivs',
  title: 'Índice de vulnerabilidade social',
  colorBy: {
    type: 'quantitative',
    property: 'value',
    scale: 'threshold',
    thresholds: [0.001, 0.2, 0.3, 0.4, 0.5],
    colors: [
      NO_DATA_COLOR,
      '#FCBBA1',
      '#FC7E5E',
      '#EF3B2C',
      '#B81419',
      '#4F000A',
    ],
    defaultColor: NO_DATA_COLOR,
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
};

const ivsSpec = {
  mapType: 'choropleth',
  legends: [ivsLegend],
  layers: [
    {
      id: 'municipios-fill',
      sourceId: 'municipios',
      geometry: 'polygon',
      mapDataId: 'municipios_ivs',
      activeLegendId: 'legenda-ivs',
    },
  ],
};

describe('findLegendScaleArityMismatch', () => {
  test('accepts a legend whose colours and labels both match thresholds + 1', () => {
    expect(findLegendScaleArityMismatch(ivsSpec)).toBeNull();
  });

  test('rejects a colour list shorter than the bin count', () => {
    const spec = {
      legends: [
        {
          id: 'legenda-cozinhas',
          colorBy: {
            type: 'quantitative',
            property: 'value',
            scale: 'threshold',
            thresholds: [1, 3, 6, 11, 26],
            colors: ['#C6DBEF', '#86BCDC', '#58A0CE', '#2E7CBB', '#1761A8'],
          },
        },
      ],
    };

    expect(findLegendScaleArityMismatch(spec)).toEqual({
      legendId: 'legenda-cozinhas',
      field: 'colors',
      expected: 6,
      received: 5,
    });
  });

  test('rejects an explicit label list that does not cover every bin', () => {
    const spec = {
      legends: [
        {
          id: 'legenda-cadinsan',
          colorBy: {
            type: 'quantitative',
            property: 'value',
            scale: 'threshold',
            thresholds: [0, 10, 20, 30, 40],
            colors: [
              NO_DATA_COLOR,
              '#C6DBEF',
              '#86BCDC',
              '#58A0CE',
              '#2E7CBB',
              '#1761A8',
            ],
          },
          labelFormat: {
            type: 'labels',
            labels: ['< 10%', '10 – 20%', '20 – 30%', '30 – 40%', '40%+'],
          },
        },
      ],
    };

    expect(findLegendScaleArityMismatch(spec)?.field).toBe('labels');
  });

  test('ignores a quantitative legend with no explicit thresholds', () => {
    const spec = {
      legends: [
        {
          id: 'l',
          colorBy: {
            type: 'quantitative',
            property: 'value',
            scale: 'threshold',
          },
        },
      ],
    };

    expect(findLegendScaleArityMismatch(spec)).toBeNull();
  });

  test('ignores a labelFormat that is not the explicit-labels variant', () => {
    const spec = {
      legends: [
        {
          id: 'l',
          colorBy: {
            type: 'quantitative',
            property: 'value',
            scale: 'threshold',
            thresholds: [1, 3],
            colors: ['#EEE6DA', '#C6DBEF', '#08306B'],
          },
          labelFormat: { type: 'count', abbreviate: true },
        },
      ],
    };

    expect(findLegendScaleArityMismatch(spec)).toBeNull();
  });

  test('skips malformed legend and layer entries', () => {
    const spec = {
      legends: [null, 'legend', { title: 'sem id' }],
      layers: [null, 42, { id: 'fill', legends: [{ id: 'inline' }] }],
    };

    expect(findLegendScaleArityMismatch(spec)).toBeNull();
    expect(findDanglingActiveLegendId(spec)).toBeNull();
  });

  test('ignores categorical legends, which have no thresholds', () => {
    const spec = {
      legends: [
        {
          id: 'status',
          colorBy: {
            type: 'categorical',
            property: 'value',
            mapping: { ativa: '#08306B' },
          },
        },
      ],
    };

    expect(findLegendScaleArityMismatch(spec)).toBeNull();
  });
});

describe('findDanglingActiveLegendId', () => {
  test('accepts a layer pointing at a spec-level legend', () => {
    expect(findDanglingActiveLegendId(ivsSpec)).toBeNull();
  });

  test('accepts a layer pointing at a legend declared on a layer', () => {
    const spec = {
      layers: [
        {
          id: 'fill',
          activeLegendId: 'inline',
          legends: [{ id: 'inline' }],
        },
      ],
    };

    expect(findDanglingActiveLegendId(spec)).toBeNull();
  });

  test('rejects an activeLegendId no legend declares', () => {
    const spec = {
      legends: [{ id: 'legenda-ivs' }],
      layers: [{ id: 'fill', activeLegendId: 'legenda-cozinhas' }],
    };

    expect(findDanglingActiveLegendId(spec)).toEqual({
      layerId: 'fill',
      activeLegendId: 'legenda-cozinhas',
    });
  });
});

describe('findLegendPropertyMismatch', () => {
  test('accepts the joined "value" property', () => {
    expect(findLegendPropertyMismatch(ivsSpec)).toBeNull();
  });

  test('rejects a legend colouring by the dataset field name', () => {
    const spec = {
      legends: [
        {
          id: 'legenda-ivs',
          colorBy: {
            type: 'quantitative',
            property: 'ivs',
            scale: 'threshold',
            thresholds: [0.001, 0.2],
          },
        },
      ],
      layers: [
        {
          id: 'fill',
          mapDataId: 'municipios_ivs',
          activeLegendId: 'legenda-ivs',
        },
      ],
    };

    expect(findLegendPropertyMismatch(spec)).toEqual({
      legendId: 'legenda-ivs',
      property: 'ivs',
    });
  });

  test('ignores a legend that declares no colorBy at all', () => {
    const spec = {
      legends: [{ id: 'l', title: 'Sem colorBy' }],
      layers: [
        { id: 'fill', mapDataId: 'municipios_ivs', activeLegendId: 'l' },
      ],
    };

    expect(findLegendPropertyMismatch(spec)).toBeNull();
  });

  test('ignores layers that read values off feature properties', () => {
    const spec = {
      legends: [
        {
          id: 'l',
          colorBy: { type: 'quantitative', property: 'quantidade' },
        },
      ],
      layers: [{ id: 'fill', propertyName: 'quantidade', activeLegendId: 'l' }],
    };

    expect(findLegendPropertyMismatch(spec)).toBeNull();
  });
});

describe('findForeignNoDataColor', () => {
  test('accepts the application "sem dado" grey', () => {
    expect(findForeignNoDataColor(ivsSpec)).toBeNull();
  });

  test('rejects a defaultColor picked outside the application palette', () => {
    const spec = {
      legends: [
        {
          id: 'l',
          colorBy: {
            type: 'quantitative',
            property: 'value',
            scale: 'threshold',
            thresholds: [1, 3],
            defaultColor: '#FFFFFF',
          },
        },
      ],
    };

    expect(findForeignNoDataColor(spec)).toEqual({
      legendId: 'l',
      declared: '#FFFFFF',
    });
  });

  test('rejects a quantitative legend that omits defaultColor entirely', () => {
    const spec = {
      legends: [
        {
          id: 'l',
          colorBy: {
            type: 'quantitative',
            property: 'value',
            scale: 'threshold',
            thresholds: [1, 3],
          },
        },
      ],
    };

    expect(findForeignNoDataColor(spec)).toEqual({
      legendId: 'l',
      declared: null,
    });
  });
});

describe('findReclassifiedOfficialIndex', () => {
  test('accepts the IPEA faixas for municipios_ivs', () => {
    expect(findReclassifiedOfficialIndex(ivsSpec)).toBeNull();
  });

  test('rejects breaks refitted to the data for a published index', () => {
    const spec = {
      legends: [
        {
          ...ivsLegend,
          colorBy: {
            ...ivsLegend.colorBy,
            thresholds: [0.001, 0.19, 0.28, 0.37, 0.46],
          },
        },
      ],
      layers: ivsSpec.layers,
    };

    expect(findReclassifiedOfficialIndex(spec)).toEqual({
      mapDataId: 'municipios_ivs',
      expected: OFFICIAL_CLASSIFICATIONS['municipios_ivs'].thresholds,
      source: OFFICIAL_CLASSIFICATIONS['municipios_ivs'].source,
    });
  });

  test('ignores datasets the application classifies itself', () => {
    const spec = {
      legends: [
        {
          id: 'l',
          colorBy: {
            type: 'quantitative',
            property: 'value',
            scale: 'threshold',
            thresholds: [1, 3, 6, 11, 26],
          },
        },
      ],
      layers: [
        {
          id: 'fill',
          mapDataId: 'cozinhas_geolocalizadas',
          activeLegendId: 'l',
        },
      ],
    };

    expect(findReclassifiedOfficialIndex(spec)).toBeNull();
  });
});

describe('findDotDensityWithoutRatio', () => {
  test('ignores specs that are not dot density', () => {
    expect(findDotDensityWithoutRatio(ivsSpec)).toBe(false);
  });

  test('accepts a ratio stated in the legend subtitle', () => {
    const spec = {
      mapType: 'dotDensity',
      legends: [
        {
          id: 'l',
          title: 'Pessoas atendidas',
          subtitle: '1 ponto = 1.000 pessoas',
        },
      ],
    };

    expect(findDotDensityWithoutRatio(spec)).toBe(false);
  });

  test('accepts a ratio stated in an explicit label', () => {
    const spec = {
      mapType: 'dotDensity',
      legends: [
        {
          id: 'l',
          labelFormat: {
            type: 'labels',
            labels: ['cada ponto = 500 cozinhas'],
          },
        },
      ],
    };

    expect(findDotDensityWithoutRatio(spec)).toBe(false);
  });

  test('rejects a dot-density spec whose legends never state the ratio', () => {
    const spec = {
      mapType: 'dotDensity',
      legends: [
        { id: 'l', title: 'Pessoas atendidas', subtitle: 'Por município' },
      ],
    };

    expect(findDotDensityWithoutRatio(spec)).toBe(true);
  });
});
