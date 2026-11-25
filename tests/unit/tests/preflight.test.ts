import {
  cadunicoRateId,
  isCadunicoRateId,
  rateBaseOf,
} from 'src/app/api/ai/spec/cadunicoRateId';
import {
  buildConceptIndex,
  type ConceptEntry,
} from 'src/app/api/ai/spec/conceptIndex';
import {
  familyIdsOf,
  rateBaseFromPrompt,
} from 'src/app/api/ai/spec/datasetFamilies';
import {
  isRenderableDatasetId,
  RENDERABLE_DATASET_IDS,
} from 'src/app/api/ai/spec/mapDataCatalogue';
import {
  clarifyResponse,
  FAMILIES,
  feedbackResponse,
  preflightPrompt,
  preflightResponse,
} from 'src/app/api/ai/spec/preflight';

import { gateway } from '@/gateway';

describe('preflightPrompt', () => {
  test('asks the map type for a kitchen-count choropleth when FORBID_ABSOLUTE_ON_CHOROPLETH is on', () => {
    process.env['FORBID_ABSOLUTE_ON_CHOROPLETH'] = 'true';
    try {
      expect(
        preflightPrompt({ prompt: 'coroplético do número de cozinhas' })
      ).toMatchObject({ status: 'ambiguous', clarify: { facet: 'mapType' } });
      // An explicit choice is not asked again, nor served by the server.
      expect(
        preflightPrompt({
          prompt: 'mapa',
          datasetId: 'cozinhas_geolocalizadas',
          mapType: 'choropleth',
        })
      ).toEqual({ status: 'resolved' });
    } finally {
      delete process.env['FORBID_ABSOLUTE_ON_CHOROPLETH'];
    }
  });

  test('settles a kitchen-count choropleth by itself when FORBID_ABSOLUTE_ON_CHOROPLETH is off', () => {
    const settled = {
      status: 'resolved',
      spec: {
        mapType: 'choropleth',
        mapData: [{ mapDataId: 'cozinhas_geolocalizadas' }],
      },
    };

    expect(
      preflightPrompt({ prompt: 'coroplético do número de cozinhas' })
    ).toEqual(settled);
    expect(
      preflightPrompt({
        prompt: 'mapa',
        datasetId: 'cozinhas_geolocalizadas',
        mapType: 'choropleth',
      })
    ).toEqual(settled);
    // Another map type or another year is left to the agent.
    expect(
      preflightPrompt({
        prompt: 'coroplético de cozinhas',
        mapType: 'proportionalCircles',
      })
    ).toEqual({ status: 'resolved' });
    expect(
      preflightPrompt({ prompt: 'coroplético de cozinhas em 2025' })
    ).toEqual({ status: 'resolved' });
  });

  test('stops a request for a spatial grain no dataset has', () => {
    expect(
      preflightPrompt({ prompt: 'Mapa da vulnerabilidade social por estado.' })
    ).toEqual({ status: 'unavailable', grain: 'estado' });
    expect(
      preflightPrompt({
        prompt: 'Mapa das cozinhas por bairro na cidade de São Paulo.',
      })
    ).toEqual({ status: 'unavailable', grain: 'bairro' });
    expect(
      preflightPrompt({ prompt: 'IDHM em cada região do Brasil' })
    ).toEqual({ status: 'unavailable', grain: 'regiao' });
  });

  test('resolves a family named without a variant to its default dataset', () => {
    expect(
      preflightPrompt({ prompt: 'mapa de cozinhas por município' })
    ).toEqual({ status: 'resolved' });
    expect(preflightPrompt({ prompt: 'IVS dos municípios' })).toEqual({
      status: 'resolved',
    });
  });

  test('resolves a family with exactly one variant keyword', () => {
    expect(preflightPrompt({ prompt: 'ivs de infraestrutura' })).toEqual({
      status: 'resolved',
    });
  });

  test('a specific variant wins over the broader one it refines', () => {
    expect(
      preflightPrompt({ prompt: 'idhm de educação, escolaridade' })
    ).toEqual({ status: 'resolved' });
  });

  test('asks which variant when the prompt matches several of one family', () => {
    const result = preflightPrompt({
      prompt: 'ivs de infraestrutura e de renda',
    });

    expect(result).toMatchObject({
      status: 'ambiguous',
      clarify: {
        facet: 'dataset',
        default: 'municipios_ivs_infraestrutura',
        options: [
          { value: 'municipios_ivs_infraestrutura' },
          { value: 'municipios_ivs_renda_trabalho' },
        ],
      },
    });
  });

  test('asks for another map type when the prompt says choropleth for an absolute total', () => {
    const expected = {
      status: 'ambiguous',
      clarify: {
        facet: 'mapType',
        default: 'proportionalCircles',
        options: [{ value: 'proportionalCircles' }, { value: 'dotDensity' }],
      },
    };

    expect(
      preflightPrompt({ prompt: 'coroplético de pessoas atendidas' })
    ).toMatchObject(expected);
  });

  test('an explicit choropleth choice is not asked again; the downstream check explains it', () => {
    expect(
      preflightPrompt({ prompt: 'pessoas atendidas', mapType: 'choropleth' })
    ).toEqual({ status: 'resolved' });
  });

  test('does not ask when the absolute total gets a compatible map type', () => {
    expect(
      preflightPrompt({
        prompt: 'pessoas atendidas',
        mapType: 'proportionalCircles',
      })
    ).toEqual({ status: 'resolved' });
  });

  test('a chosen map type settles a prompt that still says choropleth', () => {
    expect(
      preflightPrompt({
        prompt: 'coroplético de pessoas atendidas',
        mapType: 'proportionalCircles',
      })
    ).toEqual({ status: 'resolved' });
  });

  test('a chosen datasetId replaces the text matching', () => {
    expect(
      preflightPrompt({
        prompt: 'ivs de infraestrutura e de renda',
        datasetId: 'municipios_ivs_renda_trabalho',
      })
    ).toEqual({ status: 'resolved' });
    expect(
      preflightPrompt({
        prompt: 'mapa',
        datasetId: 'cozinhas_pessoas_atendidas',
        mapType: 'choropleth',
      })
    ).toEqual({ status: 'resolved' });
  });

  test('routes a CadÚnico coverage ratio to its own family, not to the kitchen count or CadinSan', () => {
    process.env['FORBID_ABSOLUTE_ON_CHOROPLETH'] = 'true';
    try {
      for (const prompt of [
        'Mapa coroplético do número de cozinhas por 10 mil pessoas no CadÚnico em cada município.',
        'Mapa coroplético de cozinhas por 100 mil pessoas no CadÚnico.',
        'Mapa coroplético de pessoas no CadÚnico por cozinha em cada município.',
      ]) {
        expect(preflightPrompt({ prompt })).toEqual({ status: 'resolved' });
      }
    } finally {
      delete process.env['FORBID_ABSOLUTE_ON_CHOROPLETH'];
    }
  });

  test('asks which base when a coverage prompt names 10 mil and 100 mil', () => {
    expect(
      preflightPrompt({
        prompt: 'cozinhas por 10 mil e por 100 mil pessoas no CadÚnico',
      })
    ).toMatchObject({
      status: 'ambiguous',
      clarify: {
        facet: 'dataset',
        options: [
          { value: 'cozinhas_por_10mil_cadunico' },
          { value: 'cozinhas_por_100mil_cadunico' },
        ],
      },
    });
  });

  test('never blocks a prompt it does not recognise', () => {
    expect(preflightPrompt({ prompt: 'algo totalmente diferente' })).toEqual({
      status: 'unmatched',
    });
  });
});

