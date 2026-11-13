import {
  buildConceptIndex,
  type ConceptEntry,
} from 'src/app/api/ai/spec/conceptIndex';
import { RENDERABLE_DATASET_IDS } from 'src/app/api/ai/spec/mapDataCatalogue';
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
    } finally {
      delete process.env['FORBID_ABSOLUTE_ON_CHOROPLETH'];
    }
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
