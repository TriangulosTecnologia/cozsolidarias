import {
  buildLegendItems,
  buildSpec,
  colorForCadUnico,
  colorForIvs,
  colorForPercentual,
  colorForPessoasPorCozinha,
  colorForQuantidade,
  colorForSituacao,
  colorForTaxa,
  ivsFaixaLabel,
} from 'src/app/(features)/mapas/geovisSpec';
import type {
  CozinhasFeatureCollection,
  CozinhasStatusFeatureCollection,
  kitchenRateByCity,
  MunicipioIvs,
} from 'src/data-gateway/schema';

const BY_CITY: kitchenRateByCity[] = [
  {
    codigoIbge: '111',
    municipio: 'Alpha',
    quantidade: 5,
    populacao: 100_000,
    porCemMil: 5,
    percentualDoBrasil: 71.43,
    pessoasCadUnico: 50_000,
    porDezMilCadUnico: 1,
    pessoasPorCozinha: 10_000,
  },
  {
    codigoIbge: '222',
    municipio: 'Beta',
    quantidade: 2,
    populacao: null,
    porCemMil: null,
    percentualDoBrasil: 28.57,
    pessoasCadUnico: null,
    porDezMilCadUnico: null,
    pessoasPorCozinha: null,
  },
];

const IVS_BY_CITY: MunicipioIvs[] = [
  {
    codigoIbge: '111',
    municipio: 'Alpha',
    ivs: 0.15,
    ivsInfraestruturaUrbana: 0.1,
    ivsCapitalHumano: 0.35,
    ivsRendaETrabalho: 0.45,
  },
  {
    codigoIbge: '222',
    municipio: 'Beta',
    ivs: 0.55,
    ivsInfraestruturaUrbana: 0.6,
    ivsCapitalHumano: 0.25,
    ivsRendaETrabalho: 0.7,
  },
];

const COZINHAS: CozinhasFeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-46.6, -23.5] },
      properties: { nome: 'Cozinha A', codigo: 'CS1' },
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-46.7, -23.6] },
      properties: { nome: 'Cozinha B', codigo: 'CS2' },
    },
  ],
};

/** Finds a `mapData` entry by id in a built spec. */
const mapDataById = (
  spec: ReturnType<typeof buildSpec>,
  id: string
): { data: { geometryId: string; value: number }[] } | undefined => {
  return spec.mapData?.find((entry) => {
    return entry.mapDataId === id;
  }) as { data: { geometryId: string; value: number }[] } | undefined;
};

/** Ids of the layers a built spec renders. */
const layerIds = (spec: ReturnType<typeof buildSpec>): string[] => {
  return spec.layers.map((layer) => {
    return layer.id;
  });
};

describe('colorForQuantidade', () => {
  test('municípios with no kitchens resolve to the "sem cozinha" fill', () => {
    expect(colorForQuantidade(0)).toBe(colorForTaxa(null));
  });

  test('the first count band differs from the "sem cozinha" fill', () => {
    expect(colorForQuantidade(1)).not.toBe(colorForQuantidade(0));
  });

  test('counts above the top threshold share the darkest band', () => {
    expect(colorForQuantidade(100)).toBe(colorForQuantidade(50));
  });
});

describe('colorForTaxa', () => {
  test('an unknown rate resolves to the "sem dado" fill', () => {
    expect(colorForTaxa(null)).toBe(colorForQuantidade(0));
  });

  test('a rate below 1 is a real, painted band, distinct from "sem dado"', () => {
    expect(colorForTaxa(0.5)).not.toBe(colorForTaxa(null));
  });

  test('rates above the top threshold share the darkest band', () => {
    expect(colorForTaxa(100)).toBe(colorForTaxa(50));
  });

  test('higher rates map to a different (darker) band than lower rates', () => {
    expect(colorForTaxa(2)).not.toBe(colorForTaxa(20));
  });
});

describe('colorForPercentual', () => {
  test('a município with no cozinha (share 0) resolves to the "sem cozinha" fill', () => {
    expect(colorForPercentual(0)).toBe(colorForQuantidade(0));
  });

  test('any positive share, however small, is a painted band distinct from "sem cozinha"', () => {
    // Regression: shares below the old first break (0.05%) — e.g. Ourinhos at
    // 0.04% — must be blue, not grey.
    expect(colorForPercentual(0.02)).not.toBe(colorForPercentual(0));
    expect(colorForPercentual(0.04)).not.toBe(colorForPercentual(0));
  });

  test('shares above the top threshold share the darkest band', () => {
    expect(colorForPercentual(50)).toBe(colorForPercentual(5));
  });

  test('higher shares map to a different (darker) band than lower shares', () => {
    expect(colorForPercentual(0.02)).not.toBe(colorForPercentual(2));
  });
});