describe('FAMILIES', () => {
  test('only offer datasets the route can render', () => {
    const ids = FAMILIES.flatMap((family) => {
      return [
        family.defaultId,
        ...family.variants.map((v) => {
          return v.id;
        }),
      ];
    });

    for (const id of ids) {
      expect(RENDERABLE_DATASET_IDS).toContain(id);
    }
  });

  /** The id each family the (normalized) prompt names resolves to. */
  const resolvedFamilyIds = (text: string): string[] => {
    return FAMILIES.filter((family) => {
      return family.keyword.test(text);
    }).map((family) => {
      const variants = family.variants.filter((variant) => {
        return variant.match.test(text);
      });
      expect(variants.length).toBeLessThanOrEqual(1);
      return variants[0]?.id ?? family.defaultId;
    });
  };

  test.each([
    [
      'mapa do numero de cozinhas por 10 mil pessoas no cadunico em cada municipio.',
      'cozinhas_por_10mil_cadunico',
    ],
    [
      'mapa do numero de cozinhas por 100 mil pessoas no cadunico em cada municipio.',
      'cozinhas_por_100mil_cadunico',
    ],
    [
      'mapa de pessoas no cadunico por cozinha em cada municipio.',
      'cadunico_pessoas_por_cozinha',
    ],
  ])(
    'routes a CadÚnico coverage prompt to its own id, not CADINSAN or the kitchen count: %s',
    (text, id) => {
      expect(resolvedFamilyIds(text)).toEqual([id]);
    }
  );

  test.each([
    [
      'mapa da inseguranca alimentar das familias do cadunico por municipio.',
      'municipios_cadinsan',
    ],
    ['coropletico de cozinhas', 'cozinhas_geolocalizadas'],
    ['pessoas atendidas pelas cozinhas', 'cozinhas_pessoas_atendidas'],
  ])(
    'keeps the CADINSAN and kitchen prompts where they were: %s',
    (text, id) => {
      expect(resolvedFamilyIds(text)).toEqual([id]);
    }
  );
});

