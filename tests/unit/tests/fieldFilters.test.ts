import {
  type FilterDomain,
  filteredMapDataId,
  filteredMapDataRows,
  matchFilterValues,
  namesFilterableFamily,
  parseFilteredMapDataId,
  readFilterDomains,
  readFilterDomainsFor,
} from 'src/app/api/ai/spec/fieldFilters';
import {
  buildCatalogueContext,
  fetchRenderableData,
  isRenderableDatasetId,
  type RenderableDatasetId,
} from 'src/app/api/ai/spec/mapDataCatalogue';
import { preflightPrompt } from 'src/app/api/ai/spec/preflight';
import { appendRealMapData } from 'src/app/api/ai/spec/specValidation';
import { validateDatasetId } from 'src/app/api/ai/spec/validateDatasetId';
import type { CozinhasSituacaoPorMunicipio } from 'src/data-gateway/schema';

import { gateway } from '@/gateway';

const FULL_2025: CozinhasSituacaoPorMunicipio = {
  situacoesCobertas: null,
  semLocalizacao: 1,
  porMunicipio: [
    {
      codigoIbge: '111',
      municipio: 'Alpha',
      quantidadePorSituacao: { Habilitada: 3, Mapeada: 4, Retirada: 1 },
    },
    {
      codigoIbge: '222',
      municipio: 'Beta',
      quantidadePorSituacao: {
        'Homologada para Habilitação': 2,
        'Homologada para Retirada': 1,
        Habilitada: 1,
      },
    },
  ],
};

const HABILITADA_2026: CozinhasSituacaoPorMunicipio = {
  situacoesCobertas: ['Habilitada'],
  semLocalizacao: 0,
  porMunicipio: [
    {
      codigoIbge: '111',
      municipio: 'Alpha',
      quantidadePorSituacao: { Habilitada: 5, Mapeada: 9 },
    },
  ],
};

const DOMAINS: FilterDomain[] = [
  {
    baseId: 'cozinhas_geolocalizadas',
    ano: 2026,
    field: 'situacao',
    values: ['Habilitada'],
  },
  {
    baseId: 'cozinhas_geolocalizadas_2025',
    ano: 2025,
    field: 'situacao',
    values: [
      'Em análise',
      'Habilitada',
      'Homologada para Habilitação',
      'Homologada para Retirada',
      'Mapeada',
      'Não Habilitada',
      'Pendência emitida pelo MDS (Prazo para adequações 15 dias)',
      'Retirada',
    ],
  },
];

const mockSnapshots = (): jest.SpyInstance => {
  return jest
    .spyOn(gateway, 'getCozinhasSituacaoPorMunicipio')
    .mockImplementation((year) => {
      return Promise.resolve(year === 2025 ? FULL_2025 : HABILITADA_2026);
    });
};

afterEach(() => {
  jest.restoreAllMocks();
});

describe('parseFilteredMapDataId', () => {
  test('reads the base, its snapshot year, the field and the raw value', () => {
    expect(
      parseFilteredMapDataId(
        'cozinhas_geolocalizadas_2025?situacao=Não Habilitada'
      )
    ).toEqual({
      baseId: 'cozinhas_geolocalizadas_2025',
      ano: 2025,
      field: 'situacao',
      value: 'Não Habilitada',
    });
  });

  test.each([
    'cozinhas_geolocalizadas',
    'municipios_ivs?situacao=Habilitada',
    'cozinhas_geolocalizadas?cnpj=123',
    'cozinhas_geolocalizadas?situacao=',
    'cozinhas_geolocalizadas?situacao',
    'cozinhas_geolocalizadas?situacao=Habilitada&situacao=Mapeada',
    'cozinhas_geolocalizadas?situacao=  ',
  ])('refuses "%s"', (id) => {
    expect(parseFilteredMapDataId(id)).toBeNull();
  });

  test('round-trips through filteredMapDataId', () => {
    const id = filteredMapDataId({
      baseId: 'cozinhas_geolocalizadas',
      field: 'situacao',
      value: 'Mapeada',
    });
    expect(id).toBe('cozinhas_geolocalizadas?situacao=Mapeada');
    expect(parseFilteredMapDataId(id)?.value).toBe('Mapeada');
  });
});

