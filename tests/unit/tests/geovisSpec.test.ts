import {
  buildLegendItems,
  buildSpec,
  colorForQuantidade,
  colorForTaxa,
} from 'src/app/(features)/mapas/geovisSpec';
import type { kitchenRateByCity } from 'src/data-gateway/schema';

const BY_CITY: kitchenRateByCity[] = [
  {
    codigoIbge: '111',
    municipio: 'Alpha',
    quantidade: 5,
    populacao: 100_000,
    porCemMil: 5,
  },
  {
    codigoIbge: '222',
    municipio: 'Beta',
    quantidade: 2,
    populacao: null,
    porCemMil: null,
  },
];

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

describe('buildLegendItems', () => {
  test('leads with the "Sem cozinha" swatch', () => {
    expect(buildLegendItems()[0].label).toBe('Sem cozinha');
  });
});

describe('buildSpec', () => {
  test('coropletico feeds raw counts and positions the count legend', () => {
    const spec = buildSpec(BY_CITY, 'coropletico');

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
    const spec = buildSpec(BY_CITY, 'coropletico-taxa');

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

  test('pontos renders the points overlay and feeds the choropleth nothing', () => {
    const spec = buildSpec(BY_CITY, 'pontos');

    expect(layerIds(spec)).toContain('cozinhas-pts');
    expect(mapDataById(spec, 'cozinhas-por-municipio')?.data).toEqual([]);
  });

  test('circulos renders the proportional-circle overlay', () => {
    const spec = buildSpec(BY_CITY, 'circulos');

    expect(layerIds(spec)).toContain('cozinhas-bolhas');
    expect(layerIds(spec)).not.toContain('cozinhas-pts');
  });

  test('defaults to coropletico when no mode is given', () => {
    const spec = buildSpec(BY_CITY);

    const fill = spec.layers.find((layer) => {
      return layer.id === 'municipios-br-fill';
    });
    expect(fill?.activeLegendId).toBe('legenda-cozinhas');
  });
});
