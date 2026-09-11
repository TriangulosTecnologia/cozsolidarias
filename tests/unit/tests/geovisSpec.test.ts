import {
  assentamentoStatusLabel,
  colorForAssentamentoStatus,
} from 'src/app/(features)/mapas/geovisAssentamentosScales';
import {
  buildLegendItems,
  colorForCadinsan,
  colorForCadUnico,
  colorForCafPercentual,
  colorForPercentual,
  colorForPessoasPorCozinha,
  colorForQuantidade,
  colorForTaxa,
} from 'src/app/(features)/mapas/geovisScales';
import {
  colorForIdhm,
  colorForIvs,
  idhmFaixaLabel,
  ivsFaixaLabel,
} from 'src/app/(features)/mapas/geovisScoreScales';
import {
  type AssentamentoAtributo,
  buildSpec,
} from 'src/app/(features)/mapas/geovisSpec';
import type {
  cadinsanByCity,
  cafByCity,
  CafUfFeatureCollection,
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

const CAF_BY_CITY: cafByCity[] = [
  {
    codigoIbge: '111',
    municipio: 'Alpha',
    quantidade: 14_390,
    percentualDoBrasil: 0.3,
  },
  {
    codigoIbge: '222',
    municipio: 'Beta',
    quantidade: 200,
    percentualDoBrasil: 0.004,
  },
];

const CADINSAN_BY_CITY: cadinsanByCity[] = [
  {
    codigoIbge: '111',
    municipio: 'Alpha',
    uf: 'X',
    regiao: 'R',
    absolutoComPbf: 10,
    absolutoSemPbf: 25,
    cadastrosCadunico: 100,
    proporcaoComPbf: 10,
    proporcaoSemPbf: 25,
  },
  {
    // No CadÚnico denominator → both shares null → dropped from the choropleth.
    codigoIbge: '333',
    municipio: 'Gamma',
    uf: 'Y',
    regiao: 'S',
    absolutoComPbf: 0,
    absolutoSemPbf: 0,
    cadastrosCadunico: 0,
    proporcaoComPbf: null,
    proporcaoSemPbf: null,
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
    idhm: 0.45,
    idhmLongevidade: 0.55,
    idhmEducacao: 0.65,
    idhmRenda: 0.75,
    idhmEducacaoEscolaridade: 0.85,
    idhmEducacaoFrequencia: 0.95,
  },
  {
    codigoIbge: '222',
    municipio: 'Beta',
    ivs: 0.55,
    ivsInfraestruturaUrbana: 0.6,
    ivsCapitalHumano: 0.25,
    ivsRendaETrabalho: 0.7,
    idhm: 0.72,
    idhmLongevidade: 0.68,
    idhmEducacao: 0.58,
    idhmRenda: 0.48,
    idhmEducacaoEscolaridade: 0.38,
    idhmEducacaoFrequencia: 0.28,
  },
];

const ASSENTAMENTOS: AssentamentoAtributo[] = [
  {
    codImovel: 'SP-1-AAA',
    municipio: 'Alpha',
    uf: 'SP',
    areaHa: 100,
    modulosFiscais: 5,
    status: 'AT',
    condicao: 'Aguardando analise',
    dtCriacao: '01/01/2020',
    dtAtualizacao: '02/02/2021',
  },
  {
    codImovel: 'MG-2-BBB',
    municipio: 'Beta',
    uf: 'MG',
    areaHa: 50,
    modulosFiscais: 2,
    status: 'CA',
    condicao: 'Cancelado por decisao administrativa',
    dtCriacao: '03/03/2019',
    dtAtualizacao: '04/04/2022',
  },
  {
    codImovel: 'RJ-3-CCC',
    municipio: 'Gama',
    uf: 'RJ',
    areaHa: 20,
    modulosFiscais: 1,
    status: 'ZZ',
    condicao: 'Desconhecida',
    dtCriacao: '05/05/2018',
    dtAtualizacao: '06/06/2023',
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

describe('colorForCafPercentual', () => {
  test('a município with no CAF (share 0) resolves to the "sem CAF" fill', () => {
    expect(colorForCafPercentual(0)).toBe(colorForQuantidade(0));
  });

  test('a share below the smaller CAF floor stays grey', () => {
    // Below the 0.00001 floor (a fraction of a single CAF) → the grey bin.
    expect(colorForCafPercentual(0.000005)).toBe(colorForQuantidade(0));
  });

  test('tiny real CAF shares — below the cozinha floor — are still painted', () => {
    // The whole reason for a CAF-specific scale: a município at 0.001% (well
    // below the cozinha scale's 0.01 floor) has a real CAF and must be blue.
    expect(colorForCafPercentual(0.001)).not.toBe(colorForCafPercentual(0));
    expect(colorForCafPercentual(0.0084)).not.toBe(colorForCafPercentual(0));
  });

  test('shares above the top threshold share the darkest band', () => {
    expect(colorForCafPercentual(0.5)).toBe(colorForCafPercentual(0.4));
  });

  test('higher shares map to a different (darker) band than lower shares', () => {
    expect(colorForCafPercentual(0.001)).not.toBe(colorForCafPercentual(0.2));
  });
});

describe('colorForCadinsan', () => {
  test('a real 0% is painted (lightest band), not the grey "sem dado"', () => {
    // Unlike the other scales, 0 is a real value here — only null is grey.
    expect(colorForCadinsan(0)).not.toBe(colorForCadinsan(null));
  });

  test('a null share (no CadÚnico denominator) is the grey "sem dado" fill', () => {
    expect(colorForCadinsan(null)).toBe(colorForQuantidade(0));
  });

  test('darkens across the fixed 10-point bands', () => {
    expect(colorForCadinsan(5)).not.toBe(colorForCadinsan(15));
    expect(colorForCadinsan(15)).not.toBe(colorForCadinsan(35));
  });

  test('shares of 40% or more share the darkest band', () => {
    expect(colorForCadinsan(45)).toBe(colorForCadinsan(90));
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

describe('colorForIdhm', () => {
  test('an unknown score resolves to the "sem dado" fill', () => {
    expect(colorForIdhm(null)).toBe(colorForQuantidade(0));
  });

  test('the lowest faixa is a real painted band, distinct from "sem dado"', () => {
    expect(colorForIdhm(0.45)).not.toBe(colorForIdhm(null));
  });

  test('scores at or above the top break share the darkest (muito alto) band', () => {
    expect(colorForIdhm(0.95)).toBe(colorForIdhm(0.8));
  });

  test('higher development maps to a different band than lower', () => {
    expect(colorForIdhm(0.45)).not.toBe(colorForIdhm(0.75));
  });
});

describe('idhmFaixaLabel', () => {
  test('maps each faixa boundary to its official name', () => {
    expect(idhmFaixaLabel(0.45)).toBe('Muito baixo');
    expect(idhmFaixaLabel(0.55)).toBe('Baixo');
    expect(idhmFaixaLabel(0.65)).toBe('Médio');
    expect(idhmFaixaLabel(0.75)).toBe('Alto');
    expect(idhmFaixaLabel(0.85)).toBe('Muito alto');
  });

  test('returns null for an unknown score', () => {
    expect(idhmFaixaLabel(null)).toBeNull();
  });
});

describe('buildLegendItems', () => {
  test('leads with the "Sem cozinha" swatch', () => {
    expect(buildLegendItems()[0].label).toBe('Sem cozinha');
  });
});

describe('assentamentoStatusLabel', () => {
  test('maps each known status code to its human label', () => {
    expect(assentamentoStatusLabel('AT')).toBe('Ativo');
    expect(assentamentoStatusLabel('CA')).toBe('Cancelado');
    expect(assentamentoStatusLabel('PE')).toBe('Pendente');
  });

  test('maps an unknown code to "Outros"', () => {
    expect(assentamentoStatusLabel('ZZ')).toBe('Outros');
  });
});

describe('colorForAssentamentoStatus', () => {
  test('a null label resolves to the masked "sem dado" fill', () => {
    expect(colorForAssentamentoStatus(null)).toBe(colorForQuantidade(0));
  });

  test('an unknown label falls back to the masked fill', () => {
    expect(colorForAssentamentoStatus('Outros')).toBe(
      colorForAssentamentoStatus(null)
    );
  });

  test('each known status gets a distinct painted color', () => {
    const colors = new Set([
      colorForAssentamentoStatus('Ativo'),
      colorForAssentamentoStatus('Cancelado'),
      colorForAssentamentoStatus('Pendente'),
    ]);
    expect(colors.size).toBe(3);
    expect(colors.has(colorForAssentamentoStatus(null))).toBe(false);
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
    // The grey "below first break" swatch is labelled "Sem dado".
    if (rateLegend?.labelFormat?.type === 'labels') {
      expect(rateLegend.labelFormat.labels[0]).toBe('Sem dado');
    }

    const fill = spec.layers.find((layer) => {
      return layer.id === 'municipios-br-fill';
    });
    expect(fill?.activeLegendId).toBe('legenda-taxa');
  });

  test('coropletico-percentual feeds shares and positions the share legend', () => {
    const spec = buildSpec(BY_CITY, 'coropletico-percentual');

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

  test('coropletico-cafs-percentual feeds CAF shares from the CAF data and positions its legend', () => {
    const spec = buildSpec(
      BY_CITY,
      'coropletico-cafs-percentual',
      undefined,
      [],
      {
        cafByCity: CAF_BY_CITY,
      }
    );

    // The choropleth reads the separate CAF dataset, not the kitchen rows; every
    // município is kept (percentualDoBrasil is never null).
    expect(mapDataById(spec, 'cozinhas-por-municipio')?.data).toEqual([
      { geometryId: '111', value: 0.3 },
      { geometryId: '222', value: 0.004 },
    ]);

    const cafLegend = spec.legends?.find((legend) => {
      return legend.id === 'legenda-cafs-percentual';
    });
    expect(cafLegend?.position).toBe('bottom-right');
    // A much smaller floor than the cozinha share scale keeps tiny CAF shares
    // (median ≈ 0.0084%) out of the grey "sem CAF" bin.
    expect(cafLegend?.colorBy.thresholds?.[0]).toBe(0.00001);
    if (cafLegend?.labelFormat?.type === 'labels') {
      expect(cafLegend.labelFormat.labels[0]).toBe('Sem CAF');
    }

    const fill = spec.layers.find((layer) => {
      return layer.id === 'municipios-br-fill';
    });
    expect(fill?.activeLegendId).toBe('legenda-cafs-percentual');
  });

  describe('cafs — the UF → H3 grid → points hierarchy', () => {
    const CAF_UF_POINTS: CafUfFeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [-40.77, -12.34] },
          properties: { nome: 'Bahia', quantidade: 712_480 },
        },
      ],
    };

    const cafUfHoverRender = () => {
      return null;
    };

    const cafsSpec = () => {
      return buildSpec(BY_CITY, 'cafs', undefined, [], {
        cafPontosPorUf: CAF_UF_POINTS,
        cafUfHoverRender,
      });
    };

    const CAF_SOURCE_IDS = [
      'caf-ufs',
      'caf-h3-r3',
      'caf-h3-r4',
      'caf-h3-r5',
      'caf-h3-r6',
      'cafs',
    ];

    const cafLayers = () => {
      return cafsSpec().layers.filter((layer) => {
        return CAF_SOURCE_IDS.includes(layer.sourceId);
      });
    };

    const layerById = (id: string) => {
      return cafLayers().find((layer) => {
        return layer.id === id;
      });
    };

    const sourceById = (id: string) => {
      return cafsSpec().sources.find((source) => {
        return source.id === id;
      });
    };

    /*
     * The whole point of the hierarchy: one representation per zoom band, and
     * the bands must tile the zoom range without a gap (a zoom showing nothing)
     * or an overlap (two aggregations of the same CAFs drawn at once).
     */
    test('partitions the zoom range across the three levels', () => {
      const bands = cafLayers().map((layer) => {
        return [layer.id, layer.minzoom, layer.maxzoom];
      });

      // One band per grid resolution — its lone-CAF dots, its four colour
      // layers and its labels all share it.
      const grid = ([resolution, minzoom, maxzoom]: [
        number,
        number,
        number,
      ]) => {
        return [
          [`cafs-h3-r${resolution}-single`, minzoom, maxzoom],
          ...[0, 1, 2, 3].map((band) => {
            return [`cafs-h3-r${resolution}-b${band}`, minzoom, maxzoom];
          }),
          [`cafs-h3-r${resolution}-labels`, minzoom, maxzoom],
        ];
      };

      expect(bands.slice(0, 24)).toEqual([
        ...grid([3, 5, 7]),
        ...grid([4, 7, 8]),
        ...grid([5, 8, 9]),
        ...grid([6, 9, 10]),
      ]);
      expect(bands.slice(24)).toEqual([
        ['cafs-pts', 10, undefined],
        ['cafs-uf', undefined, 5],
        ['cafs-uf-labels', undefined, 5],
      ]);
    });

    /*
     * A tile source renders nothing below its own `minzoom`, so each window has
     * to start where the generator built it. The point pyramid stops at z11 and
     * is over-zoomed above, which is lossless for points.
     */
    test('declares each tile pyramid over the zooms it was generated for', () => {
      expect(
        ['caf-h3-r3', 'caf-h3-r4', 'caf-h3-r5', 'caf-h3-r6', 'cafs'].map(
          (id) => {
            const source = sourceById(id);
            return [id, source?.minzoom, source?.maxzoom];
          }
        )
      ).toEqual([
        ['caf-h3-r3', 5, 6],
        ['caf-h3-r4', 7, 7],
        ['caf-h3-r5', 8, 8],
        ['caf-h3-r6', 9, 9],
        ['cafs', 10, 11],
      ]);
    });

    /*
     * MapLibre fetches vector tiles from a worker, where a relative URL has no
     * base to resolve against — `new Request('/tiles/…')` throws and the layer
     * stays empty. GeoJSON is fetched on the main thread and gets away with it.
     */
    test('addresses the tiles absolutely and the UF level by path', () => {
      expect(sourceById('caf-h3-r4')).toMatchObject({
        type: 'vector-tiles',
        tiles: [`${window.location.origin}/tiles/caf-h3-r4/{z}/{x}/{y}.pbf`],
      });
      expect(
        buildSpec(BY_CITY, 'cafs').sources.find((source) => {
          return source.id === 'caf-ufs';
        })
      ).toMatchObject({ type: 'geojson', data: '/api/cafs/pontos-por-uf' });
    });

    /*
     * The app already holds the 27 anchors to drive the hover join; handing them
     * to the source too is what stops the map fetching the same 2 KB again.
     */
    test('serves the UF level from memory once the app has the anchors', () => {
      expect(sourceById('caf-ufs')).toMatchObject({ data: CAF_UF_POINTS });
    });

    /*
     * The join does double duty: it promotes `nome` to the MapLibre feature id
     * (without it the hover reports `0`) and carries the total the hover card
     * and the circle radius both read. Rows come off the FeatureCollection, so
     * the card can never disagree with the label.
     */
    test('joins the UF level on the name it labels itself with', () => {
      expect(mapDataById(cafsSpec(), 'caf-ufs-data')).toMatchObject({
        mapId: 'caf-ufs',
        joinKey: 'nome',
        data: [{ geometryId: 'Bahia', value: 712_480 }],
      });
      expect(layerById('cafs-uf')?.mapDataId).toBe('caf-ufs-data');
    });

    /*
     * The mode's only hover card: the tiled levels below cannot have one, since
     * geovis exposes no feature properties for them.
     */
    test('attaches the hover card to the UF circles, and only there', () => {
      expect(layerById('cafs-uf')?.hoverTooltip?.render).toBe(cafUfHoverRender);
      expect(
        cafLayers().filter((layer) => {
          return layer.hoverTooltip !== undefined;
        })
      ).toHaveLength(1);
      expect(
        buildSpec(BY_CITY, 'cafs').layers.find((layer) => {
          return layer.id === 'cafs-uf';
        })?.hoverTooltip
      ).toBeUndefined();
    });

    /*
     * Circles, never hexagons — and `propertyName` WITHOUT `mapDataId` is what
     * compiles the radius to `['get', 'count']` instead of the feature-state
     * path a tiled source has no way to fill. Every band of a resolution shares
     * the ladder, so a circle keeps its size whichever band draws it.
     */
    test('draws every grid level as circles sized by the cell count', () => {
      const grid = cafLayers().filter((layer) => {
        return layer.sourceId.startsWith('caf-h3-');
      });

      for (const layer of grid) {
        expect(layer.sourceLayer).toBe('caf-h3');
        expect(layer.mapDataId).toBeUndefined();
      }
      for (const band of [0, 1, 2, 3]) {
        expect(layerById(`cafs-h3-r5-b${band}`)?.propertyName).toBe('count');
      }

      // One ladder on the absolute count, shared by every level including the
      // UF circles: a cell's children sum to it, so a step function on the
      // count can never grow on the way down.
      const ladder = {
        mode: 'stepped',
        range: [7, 34],
        thresholds: [
          3, 10, 30, 100, 300, 1_000, 3_000, 10_000, 30_000, 100_000, 300_000,
        ],
      };
      expect(layerById('cafs-h3-r6-b0')?.sizeBy).toEqual(ladder);
      expect(layerById('cafs-h3-r3-b3')?.sizeBy).toEqual(ladder);
      expect(layerById('cafs-uf')?.sizeBy).toEqual(ladder);
    });

    /*
     * One-sided `gte` filters in ascending order, so the topmost match wins: a
     * `LayerFilter` holds a single predicate, so a closed range is not
     * expressible, and a tiled source cannot drive colour from `mapData` at all.
     * The breaks are each grid's own p75/p90/p98, measured over the full
     * snapshot, so three quarters of the cells read as the pale background dot
     * at every zoom.
     */
    test('bands each grid by ascending count, topmost match winning', () => {
      const breaks = (resolution: number) => {
        return cafLayers()
          .filter((layer) => {
            return layer.id.startsWith(`cafs-h3-r${resolution}-b`);
          })
          .map((layer) => {
            return layer.filter?.value;
          });
      };

      expect(breaks(3)).toEqual([2, 1_800, 8_500, 28_000]);
      expect(breaks(4)).toEqual([2, 400, 1_750, 5_000]);
      expect(breaks(5)).toEqual([2, 100, 350, 1_000]);
      expect(breaks(6)).toEqual([2, 30, 75, 200]);

      for (const layer of cafLayers()) {
        if (layer.id.includes('-b') && layer.filter) {
          expect(layer.filter.operator).toBe('gte');
          expect(layer.filter.property).toBe('count');
        }
      }
    });

    /*
     * The legend is explanatory, not data-driven: the four bands are painted
     * by four static-coloured layers, so no layer carries the legend as its
     * `activeLegendId` and only its `position` puts it on screen.
     */
    test('positions the density legend for this mode and no other', () => {
      const legendOf = (spec: ReturnType<typeof cafsSpec>) => {
        return spec.legends?.find((entry) => {
          return entry.id === 'legenda-cafs';
        });
      };

      const legend = legendOf(cafsSpec());
      expect(legend?.position).toBe('bottom-right');
      expect(legend?.colorBy?.type).toBe('categorical');
      // Light to dark, the same four the grid circles step through.
      expect(
        legend?.colorBy?.type === 'categorical'
          ? Object.values(legend.colorBy.mapping)
          : []
      ).toEqual(['#9CC7B0', '#5FA37F', '#2F6F4E', '#1B4632']);

      expect(
        legendOf(buildSpec(BY_CITY, 'coropletico'))?.position
      ).toBeUndefined();
    });

    /*
     * No click in this mode opens anything. A CAF point stands for one
     * registration and the app publishes no per-registration detail, so a click
     * that opened an empty panel — or a pin marking a point that leads nowhere —
     * would promise something that does not exist.
     *
     * The aggregates do answer to a click, but only by moving the camera (the
     * drill-down in `useCafDrilldown`). They say so with a bare `click: {}`,
     * which is what geovis reads to draw a pointer cursor; an `onSelect` inside
     * it would register geovis's own selection path, and a `clickAnchor` would
     * drop a pin. Neither appears anywhere here, which is the invariant above
     * stated as what it always meant.
     */
    test('opens nothing on click — no selection panel, no pin', () => {
      expect(
        cafLayers().filter((layer) => {
          return (
            layer.click?.onSelect !== undefined ||
            layer.clickAnchor !== undefined
          );
        })
      ).toHaveLength(0);
    });

    /*
     * Only the aggregates drill. An individual CAF is the end of the hierarchy,
     * a cell of one is not an aggregate of anything, and the labels sit above
     * the circles — a pointer over any of the three would advertise a move that
     * does not happen.
     */
    test('advertises the drill-down on the aggregates alone', () => {
      expect(layerById('cafs-uf')?.click).toEqual({});
      expect(layerById('cafs-h3-r3-b0')?.click).toEqual({});
      expect(layerById('cafs-h3-r6-b3')?.click).toEqual({});

      expect(layerById('cafs-pts')?.click).toBeUndefined();
      expect(layerById('cafs-pts')?.mapDataId).toBeUndefined();
      expect(layerById('cafs-h3-r5-single')?.click).toBeUndefined();
      expect(layerById('cafs-h3-r5-labels')?.click).toBeUndefined();
      expect(layerById('cafs-uf-labels')?.click).toBeUndefined();
    });

    /*
     * A cell holding one CAF is not an aggregate: its weighted centroid IS that
     * CAF's coordinate, so it is drawn as the individual dot it is — same paint
     * as the point tiles use below z10 — and the labels skip it. A circle
     * reading `1` claims to summarise something that is not there.
     */
    test('draws a cell of one CAF as that CAF, unlabelled', () => {
      const single = layerById('cafs-h3-r5-single');

      expect(single?.geometry).toBe('point');
      expect(single?.filter).toEqual({
        property: 'count',
        operator: 'lt',
        value: 2,
      });
      // The exact complement of the first band, so no count falls through both
      // or matches neither.
      expect(layerById('cafs-h3-r5-b0')?.filter?.value).toBe(2);
      // Same shape and colour as the individual points at the deep end.
      expect(single?.paint).toEqual({
        circleColor: '#2F6F4E',
        circleRadius: 4,
        circleStrokeWidth: 0,
      });
      // The tiled points differ in one thing only: they overlap by the million,
      // and letting them accumulate is what darkens a crowded município.
      expect(layerById('cafs-pts')?.paint).toEqual({
        ...single?.paint,
        circleOpacity: 0.9,
      });

      expect(layerById('cafs-h3-r5-labels')?.filter).toEqual({
        property: 'count',
        operator: 'gte',
        value: 2,
      });
    });

    /*
     * Every aggregate circle states its count — the grid's as much as the UFs'.
     * The individual CAFs are the exception: each stands for exactly one
     * property, and a map of dots all labelled `1` says nothing.
     */
    test('labels every aggregate level, and only those', () => {
      expect(
        cafLayers()
          .filter((layer) => {
            return layer.geometry === 'symbol';
          })
          .map((layer) => {
            return layer.id;
          })
      ).toEqual([
        'cafs-h3-r3-labels',
        'cafs-h3-r4-labels',
        'cafs-h3-r5-labels',
        'cafs-h3-r6-labels',
        'cafs-uf-labels',
      ]);
    });

    /*
     * The grid labels read the tiles' own `count`, and step on the same
     * percentile breaks the radius does, so the number grows with its circle.
     */
    test('labels the grid from the count the tiles carry', () => {
      expect(layerById('cafs-h3-r6-labels')?.paint).toMatchObject({
        textField: expect.arrayContaining([
          ['>=', ['get', 'count'], 999500],
        ]) as unknown,
        textSize: [
          'step',
          ['get', 'count'],
          11,
          3,
          11.6,
          10,
          12.3,
          30,
          12.9,
          100,
          13.5,
          300,
          14.2,
          1000,
          14.8,
          3000,
          15.5,
          10000,
          16.1,
          30000,
          16.7,
          100000,
          17.4,
          300000,
          18,
        ],
      });
    });

    /*
     * The compact pt-BR formatting is what lets the UF circles be labelled at
     * all: a UF reads 712.480, and seven digits fit in no circle this map draws.
     * Pinned in full because the expression IS the contract — geovis passes
     * `paint.textField` to `text-field` verbatim, so a malformed one fails
     * inside MapLibre, where no test can see it.
     */
    test('labels the UF circles with the count, compacted', () => {
      expect(layerById('cafs-uf-labels')?.paint).toMatchObject({
        textField: [
          'case',
          // Not a round million: that is where the branch below would round to
          // `1.000 mil`.
          ['>=', ['get', 'quantidade'], 999500],
          [
            'concat',
            [
              'number-format',
              ['/', ['get', 'quantidade'], 1000000],
              { locale: 'pt-BR', 'max-fraction-digits': 1 },
            ],
            ' mi',
          ],
          ['>=', ['get', 'quantidade'], 10000],
          [
            'concat',
            // Rounded here, not by the formatter: MapLibre reads
            // `max-fraction-digits` under a truthiness check, so a `0` is
            // dropped and `Intl`'s three decimals print `33,675 mil`.
            [
              'number-format',
              ['round', ['/', ['get', 'quantidade'], 1000]],
              { locale: 'pt-BR' },
            ],
            ' mil',
          ],
          ['number-format', ['get', 'quantidade'], { locale: 'pt-BR' }],
        ],
        // Stepped on the same ladder the radius uses, so the label grows with
        // its circle and never outgrows it.
        textSize: [
          'step',
          ['get', 'quantidade'],
          11,
          3,
          11.6,
          10,
          12.3,
          30,
          12.9,
          100,
          13.5,
          300,
          14.2,
          1000,
          14.8,
          3000,
          15.5,
          10000,
          16.1,
          30000,
          16.7,
          100000,
          17.4,
          300000,
          18,
        ],
      });
    });

    test('keeps the CAF layers out of every other mode', () => {
      expect(
        buildSpec(BY_CITY, 'coropletico').layers.filter((layer) => {
          return CAF_SOURCE_IDS.includes(layer.sourceId);
        })
      ).toEqual([]);
      expect(
        mapDataById(buildSpec(BY_CITY, 'coropletico'), 'caf-ufs-data')
      ).toBeUndefined();
    });
  });

  test('coropletico-cafs-percentual feeds nothing when no CAF data is provided', () => {
    const spec = buildSpec(BY_CITY, 'coropletico-cafs-percentual');

    expect(mapDataById(spec, 'cozinhas-por-municipio')?.data).toEqual([]);
  });

  test('coropletico-cadinsan-sem-pbf feeds the sem-PBF shares, drops null denominators, positions its legend', () => {
    const spec = buildSpec(
      BY_CITY,
      'coropletico-cadinsan-sem-pbf',
      undefined,
      [],
      { cadinsanByCity: CADINSAN_BY_CITY }
    );

    // Reads the CADINSAN dataset; Gamma (null share) is dropped, Alpha kept.
    expect(mapDataById(spec, 'cozinhas-por-municipio')?.data).toEqual([
      { geometryId: '111', value: 25 },
    ]);

    const legend = spec.legends?.find((entry) => {
      return entry.id === 'legenda-cadinsan-sem-pbf';
    });
    expect(legend?.position).toBe('bottom-right');
    // 0 is a real cutpoint (not a positive floor), so 0% paints a band.
    expect(legend?.colorBy.thresholds?.[0]).toBe(0);

    const fill = spec.layers.find((layer) => {
      return layer.id === 'municipios-br-fill';
    });
    expect(fill?.activeLegendId).toBe('legenda-cadinsan-sem-pbf');
  });

  test('coropletico-cadinsan-com-pbf feeds the com-PBF shares and positions its legend', () => {
    const spec = buildSpec(
      BY_CITY,
      'coropletico-cadinsan-com-pbf',
      undefined,
      [],
      { cadinsanByCity: CADINSAN_BY_CITY }
    );

    expect(mapDataById(spec, 'cozinhas-por-municipio')?.data).toEqual([
      { geometryId: '111', value: 10 },
    ]);

    const legend = spec.legends?.find((entry) => {
      return entry.id === 'legenda-cadinsan-com-pbf';
    });
    expect(legend?.position).toBe('bottom-right');
  });

  test('coropletico-cadinsan-* feeds nothing when no CADINSAN data is provided', () => {
    const spec = buildSpec(BY_CITY, 'coropletico-cadinsan-sem-pbf');

    expect(mapDataById(spec, 'cozinhas-por-municipio')?.data).toEqual([]);
  });

  test('coropletico-cadunico feeds CadÚnico rates, drops unknown rates, positions its legend', () => {
    const spec = buildSpec(BY_CITY, 'coropletico-cadunico');

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
    const spec = buildSpec(BY_CITY, 'coropletico-pessoas-cozinha');

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
    const spec = buildSpec(BY_CITY, 'coropletico-ivs', undefined, IVS_BY_CITY);

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
      const spec = buildSpec(BY_CITY, mode, undefined, IVS_BY_CITY);

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

  test.each([
    {
      mode: 'coropletico-idhm' as const,
      legendId: 'legenda-idhm',
      values: [0.45, 0.72],
    },
    {
      mode: 'coropletico-idhm-longevidade' as const,
      legendId: 'legenda-idhm-longevidade',
      values: [0.55, 0.68],
    },
    {
      mode: 'coropletico-idhm-educacao' as const,
      legendId: 'legenda-idhm-educacao',
      values: [0.65, 0.58],
    },
    {
      mode: 'coropletico-idhm-renda' as const,
      legendId: 'legenda-idhm-renda',
      values: [0.75, 0.48],
    },
    {
      mode: 'coropletico-idhm-educacao-escolaridade' as const,
      legendId: 'legenda-idhm-educacao-escolaridade',
      values: [0.85, 0.38],
    },
    {
      mode: 'coropletico-idhm-educacao-frequencia' as const,
      legendId: 'legenda-idhm-educacao-frequencia',
      values: [0.95, 0.28],
    },
  ])(
    '$mode feeds its IDHM column and positions its legend',
    ({ mode, legendId, values }) => {
      const spec = buildSpec(BY_CITY, mode, undefined, IVS_BY_CITY);

      expect(mapDataById(spec, 'cozinhas-por-municipio')?.data).toEqual([
        { geometryId: '111', value: values[0] },
        { geometryId: '222', value: values[1] },
      ]);

      const legend = spec.legends?.find((entry) => {
        return entry.id === legendId;
      });
      expect(legend?.position).toBe('bottom-right');
      // All IDHM-family scales share the floor-prefixed threshold/color pair.
      expect(legend?.colorBy.thresholds?.[0]).toBe(0.001);
      expect(legend?.colorBy.colors?.length).toBe(6);

      const fill = spec.layers.find((layer) => {
        return layer.id === 'municipios-br-fill';
      });
      expect(fill?.activeLegendId).toBe(legendId);
    }
  );

  test('hides basemap labels and floors the zoom-out at the Brazil-wide level', () => {
    const spec = buildSpec(BY_CITY, 'coropletico');
    expect(spec.basemap?.labels).toBe(false);
    expect(spec.view?.maxZoomOut).toBe(4);

    // The assentamentos camera shares the same zoom-out floor.
    const assentamentos = buildSpec(BY_CITY, 'assentamentos');
    expect(assentamentos.view?.maxZoomOut).toBe(4);
  });

  test('coropletico-ivs feeds nothing when no IVS data is provided', () => {
    const spec = buildSpec(BY_CITY, 'coropletico-ivs');

    expect(mapDataById(spec, 'cozinhas-por-municipio')?.data).toEqual([]);
  });

  test('pontos renders the points overlay and feeds the choropleth nothing', () => {
    const spec = buildSpec(BY_CITY, 'pontos');

    expect(layerIds(spec)).toContain('cozinhas-pts');
    expect(mapDataById(spec, 'cozinhas-por-municipio')?.data).toEqual([]);
  });

  test('pontos colors the kitchen points by status and positions the status legend', () => {
    const spec = buildSpec(BY_CITY, 'pontos', undefined, [], {
      cozinhaStatus: {
        CS1: 'Sim, está funcionando normalmente',
        CS2: '',
      },
    });

    // The points layer paints from the categorical status legend.
    const points = spec.layers.find((layer) => {
      return layer.id === 'cozinhas-pts';
    });
    expect(points?.activeLegendId).toBe('legenda-cozinhas-status');

    // The status join carries one row per point: codigo → descriptive label,
    // with unknown/blank status folding to "Não informado" (the grey swatch).
    expect(mapDataById(spec, 'cozinhas-pts-promote')?.data).toEqual([
      { geometryId: 'CS1', value: 'Em funcionamento' },
      { geometryId: 'CS2', value: 'Não informado' },
    ]);

    // The status legend is the positioned (visible) one in pontos mode.
    const legend = spec.legends?.find((entry) => {
      return entry.id === 'legenda-cozinhas-status';
    });
    expect(legend?.position).toBe('bottom-right');
  });

  test('the status legend is present but not positioned outside pontos mode', () => {
    const legend = buildSpec(BY_CITY, 'coropletico').legends?.find((entry) => {
      return entry.id === 'legenda-cozinhas-status';
    });
    expect(legend).toBeDefined();
    expect(legend?.position).toBeUndefined();
  });

  test('circulos renders the proportional-circle overlay plus a hidden kitchen overlay', () => {
    const spec = buildSpec(BY_CITY, 'circulos');

    // Bubbles are the always-on primary layer here.
    expect(layerIds(spec)).toContain('cozinhas-bolhas');
    const bubbles = spec.layers.find((layer) => {
      return layer.id === 'cozinhas-bolhas';
    });
    expect(bubbles?.visible).not.toBe(false);

    // Kitchen points are an opt-in overlay here: present but hidden until toggled.
    expect(layerIds(spec)).toContain('cozinhas-pts');
    const points = spec.layers.find((layer) => {
      return layer.id === 'cozinhas-pts';
    });
    expect(points?.visible).toBe(false);

    // Points sit on top of the bubbles, so revealing them draws each kitchen
    // over its proportional circle.
    const ids = layerIds(spec);
    expect(ids.indexOf('cozinhas-bolhas')).toBeLessThan(
      ids.indexOf('cozinhas-pts')
    );
  });

  test('choropleths render the kitchen points as a hidden opt-in overlay', () => {
    const modes = [
      'coropletico',
      'coropletico-taxa',
      'coropletico-ivs',
      'coropletico-idhm',
    ] as const;

    for (const mode of modes) {
      const spec = buildSpec(BY_CITY, mode, undefined, IVS_BY_CITY);
      const points = spec.layers.find((layer) => {
        return layer.id === 'cozinhas-pts';
      });
      expect(points).toBeDefined();
      expect(points?.visible).toBe(false);
    }
  });

  test('primary modes render the kitchen points visible (not hidden)', () => {
    for (const mode of ['pontos', 'assentamentos'] as const) {
      const spec = buildSpec(BY_CITY, mode);
      const points = spec.layers.find((layer) => {
        return layer.id === 'cozinhas-pts';
      });
      expect(points?.visible).not.toBe(false);
    }
  });

  test('the "Camadas" kitchens toggle defaults on only where kitchens are the primary layer', () => {
    const cozinhasItem = (mode: Parameters<typeof buildSpec>[1]) => {
      return buildSpec(
        BY_CITY,
        mode,
        undefined,
        IVS_BY_CITY
      ).control?.items.find((item) => {
        return item.id === 'cozinhas';
      });
    };

    // Kitchen points are the primary visualization: toggle starts on.
    for (const mode of ['pontos', 'assentamentos'] as const) {
      expect(cozinhasItem(mode)?.defaultActive).toBe(true);
    }

    // Opt-in overlay: toggle starts off (layer present but hidden). In
    // `circulos` the proportional circles are the always-on primary layer, so
    // the points start hidden there too.
    for (const mode of [
      'circulos',
      'coropletico',
      'coropletico-ivs',
    ] as const) {
      expect(cozinhasItem(mode)?.defaultActive).toBe(false);
    }
  });

  test('the "Camadas" kitchens toggle controls only the points layer, never the bubbles', () => {
    for (const mode of ['pontos', 'circulos', 'coropletico'] as const) {
      const item = buildSpec(BY_CITY, mode).control?.items.find((entry) => {
        return entry.id === 'cozinhas';
      });
      expect(item?.layers).toEqual(['cozinhas-pts']);
    }
  });

  test('assentamentos overlays the settlement polygons and points, and hides municípios', () => {
    const spec = buildSpec(BY_CITY, 'assentamentos', undefined, [], {
      assentamentos: { atributos: ASSENTAMENTOS },
    });

    // Filled polygons + visible points on top.
    expect(layerIds(spec)).toContain('assentamentos-poly');
    expect(layerIds(spec)).toContain('cozinhas-pts');
    const points = spec.layers.find((layer) => {
      return layer.id === 'cozinhas-pts';
    });
    expect(points?.visible).not.toBe(false);

    // The bubble layer is always present (to keep its stacking order fixed) but
    // hidden here — there is no proportional-circle overlay in this mode.
    const bubbles = spec.layers.find((layer) => {
      return layer.id === 'cozinhas-bolhas';
    });
    expect(bubbles?.visible).toBe(false);

    // Municípios are hidden entirely: no fill layer, no choropleth join.
    expect(layerIds(spec)).not.toContain('municipios-br-fill');
    expect(
      spec.mapData?.some((entry) => {
        return entry.mapDataId === 'cozinhas-por-municipio';
      })
    ).toBe(false);

    // Near-white state backdrop under the polygons + a crisp dedicated outline.
    expect(layerIds(spec)).toContain('estados-fill');
    expect(layerIds(spec)).toContain('assentamentos-outline');

    // Layer order (bottom → top): backdrop, fill, outline, points.
    const ids = layerIds(spec);
    expect(ids.indexOf('estados-fill')).toBeLessThan(
      ids.indexOf('assentamentos-poly')
    );
    expect(ids.indexOf('assentamentos-poly')).toBeLessThan(
      ids.indexOf('assentamentos-outline')
    );
    expect(ids.indexOf('assentamentos-outline')).toBeLessThan(
      ids.indexOf('cozinhas-pts')
    );

    // Both mode-gated sources (geometry + backdrop) are added only in this mode.
    expect(
      spec.sources.some((source) => {
        return source.id === 'assentamentos';
      })
    ).toBe(true);
    expect(
      spec.sources.some((source) => {
        return source.id === 'estados-fill';
      })
    ).toBe(true);

    // Status join: value is the human label, unknown codes fold to "Outros".
    const statusData = spec.mapData?.find((entry) => {
      return entry.mapDataId === 'assentamentos-status';
    })?.data;
    expect(statusData).toEqual([
      { geometryId: 'SP-1-AAA', value: 'Ativo' },
      { geometryId: 'MG-2-BBB', value: 'Cancelado' },
      { geometryId: 'RJ-3-CCC', value: 'Outros' },
    ]);

    // The categorical settlement legend is the positioned one.
    const legend = spec.legends?.find((entry) => {
      return entry.id === 'legenda-assentamentos';
    });
    expect(legend?.position).toBe('bottom-right');
    expect(legend?.colorBy?.type).toBe('categorical');
  });

  test('assentamentos mode with no attributes feeds an empty status join', () => {
    const spec = buildSpec(BY_CITY, 'assentamentos');

    expect(layerIds(spec)).toContain('assentamentos-poly');
    expect(
      spec.mapData?.find((entry) => {
        return entry.mapDataId === 'assentamentos-status';
      })?.data
    ).toEqual([]);
  });

  test('non-assentamentos modes add no settlement source, join or layer', () => {
    const spec = buildSpec(BY_CITY, 'coropletico', undefined, [], {
      assentamentos: { atributos: ASSENTAMENTOS },
    });

    expect(layerIds(spec)).not.toContain('assentamentos-poly');
    expect(layerIds(spec)).not.toContain('estados-fill');
    expect(
      spec.sources.some((source) => {
        return source.id === 'assentamentos' || source.id === 'estados-fill';
      })
    ).toBe(false);
    expect(
      spec.mapData?.some((entry) => {
        return entry.mapDataId === 'assentamentos-status';
      })
    ).toBe(false);
  });

  test('defaults to coropletico when no mode is given', () => {
    const spec = buildSpec(BY_CITY);

    const fill = spec.layers.find((layer) => {
      return layer.id === 'municipios-br-fill';
    });
    expect(fill?.activeLegendId).toBe('legenda-cozinhas');
  });
});