describe('filteredMapDataRows', () => {
  test('counts the value per município, zero where a município has none', async () => {
    mockSnapshots();

    expect(
      await filteredMapDataRows({
        baseId: 'cozinhas_geolocalizadas_2025',
        ano: 2025,
        field: 'situacao',
        value: 'Mapeada',
      })
    ).toEqual([
      { geometryId: '111', value: 4 },
      { geometryId: '222', value: 0 },
    ]);
  });

  test('refuses a value outside the snapshot coverage, never zero', async () => {
    mockSnapshots();

    expect(
      await filteredMapDataRows({
        baseId: 'cozinhas_geolocalizadas',
        ano: 2026,
        field: 'situacao',
        value: 'Mapeada',
      })
    ).toBeNull();
  });

  test('refuses a value the snapshot never holds', async () => {
    mockSnapshots();

    expect(
      await filteredMapDataRows({
        baseId: 'cozinhas_geolocalizadas_2025',
        ano: 2025,
        field: 'situacao',
        value: 'Inventada',
      })
    ).toBeNull();
  });
});

describe('readFilterDomains', () => {
  test('lists the covered values each filterable base holds, sorted', async () => {
    mockSnapshots();

    expect(await readFilterDomains()).toEqual([
      {
        baseId: 'cozinhas_geolocalizadas',
        ano: 2026,
        field: 'situacao',
        values: ['Habilitada'],
      },
      {
        baseId: 'cozinhas_geolocalizadas_2025',
        ano: 2025,
        field: 'situacao',
        values: [
          'Habilitada',
          'Homologada para Habilitação',
          'Homologada para Retirada',
          'Mapeada',
          'Retirada',
        ],
      },
    ]);
  });

  test('a value new in the source joins the domain without code changes', async () => {
    jest.spyOn(gateway, 'getCozinhasSituacaoPorMunicipio').mockResolvedValue({
      ...FULL_2025,
      porMunicipio: [
        {
          codigoIbge: '111',
          municipio: 'Alpha',
          quantidadePorSituacao: { Suspensa: 2 },
        },
      ],
    });

    const [domain] = await readFilterDomains();
    expect(domain.values).toEqual(['Suspensa']);
    expect(
      preflightPrompt({
        prompt: 'cozinhas suspensas',
        filterDomains: [domain],
      })
    ).toEqual({
      status: 'resolved',
      datasetId: 'cozinhas_geolocalizadas?situacao=Suspensa',
    });
  });

  test('reads nothing for a prompt that names no filterable family', async () => {
    const spy = mockSnapshots();

    expect(await readFilterDomainsFor('ivs de infraestrutura')).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
    expect(await readFilterDomainsFor('cozinhas mapeadas')).toHaveLength(2);
  });

  test('namesFilterableFamily runs over the raw prompt', () => {
    expect(namesFilterableFamily('Cozinhas MAPEADAS')).toBe(true);
    expect(namesFilterableFamily('IDHM')).toBe(false);
  });
});

describe('matchFilterValues', () => {
  test('the longest value wins over one it contains', () => {
    expect(
      matchFilterValues({
        text: 'cozinhas homologadas para retirada',
        values: DOMAINS[1].values,
      })
    ).toEqual({ exact: true, values: ['Homologada para Retirada'] });
  });

  test('a plural matches its value', () => {
    expect(
      matchFilterValues({ text: 'cozinhas mapeadas', values: ['Mapeada'] })
    ).toEqual({ exact: true, values: ['Mapeada'] });
  });

  test('a lone head word matches every value it starts', () => {
    expect(
      matchFilterValues({
        text: 'cozinhas homologadas',
        values: DOMAINS[1].values,
      })
    ).toEqual({
      exact: false,
      values: ['Homologada para Habilitação', 'Homologada para Retirada'],
    });
  });

  test('a short head word never matches alone', () => {
    expect(
      matchFilterValues({ text: 'cozinhas em 2025', values: ['Em análise'] })
    ).toEqual({ exact: false, values: [] });
  });
});