describe('colorForSituacao', () => {
  test('each canonical status gets its own color, distinct from "sem dado"', () => {
    expect(colorForSituacao('Habilitada')).not.toBe(colorForSituacao(null));
    expect(colorForSituacao('Não Habilitada')).not.toBe(colorForSituacao(null));
  });

  test('distinct statuses get distinct colors', () => {
    expect(colorForSituacao('Habilitada')).not.toBe(
      colorForSituacao('Não Habilitada')
    );
  });
});

describe('colorForCadUnico', () => {
  test('an unknown rate resolves to the "sem dado" fill', () => {
    expect(colorForCadUnico(null)).toBe(colorForQuantidade(0));
  });

  test('a rate below the first break (no cozinha) resolves to the "sem cozinha" fill', () => {
    expect(colorForCadUnico(0.005)).toBe(colorForQuantidade(0));
  });

  test('any rate at or above the first break is a painted band distinct from "sem cozinha"', () => {
    expect(colorForCadUnico(0.1)).not.toBe(colorForCadUnico(null));
  });

  test('rates above the top threshold share the darkest band', () => {
    expect(colorForCadUnico(10)).toBe(colorForCadUnico(5));
  });

  test('higher rates map to a different (darker) band than lower rates', () => {
    expect(colorForCadUnico(0.1)).not.toBe(colorForCadUnico(3));
  });
});

describe('colorForPessoasPorCozinha', () => {
  test('an unknown value resolves to the "sem dado" fill', () => {
    expect(colorForPessoasPorCozinha(null)).toBe(colorForQuantidade(0));
  });

  test('a value below the first break (no cozinha) resolves to the "sem cozinha" fill', () => {
    expect(colorForPessoasPorCozinha(0.5)).toBe(colorForQuantidade(0));
  });

  test('any value at or above the first break is a painted band distinct from "sem cozinha"', () => {
    expect(colorForPessoasPorCozinha(3_000)).not.toBe(
      colorForPessoasPorCozinha(null)
    );
  });

  test('values above the top threshold share the darkest band', () => {
    expect(colorForPessoasPorCozinha(100_000)).toBe(
      colorForPessoasPorCozinha(90_000)
    );
  });

  test('more people per cozinha map to a different (darker) band', () => {
    expect(colorForPessoasPorCozinha(3_000)).not.toBe(
      colorForPessoasPorCozinha(50_000)
    );
  });
});

describe('colorForIvs', () => {
  test('an unknown score resolves to the "sem dado" fill', () => {
    expect(colorForIvs(null)).toBe(colorForQuantidade(0));
  });

  test('the lowest faixa is a real painted band, distinct from "sem dado"', () => {
    expect(colorForIvs(0.1)).not.toBe(colorForIvs(null));
  });

  test('scores at or above the top break share the darkest (muito alta) band', () => {
    expect(colorForIvs(0.9)).toBe(colorForIvs(0.5));
  });

  test('higher vulnerability maps to a different band than lower', () => {
    expect(colorForIvs(0.1)).not.toBe(colorForIvs(0.45));
  });
});

describe('ivsFaixaLabel', () => {
  test('maps each faixa boundary to its official name', () => {
    expect(ivsFaixaLabel(0.15)).toBe('Muito baixa');
    expect(ivsFaixaLabel(0.25)).toBe('Baixa');
    expect(ivsFaixaLabel(0.35)).toBe('Média');
    expect(ivsFaixaLabel(0.45)).toBe('Alta');
    expect(ivsFaixaLabel(0.6)).toBe('Muito alta');
  });

  test('returns null for an unknown score', () => {
    expect(ivsFaixaLabel(null)).toBeNull();
  });
});

describe('buildLegendItems', () => {
  test('leads with the "Sem cozinha" swatch', () => {
    expect(buildLegendItems()[0].label).toBe('Sem cozinha');
  });
});

