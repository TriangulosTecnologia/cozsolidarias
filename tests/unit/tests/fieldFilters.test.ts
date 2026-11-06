import {
  type FilterDomain,
  filteredMapDataRows,
  filterNote,
  filterOn,
  matchFilterValues,
  namesFilterableFamily,
  parseMapDataFilter,
  readFilterDomains,
  readFilterDomainsFor,
} from 'src/app/api/ai/spec/fieldFilters';
import {
  buildCatalogueContext,
  isRenderableDatasetId,
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

/** The preflight verdict for a value resolved on a base, filter kept server-side. */
const resolved = (datasetId: string, value: string) => {
  return {
    status: 'resolved',
    datasetId,
    filter: { field: 'situacao', value },
  };
};

describe('parseMapDataFilter', () => {
  test('reads the base, its snapshot year, the field and the raw value', () => {
    expect(
      parseMapDataFilter({
        mapDataId: 'cozinhas_geolocalizadas_2025',
        filter: { situacao: 'Não Habilitada' },
      })
    ).toEqual({
      baseId: 'cozinhas_geolocalizadas_2025',
      ano: 2025,
      field: 'situacao',
      value: 'Não Habilitada',
    });
  });

  test.each([
    ['municipios_ivs', { situacao: 'Habilitada' }],
    ['cozinhas_geolocalizadas', { cnpj: '123' }],
    ['cozinhas_geolocalizadas', { situacao: '' }],
    ['cozinhas_geolocalizadas', { situacao: '  ' }],
    ['cozinhas_geolocalizadas', { situacao: 3 }],
    ['cozinhas_geolocalizadas', { situacao: 'Habilitada', uf: 'SP' }],
    ['cozinhas_geolocalizadas', 'Habilitada'],
    ['cozinhas_geolocalizadas', null],
  ])('refuses %s with %p', (mapDataId, filter) => {
    expect(typeof parseMapDataFilter({ mapDataId, filter })).toBe('string');
  });

  test('filterOn refuses a base that accepts no filter', () => {
    expect(
      filterOn({ baseId: 'municipios_ivs', field: 'situacao', value: 'x' })
    ).toBeUndefined();
  });

  test('filterNote names the field, the value and the year', () => {
    expect(
      filterNote({
        baseId: 'cozinhas_geolocalizadas_2025',
        ano: 2025,
        field: 'situacao',
        value: 'Mapeada',
      })
    ).toBe('Recorte: situação Mapeada (2025).');
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
    ).toEqual(resolved('cozinhas_geolocalizadas', 'Suspensa'));
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
  test('answers "cozinhas mapeadas 2025" with the 2025 base and a server filter', () => {
    expect(
      preflightPrompt({
        prompt: 'cozinhas mapeadas 2025',
        filterDomains: DOMAINS,
      })
    ).toEqual(resolved('cozinhas_geolocalizadas_2025', 'Mapeada'));
  });

  test('a prompt with no year takes the most recent snapshot, whatever the order', () => {
    expect(
      preflightPrompt({
        prompt: 'cozinhas habilitadas agora',
        filterDomains: [DOMAINS[1], DOMAINS[0]],
      })
    ).toEqual(resolved('cozinhas_geolocalizadas', 'Habilitada'));
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
    ).toEqual(resolved('cozinhas_geolocalizadas_2025', 'Em análise'));
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

  test('refuses a head word that starts several values, listing them to pick from', () => {
    const result = preflightPrompt({
      prompt: 'cozinhas homologadas 2025',
      filterDomains: DOMAINS,
    });

    expect(result.status).toBe('unsupported');
    expect(result).toMatchObject({
      message: expect.stringContaining(
        'Homologada para Habilitação; Homologada para Retirada'
      ),
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
    ).toEqual(
      resolved(
        'cozinhas_geolocalizadas_2025',
        'Pendência emitida pelo MDS (Prazo para adequações 15 dias)'
      )
    );
  });

  test('a filterable base the user picked fixes the year of the value', () => {
    expect(
      preflightPrompt({
        prompt: 'cozinhas mapeadas',
        datasetId: 'cozinhas_geolocalizadas_2025',
        filterDomains: DOMAINS,
      })
    ).toEqual({
      status: 'resolved',
      filter: { field: 'situacao', value: 'Mapeada' },
      datasetId: 'cozinhas_geolocalizadas_2025',
    });
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

describe('the filter across the route boundary', () => {
  test('validateDatasetId refuses a parameterized id like any unknown one', () => {
    const refused = validateDatasetId({
      datasetId: 'cozinhas_geolocalizadas?situacao=Mapeada',
    });
    expect(refused).toBeInstanceOf(Response);
    expect((refused as Response).status).toBe(400);
  });

  test('isRenderableDatasetId keeps refusing non-strings', () => {
    expect(isRenderableDatasetId(42)).toBe(false);
  });

  test('appendRealMapData applies an entry filter and drops it', async () => {
    mockSnapshots();

    expect(
      await appendRealMapData({
        mapData: [
          {
            mapDataId: 'cozinhas_geolocalizadas_2025',
            filter: { situacao: 'Retirada' },
          },
        ],
      })
    ).toEqual({
      mapData: [
        {
          mapDataId: 'cozinhas_geolocalizadas_2025',
          data: [
            { geometryId: '111', value: 1 },
            { geometryId: '222', value: 0 },
          ],
        },
      ],
    });
  });

  test('appendRealMapData refuses a malformed filter with a 422', async () => {
    const result = await appendRealMapData({
      mapData: [{ mapDataId: 'municipios_ivs', filter: { situacao: 'x' } }],
    });

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(422);
  });

  test('appendRealMapData refuses a filter value the snapshot does not cover', async () => {
    mockSnapshots();

    const result = await appendRealMapData({
      mapData: [
        {
          mapDataId: 'cozinhas_geolocalizadas',
          filter: { situacao: 'Mapeada' },
        },
      ],
    });

    expect((result as Response).status).toBe(422);
  });
});

describe('catalogue filters', () => {
  test('a detailed filterable entry lists the values read from the data', async () => {
    const catalogue = JSON.parse(
      buildCatalogueContext(await gateway.getCatalogue(), 'cozinhas', DOMAINS)
    ) as {
      catalogue: { datasets: Array<{ id: string; filters?: unknown }> };
    };
    const byId = Object.fromEntries(
      catalogue.catalogue.datasets.map((entry) => {
        return [entry.id, entry.filters];
      })
    );

    expect(byId.cozinhas_geolocalizadas).toEqual([
      {
        baseId: 'cozinhas_geolocalizadas',
        dataset: 'Cozinhas Solidárias geolocalizadas (2026)',
        ano: 2026,
        campo: 'situacao',
        rotulo: 'Situação',
        valores: ['Habilitada'],
      },
    ]);
    expect(byId.cozinhas_pessoas_atendidas).toBeUndefined();
  });

  test('an index-only entry carries no filters', async () => {
    const text = buildCatalogueContext(
      await gateway.getCatalogue(),
      'ivs',
      DOMAINS
    );

    expect(text).not.toContain('filters');
  });
});

describe('"outras" never resolves silently', () => {
  test('alone, it is refused with the values to pick from, even a single one', () => {
    const result = preflightPrompt({
      prompt: 'demais cozinhas',
      filterDomains: DOMAINS,
    });

    expect(result).toMatchObject({
      status: 'unsupported',
      message: expect.stringContaining('Habilitada'),
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
});