describe('preflightPrompt with filter domains', () => {
  test('answers "cozinhas mapeadas 2025" with the filtered 2025 id', () => {
    expect(
      preflightPrompt({
        prompt: 'cozinhas mapeadas 2025',
        filterDomains: DOMAINS,
      })
    ).toEqual({
      status: 'resolved',
      datasetId: 'cozinhas_geolocalizadas_2025?situacao=Mapeada',
    });
  });

  test('a prompt with no year takes the most recent snapshot, whatever the order', () => {
    expect(
      preflightPrompt({
        prompt: 'cozinhas habilitadas agora',
        filterDomains: [DOMAINS[1], DOMAINS[0]],
      })
    ).toEqual({
      status: 'resolved',
      datasetId: 'cozinhas_geolocalizadas?situacao=Habilitada',
    });
    expect(
      preflightPrompt({
        prompt: 'cozinhas mapeadas',
        filterDomains: [DOMAINS[1], DOMAINS[0]],
      })
    ).toMatchObject({ message: expect.stringMatching(/2026/) });
  });

  test('a long value is matched without its short words colliding', () => {
    expect(
      preflightPrompt({
        prompt: 'cozinhas em análise em 2025',
        filterDomains: DOMAINS,
      })
    ).toEqual({
      status: 'resolved',
      datasetId: 'cozinhas_geolocalizadas_2025?situacao=Em análise',
    });
  });

  test('refuses a value the chosen year does not cover, never zero', () => {
    const result = preflightPrompt({
      prompt: 'cozinhas mapeadas',
      filterDomains: DOMAINS,
    });
    expect(result.status).toBe('unsupported');
    expect(result).toMatchObject({ message: expect.stringMatching(/2026/) });
  });

  test('refuses two snapshot years named at once, never picking one silently', () => {
    expect(
      preflightPrompt({
        prompt: 'cozinhas habilitadas 2025 e 2026',
        filterDomains: DOMAINS,
      }).status
    ).toBe('unsupported');
  });

  test('refuses two values named at once', () => {
    expect(
      preflightPrompt({
        prompt: 'cozinhas mapeadas e retiradas 2025',
        filterDomains: DOMAINS,
      }).status
    ).toBe('unsupported');
  });

  test('asks which value when a head word starts several', () => {
    expect(
      preflightPrompt({
        prompt: 'cozinhas homologadas 2025',
        filterDomains: DOMAINS,
      })
    ).toEqual({
      status: 'ambiguous',
      clarify: {
        facet: 'dataset',
        question: 'Qual valor de "Situação" você quer no mapa?',
        options: [
          {
            value:
              'cozinhas_geolocalizadas_2025?situacao=Homologada para Habilitação',
            label: 'Situação: Homologada para Habilitação (2025)',
          },
          {
            value:
              'cozinhas_geolocalizadas_2025?situacao=Homologada para Retirada',
            label: 'Situação: Homologada para Retirada (2025)',
          },
        ],
        default:
          'cozinhas_geolocalizadas_2025?situacao=Homologada para Habilitação',
      },
    });
  });

  test('refuses a head word whose values the chosen year does not cover', () => {
    expect(
      preflightPrompt({
        prompt: 'cozinhas homologadas',
        filterDomains: DOMAINS,
      }).status
    ).toBe('unsupported');
  });

  test('resolves a head word that starts one covered value', () => {
    expect(
      preflightPrompt({
        prompt: 'cozinhas com pendência 2025',
        filterDomains: DOMAINS,
      })
    ).toEqual({
      status: 'resolved',
      datasetId:
        'cozinhas_geolocalizadas_2025?situacao=Pendência emitida pelo MDS (Prazo para adequações 15 dias)',
    });
  });

  test('the user picking a filtered id answers the question', () => {
    expect(
      preflightPrompt({
        prompt: 'cozinhas homologadas 2025',
        datasetId:
          'cozinhas_geolocalizadas_2025?situacao=Homologada para Retirada',
        filterDomains: DOMAINS,
      })
    ).toEqual({ status: 'resolved' });
  });

  test('refuses a value named while the user chose another dataset', () => {
    expect(
      preflightPrompt({
        prompt: 'ivs e cozinhas mapeadas 2025',
        datasetId: 'municipios_ivs',
        filterDomains: DOMAINS,
      }).status
    ).toBe('unsupported');
  });

  test('ignores values when the prompt names no filterable family', () => {
    expect(
      preflightPrompt({ prompt: 'ivs mapeada', filterDomains: DOMAINS })
    ).toEqual({ status: 'resolved' });
  });
});