describe('familyIdsOf', () => {
  test('lists every id of every family a normalized prompt names, once each', () => {
    expect(familyIdsOf('ivs e idhm por municipio')).toEqual([
      'municipios_ivs',
      'municipios_ivs_infraestrutura',
      'municipios_ivs_capital_humano',
      'municipios_ivs_renda_trabalho',
      'municipios_idhm',
      'municipios_idhm_longevidade',
      'municipios_idhm_educacao',
      'municipios_idhm_educacao_escolaridade',
      'municipios_idhm_educacao_frequencia',
      'municipios_idhm_renda',
    ]);
    expect(familyIdsOf('inseguranca alimentar')).toEqual([
      'municipios_cadinsan',
      'municipios_cadinsan_sem_pbf',
    ]);
    expect(familyIdsOf('um mapa qualquer')).toEqual([]);
  });
});

describe('rateBaseFromPrompt', () => {
  test.each([
    ['mapa do numero de cozinhas por 10 mil pessoas no cadunico', 10_000],
    ['cozinhas por 100 mil pessoas no cadunico', 100_000],
    ['cozinhas por 50 mil pessoas no cadunico', 50_000],
    ['cozinhas a cada 2,5 mil pessoas no cadunico', 2_500],
    ['cozinhas por mil pessoas no cadunico', 1_000],
    ['cozinhas por dez mil pessoas no cadunico', 10_000],
    ['cozinhas por cem mil pessoas no cadunico', 100_000],
    ['cozinhas por 100.000 pessoas no cadunico', 100_000],
    ['cozinhas para cada 20000 pessoas no cadunico', 20_000],
    ['cozinhas por 50k pessoas no cadunico', 50_000],
    ['cozinhas por 50 k pessoas no cadunico', 50_000],
    ['cozinhas por 50mil pessoas no cadunico', 50_000],
    ['cozinhas por 5000 pessoas no cadunico', 5_000],
    ['cozinhas a cada 2025 pessoas no cadunico', 2_025],
  ])('reads the base "%s" names', (text, base) => {
    expect(rateBaseFromPrompt(text)).toBe(base);
  });

  test.each([
    'mapa de pessoas no cadunico por cozinha',
    'familias do cadunico em inseguranca alimentar',
    'cozinhas por municipio em 2025',
    // A four-digit number is a base only when it counts people: not a year.
    'cozinhas no cadunico por 2025',
    'cozinhas por 2025 no cadunico',
  ])('names no base in "%s"', (text) => {
    expect(rateBaseFromPrompt(text)).toBeUndefined();
  });
});

