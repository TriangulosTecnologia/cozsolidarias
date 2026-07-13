import {
  buildLegendItems,
  buildSpec,
  colorForPercentual,
  colorForQuantidade,
  colorForSituacao,
  colorForTaxa,
} from 'src/app/(features)/mapas/geovisSpec';
import type {
  CozinhasFeatureCollection,
  CozinhasStatusFeatureCollection,
  kitchenRateByCity,
} from 'src/data-gateway/schema';

const BY_CITY: kitchenRateByCity[] = [
  {
    codigoIbge: '111',
    municipio: 'Alpha',
    quantidade: 5,
    populacao: 100_000,
    porCemMil: 5,
    percentualDoBrasil: 71.43,
  },
  {
    codigoIbge: '222',
    municipio: 'Beta',
    quantidade: 2,
    populacao: null,
    porCemMil: null,
    percentualDoBrasil: 28.57,
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
    expect(colorForSituacao('Mapeada')).not.toBe(colorForSituacao(null));
    expect(colorForSituacao('Retirada')).not.toBe(colorForSituacao(null));
    expect(colorForSituacao('Em análise')).not.toBe(colorForSituacao(null));
    expect(colorForSituacao('Homologada para Habilitação')).not.toBe(
      colorForSituacao(null)
    );
    expect(
      colorForSituacao(
        'Pendência emitida pelo MDS (Prazo para adequações 15 dias)'
      )
    ).not.toBe(colorForSituacao(null));
    expect(colorForSituacao('Enviada para análise')).not.toBe(
      colorForSituacao(null)
    );
    expect(colorForSituacao('Homologada para Retirada')).not.toBe(
      colorForSituacao(null)
    );
  });

  test('distinct statuses get distinct colors', () => {
    expect(colorForSituacao('Habilitada')).not.toBe(
      colorForSituacao('Não Habilitada')
    );
    expect(colorForSituacao('Mapeada')).not.toBe(colorForSituacao('Retirada'));
    expect(colorForSituacao('Em análise')).not.toBe(
      colorForSituacao('Homologada para Habilitação')
    );
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