describe('filtered ids across the route boundary', () => {
  test('validateDatasetId accepts a filtered id and refuses a field off the allowlist', () => {
    expect(
      validateDatasetId({
        datasetId: 'cozinhas_geolocalizadas?situacao=Mapeada',
      })
    ).toBe('cozinhas_geolocalizadas?situacao=Mapeada');
    const refused = validateDatasetId({
      datasetId: 'cozinhas_geolocalizadas?cnpj=123',
    });
    expect(refused).toBeInstanceOf(Response);
    expect((refused as Response).status).toBe(400);
  });

  test('isRenderableDatasetId keeps refusing non-strings', () => {
    expect(isRenderableDatasetId(42)).toBe(false);
  });

  test('appendRealMapData fills a filtered id with its counts', async () => {
    mockSnapshots();

    expect(
      await appendRealMapData({
        mapData: [
          { mapDataId: 'cozinhas_geolocalizadas_2025?situacao=Retirada' },
        ],
      })
    ).toEqual({
      mapData: [
        {
          mapDataId: 'cozinhas_geolocalizadas_2025?situacao=Retirada',
          data: [
            { geometryId: '111', value: 1 },
            { geometryId: '222', value: 0 },
          ],
        },
      ],
    });
  });

  test('fetchRenderableData answers null for an id that does not parse', async () => {
    expect(
      await fetchRenderableData(
        'cozinhas_geolocalizadas?nope' as RenderableDatasetId
      )
    ).toBeNull();
  });
});

describe('catalogue filtros', () => {
  test('a detailed filterable entry lists the values read from the data', async () => {
    const catalogue = JSON.parse(
      buildCatalogueContext(await gateway.getCatalogue(), 'cozinhas', DOMAINS)
    ) as {
      catalogue: { datasets: Array<{ id: string; filtros?: unknown }> };
    };
    const byId = Object.fromEntries(
      catalogue.catalogue.datasets.map((entry) => {
        return [entry.id, entry.filtros];
      })
    );

    expect(byId.cozinhas_geolocalizadas).toEqual([
      {
        campo: 'situacao',
        rotulo: 'Situação',
        formato: 'cozinhas_geolocalizadas?situacao=<valor>',
        valores: ['Habilitada'],
      },
    ]);
    expect(byId.cozinhas_pessoas_atendidas).toBeUndefined();
  });

  test('an index-only entry carries no filtros', async () => {
    const text = buildCatalogueContext(
      await gateway.getCatalogue(),
      'ivs',
      DOMAINS
    );

    expect(text).not.toContain('filtros');
  });
});

describe('"outras" asks which value', () => {
  test('even when the year holds a single value', () => {
    const result = preflightPrompt({
      prompt: 'demais cozinhas',
      filterDomains: DOMAINS,
    });

    expect(result).toMatchObject({
      status: 'ambiguous',
      clarify: { default: 'cozinhas_geolocalizadas?situacao=Habilitada' },
    });
  });

  test.each([
    'cozinhas habilitadas e outras',
    'cozinhas habilitadas e demais situações 2025',
  ])(
    'a value named next to "outras" is a combination, refused: "%s"',
    (prompt) => {
      expect(preflightPrompt({ prompt, filterDomains: DOMAINS }).status).toBe(
        'unsupported'
      );
    }
  );

  test('a filtered pick answers it', () => {
    expect(
      preflightPrompt({
        prompt: 'outras cozinhas 2025',
        datasetId: 'cozinhas_geolocalizadas_2025?situacao=Mapeada',
        filterDomains: DOMAINS,
      })
    ).toEqual({ status: 'resolved' });
  });
});