describe('CadÚnico rate ids', () => {
  test('name their base: any base is a renderable id', () => {
    expect(rateBaseOf('cozinhas_por_10mil_cadunico')).toBe(10_000);
    expect(rateBaseOf('cozinhas_por_100mil_cadunico')).toBe(100_000);
    expect(rateBaseOf('cozinhas_por_50mil_cadunico')).toBe(50_000);
    expect(rateBaseOf('cozinhas_por_2_5mil_cadunico')).toBe(2_500);
    expect(isRenderableDatasetId('cozinhas_por_50mil_cadunico')).toBe(true);
  });

  test('round-trip a base through its id', () => {
    for (const base of [1_000, 2_500, 1_234, 10_000, 50_000, 100_000]) {
      expect(rateBaseOf(cadunicoRateId(base))).toBe(base);
    }
    expect(cadunicoRateId(50_000)).toBe('cozinhas_por_50mil_cadunico');
  });

  test('reject an id with no positive base', () => {
    expect(isCadunicoRateId('cozinhas_por_0mil_cadunico')).toBe(false);
    expect(isCadunicoRateId('cozinhas_por_mil_cadunico')).toBe(false);
    expect(isRenderableDatasetId('cozinhas_por_0mil_cadunico')).toBe(false);
    expect(() => {
      return rateBaseOf('cadunico_pessoas_por_cozinha');
    }).toThrow(/no rate base/);
  });
});

describe('clarifyResponse', () => {
  test('is a 200 with the question, no spec and the map type options', async () => {
    const result = preflightPrompt({
      prompt: 'coroplético de pessoas atendidas',
    });
    if (result.status !== 'ambiguous') {
      throw new Error('expected an ambiguous result');
    }

    const response = clarifyResponse(result.clarify);
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ error: false, clarify: result.clarify });
    expect(body['spec']).toBeUndefined();
    expect(body['mapTypeOptions']).toHaveLength(3);
  });
});