describe('buildSpec', () => {
  test('coropletico feeds raw counts and positions the count legend', () => {
    const spec = buildSpec({ byCity: BY_CITY, mode: 'coropletico' });

    expect(mapDataById(spec, 'cozinhas-por-municipio')?.data).toEqual([
      { geometryId: '111', value: 5 },
      { geometryId: '222', value: 2 },
    ]);

    const countLegend = spec.legends?.find((legend) => {
      return legend.id === 'legenda-cozinhas';
    });
    const rateLegend = spec.legends?.find((legend) => {
      return legend.id === 'legenda-taxa';
    });
    expect(countLegend?.position).toBe('bottom-right');
    expect(rateLegend?.position).toBeUndefined();
  });

  test('coropletico-taxa feeds rates, drops unknown rates, positions the rate legend', () => {
    const spec = buildSpec({ byCity: BY_CITY, mode: 'coropletico-taxa' });

    // Beta (porCemMil === null) is dropped so it falls back to "sem dado".
    expect(mapDataById(spec, 'cozinhas-por-municipio')?.data).toEqual([
      { geometryId: '111', value: 5 },
    ]);

    const rateLegend = spec.legends?.find((legend) => {
      return legend.id === 'legenda-taxa';
    });
    expect(rateLegend?.position).toBe('bottom-right');
    expect(rateLegend?.noDataLabel).toBe('Sem dado');

    const fill = spec.layers.find((layer) => {
      return layer.id === 'municipios-br-fill';
    });
    expect(fill?.activeLegendId).toBe('legenda-taxa');
  });

  test('coropletico-percentual feeds shares and positions the share legend', () => {
    const spec = buildSpec({ byCity: BY_CITY, mode: 'coropletico-percentual' });

    // Every município is kept (percentualDoBrasil is never null).
    expect(mapDataById(spec, 'cozinhas-por-municipio')?.data).toEqual([
      { geometryId: '111', value: 71.43 },
      { geometryId: '222', value: 28.57 },
    ]);

    const percentLegend = spec.legends?.find((legend) => {
      return legend.id === 'legenda-percentual';
    });
    expect(percentLegend?.position).toBe('bottom-right');
    // The first break is a floor (0.01) below the smallest real share, so geovis
    // paints only municípios with no cozinha (coalesced 0) in the grey bin.
    expect(percentLegend?.colorBy.thresholds?.[0]).toBe(0.01);
    // The grey "below first break" swatch is labelled "Sem cozinha".
    if (percentLegend?.labelFormat?.type === 'labels') {
      expect(percentLegend.labelFormat.labels[0]).toBe('Sem cozinha');
    }

    const fill = spec.layers.find((layer) => {
      return layer.id === 'municipios-br-fill';
    });
    expect(fill?.activeLegendId).toBe('legenda-percentual');
  });

  test('coropletico-cadunico feeds CadÚnico rates, drops unknown rates, positions its legend', () => {
    const spec = buildSpec({ byCity: BY_CITY, mode: 'coropletico-cadunico' });

    // Beta (porDezMilCadUnico === null) is dropped so it falls back to "sem dado".
    expect(mapDataById(spec, 'cozinhas-por-municipio')?.data).toEqual([
      { geometryId: '111', value: 1 },
    ]);

    const cadUnicoLegend = spec.legends?.find((legend) => {
      return legend.id === 'legenda-cadunico';
    });
    expect(cadUnicoLegend?.position).toBe('bottom-right');

    const fill = spec.layers.find((layer) => {
      return layer.id === 'municipios-br-fill';
    });
    expect(fill?.activeLegendId).toBe('legenda-cadunico');
  });

  test('coropletico-pessoas-cozinha feeds coverage values, drops unknown, positions its legend', () => {
    const spec = buildSpec({
      byCity: BY_CITY,
      mode: 'coropletico-pessoas-cozinha',
    });

    // Beta (pessoasPorCozinha === null) is dropped so it falls back to "sem dado".
    expect(mapDataById(spec, 'cozinhas-por-municipio')?.data).toEqual([
      { geometryId: '111', value: 10_000 },
    ]);

    const coverageLegend = spec.legends?.find((legend) => {
      return legend.id === 'legenda-pessoas-cozinha';
    });
    expect(coverageLegend?.position).toBe('bottom-right');

    const fill = spec.layers.find((layer) => {
      return layer.id === 'municipios-br-fill';
    });
    expect(fill?.activeLegendId).toBe('legenda-pessoas-cozinha');
  });

  test('coropletico-ivs feeds IVS scores from the IVS data and positions the IVS legend', () => {
    const spec = buildSpec({
      byCity: BY_CITY,
      mode: 'coropletico-ivs',
      ivsByCity: IVS_BY_CITY,
    });

    // The choropleth reads the separate IVS dataset, not the kitchen rows.
    expect(mapDataById(spec, 'cozinhas-por-municipio')?.data).toEqual([
      { geometryId: '111', value: 0.15 },
      { geometryId: '222', value: 0.55 },
    ]);

    const ivsLegend = spec.legends?.find((legend) => {
      return legend.id === 'legenda-ivs';
    });
    expect(ivsLegend?.position).toBe('bottom-right');
    // A leading floor break keeps the "muito baixa" class (ivs < 0.2) out of
    // geovis' grey base bin; that base bin is the folded "Sem dado" swatch.
    expect(ivsLegend?.colorBy.thresholds?.[0]).toBe(0.001);
    expect(ivsLegend?.colorBy.colors?.length).toBe(6);

    const fill = spec.layers.find((layer) => {
      return layer.id === 'municipios-br-fill';
    });
    expect(fill?.activeLegendId).toBe('legenda-ivs');
  });

  test.each([
    {
      mode: 'coropletico-ivs-infraestrutura' as const,
      legendId: 'legenda-ivs-infraestrutura',
      values: [0.1, 0.6],
    },
    {
      mode: 'coropletico-ivs-capital-humano' as const,
      legendId: 'legenda-ivs-capital-humano',
      values: [0.35, 0.25],
    },
    {
      mode: 'coropletico-ivs-renda-trabalho' as const,
      legendId: 'legenda-ivs-renda-trabalho',
      values: [0.45, 0.7],
    },
  ])(
    '$mode feeds its sub-index column and positions its legend',
    ({ mode, legendId, values }) => {
      const spec = buildSpec({ byCity: BY_CITY, mode, ivsByCity: IVS_BY_CITY });

      expect(mapDataById(spec, 'cozinhas-por-municipio')?.data).toEqual([
        { geometryId: '111', value: values[0] },
        { geometryId: '222', value: values[1] },
      ]);

      const legend = spec.legends?.find((entry) => {
        return entry.id === legendId;
      });
      expect(legend?.position).toBe('bottom-right');
      // All IVS-family scales share the floor-prefixed threshold/color pair.
      expect(legend?.colorBy.thresholds?.[0]).toBe(0.001);
      expect(legend?.colorBy.colors?.length).toBe(6);

      const fill = spec.layers.find((layer) => {
        return layer.id === 'municipios-br-fill';
      });
      expect(fill?.activeLegendId).toBe(legendId);
    }
  );

  test('coropletico-ivs feeds nothing when no IVS data is provided', () => {
    const spec = buildSpec({ byCity: BY_CITY, mode: 'coropletico-ivs' });

    expect(mapDataById(spec, 'cozinhas-por-municipio')?.data).toEqual([]);
  });

  test('pontos configures dotDensity mapType, the points entry leads mapData, and the pontos layer is present', () => {
    const spec = buildSpec({
      byCity: BY_CITY,
      mode: 'pontos',
      cozinhas: COZINHAS,
    });

    expect(spec.mapType).toBe('dotDensity');
    expect(spec.mapData?.[0]?.mapDataId).toBe('cozinhas-pontos');
    expect(layerIds(spec)).toContain('cozinhas-pts');
  });

  test('pontos mapData joins on codigo and carries the kitchen features', () => {
    const spec = buildSpec({
      byCity: BY_CITY,
      mode: 'pontos',
      cozinhas: COZINHAS,
    });

    expect(mapDataById(spec, 'cozinhas-pontos')?.data).toEqual([
      { geometryId: 'CS1', value: null },
      { geometryId: 'CS2', value: null },
    ]);
  });

  test('pontos-status configures dotDensity mapType, joins situacao rows first, positions the status legend', () => {
    const status: CozinhasStatusFeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [-46.6, -23.5] },
          properties: {
            codigo: 'CS1',
            nome: 'Cozinha A',
            situacao: 'Habilitada',
          },
        },
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [-46.7, -23.6] },
          properties: {
            codigo: 'CS2',
            nome: 'Cozinha B',
            situacao: 'Mapeada',
          },
        },
      ],
    };
    const spec = buildSpec({
      byCity: BY_CITY,
      mode: 'pontos-status',
      cozinhasStatus: status,
    });

    expect(spec.mapType).toBe('dotDensity');

    // The status entry leads mapData: geovis' mapType resolvers pick their
    // target source from mapData[0] (see buildMapData).
    expect(spec.mapData?.[0]?.mapDataId).toBe('cozinhas-pontos-status');
    expect(spec.mapData?.[0]?.data).toEqual([
      { geometryId: 'CS1', value: 'Habilitada' },
      { geometryId: 'CS2', value: 'Mapeada' },
    ]);

    const statusLegend = spec.legends?.find((legend) => {
      return legend.id === 'legenda-cozinhas-status';
    });
    expect(statusLegend?.position).toBe('bottom-right');
    expect(statusLegend?.colorBy?.type).toBe('categorical');
  });

  test('circulos renders the proportional-circle overlay', () => {
    const spec = buildSpec({ byCity: BY_CITY, mode: 'circulos' });

    expect(layerIds(spec)).toContain('cozinhas-bolhas-overrides');
    expect(layerIds(spec)).not.toContain('cozinhas-pts');
  });

  test('defaults to coropletico when no mode is given', () => {
    const spec = buildSpec({ byCity: BY_CITY });

    const fill = spec.layers.find((layer) => {
      return layer.id === 'municipios-br-fill';
    });
    expect(fill?.activeLegendId).toBe('legenda-cozinhas');
  });
});