describe('preflightPrompt with the catalogue concepts', () => {
  let concepts: ConceptEntry[];

  beforeAll(async () => {
    concepts = buildConceptIndex(await gateway.getCatalogue());
  });

  test('answers a concept no catalogue dataset describes with feedback, before any model call', () => {
    const result = preflightPrompt({
      prompt: 'mapa de rodovias e aeroportos',
      concepts,
    });

    expect(result).toMatchObject({
      status: 'feedback',
      feedback: {
        verdict: 'absent',
        reason: expect.stringContaining('rodovias, aeroportos'),
      },
    });
    if (result.status !== 'feedback') {
      throw new Error('expected feedback');
    }
    expect(result.feedback.suggestions.join(' ')).toContain(
      'Índice de Vulnerabilidade Social'
    );
  });

  test('answers a concept only a catalogued, unserved dataset describes', () => {
    expect(
      preflightPrompt({ prompt: 'mapa dos assentamentos rurais', concepts })
    ).toMatchObject({
      status: 'feedback',
      feedback: {
        verdict: 'notRenderable',
        reason: expect.stringContaining('Assentamentos rurais (SICAR)'),
      },
    });
  });

  test('answers a year outside what the resolved dataset covers', () => {
    expect(preflightPrompt({ prompt: 'ivs de 2022', concepts })).toMatchObject({
      status: 'feedback',
      feedback: { verdict: 'period', reason: expect.stringContaining('2022') },
    });
    expect(
      preflightPrompt({ prompt: 'mapa de cozinhas em 2030', concepts })
    ).toMatchObject({ status: 'feedback', feedback: { verdict: 'period' } });
  });

  test('lets a covered year, a variant year and a chosen dataset through', () => {
    expect(preflightPrompt({ prompt: 'ivs de 2010', concepts })).toEqual({
      status: 'resolved',
    });
    expect(
      preflightPrompt({ prompt: 'mapa de cozinhas em 2025', concepts })
    ).toEqual({ status: 'resolved' });
    expect(
      preflightPrompt({
        prompt: 'mapa de 2022',
        datasetId: 'municipios_cadinsan',
        concepts,
      })
    ).toEqual({ status: 'feedback', feedback: expect.anything() });
    expect(
      preflightPrompt({
        prompt: 'mapa de 2025',
        datasetId: 'municipios_cadinsan',
        concepts,
      })
    ).toEqual({ status: 'resolved' });
  });

  test('a covered concept, or one the catalogue cannot judge, goes on to the agent', () => {
    expect(
      preflightPrompt({ prompt: 'mapa de vulnerabilidade social', concepts })
    ).toEqual({ status: 'unmatched' });
    expect(preflightPrompt({ prompt: 'quero ver um mapa', concepts })).toEqual({
      status: 'unmatched',
    });
  });

  test('keeps the question of an ambiguous prompt', () => {
    expect(
      preflightPrompt({
        prompt: 'ivs de infraestrutura e de renda em 2022',
        concepts,
      })
    ).toMatchObject({ status: 'ambiguous' });
  });

  test('without the concepts it behaves as before', () => {
    expect(preflightPrompt({ prompt: 'mapa de rodovias' })).toEqual({
      status: 'unmatched',
    });
    expect(preflightPrompt({ prompt: 'ivs de 2022' })).toEqual({
      status: 'resolved',
    });
  });
});

describe('preflightPrompt proxies', () => {
  test('hunger is answered by food insecurity, saying it is a proxy', () => {
    expect(preflightPrompt({ prompt: 'mapa da fome' })).toEqual({
      status: 'proxy',
      datasetId: 'municipios_cadinsan',
      note: expect.stringContaining('insegurança alimentar'),
    });
  });

  test('poverty is answered by the IVS income and work index', () => {
    expect(preflightPrompt({ prompt: 'onde há mais pobreza?' })).toMatchObject({
      status: 'proxy',
      datasetId: 'municipios_ivs_renda_trabalho',
    });
  });

  test('a proxy only stands in for a request that names no dataset', () => {
    expect(preflightPrompt({ prompt: 'ivs e pobreza' })).toEqual({
      status: 'resolved',
    });
  });

  test('every proxy targets a renderable dataset', () => {
    for (const prompt of ['fome', 'pobreza']) {
      const result = preflightPrompt({ prompt });
      if (result.status !== 'proxy') {
        throw new Error('expected a proxy');
      }
      expect(RENDERABLE_DATASET_IDS).toContain(result.datasetId);
    }
  });
});

describe('feedbackResponse', () => {
  test('is a 200 with the feedback, no spec and no error', async () => {
    const result = preflightPrompt({
      prompt: 'mapa de rodovias',
      concepts: buildConceptIndex(await gateway.getCatalogue()),
    });
    if (result.status !== 'feedback') {
      throw new Error('expected feedback');
    }

    const response = preflightResponse(result);
    const body = (await response?.json()) as Record<string, unknown>;

    expect(response?.status).toBe(200);
    expect(body).toEqual({ error: false, feedback: result.feedback });
    expect(feedbackResponse(result.feedback).status).toBe(200);
  });

  test('a proxy is not answered by the route: it goes on to the agent', () => {
    expect(
      preflightResponse({
        status: 'proxy',
        datasetId: 'municipios_cadinsan',
        note: 'x',
      })
    ).toBeNull();
  });
});
