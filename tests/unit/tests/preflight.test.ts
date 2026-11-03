import { RENDERABLE_DATASET_IDS } from 'src/app/api/ai/spec/mapDataCatalogue';
import {
  clarifyResponse,
  FAMILIES,
  preflightPrompt,
} from 'src/app/api/ai/spec/preflight';

describe('preflightPrompt', () => {
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

  test('resolves a cozinhas situation to its deterministic mapDataId and year', () => {
    expect(preflightPrompt({ prompt: 'cozinhas habilitadas 2025' })).toEqual({
      status: 'resolved',
      datasetId: 'cozinhas_habilitadas_2025',
    });
    expect(preflightPrompt({ prompt: 'cozinhas não habilitadas' })).toEqual({
      status: 'resolved',
      datasetId: 'cozinhas_nao_habilitadas_2026',
    });
    expect(preflightPrompt({ prompt: 'cozinhas com outra situação' })).toEqual({
      status: 'resolved',
      datasetId: 'cozinhas_outras_2026',
    });
  });

  test('never reads a negated não habilitada as habilitada', () => {
    expect(
      preflightPrompt({ prompt: 'cozinhas não habilitadas 2025' })
    ).toEqual({
      status: 'resolved',
      datasetId: 'cozinhas_nao_habilitadas_2025',
    });
  });

  test('refuses a prompt that names two situations, never answering one silently', () => {
    const result = preflightPrompt({
      prompt: 'cozinhas habilitadas e não habilitadas',
    });

    expect(result.status).toBe('unsupported');
  });

  test('refuses a situation named alongside a dataset the user already chose, never dropping it silently', () => {
    expect(
      preflightPrompt({
        prompt: 'cozinhas habilitadas',
        datasetId: 'cozinhas_pessoas_atendidas',
      }).status
    ).toBe('unsupported');
    expect(
      preflightPrompt({
        prompt: 'ivs infraestrutura e cozinhas habilitadas',
        datasetId: 'municipios_ivs_infraestrutura',
      }).status
    ).toBe('unsupported');
  });

  test('asks one question listing every ambiguous family', () => {
    const result = preflightPrompt({
      prompt:
        'ivs infraestrutura e capital humano; idhm educacao e longevidade',
    });

    expect(result.status).toBe('ambiguous');
    if (result.status !== 'ambiguous') {
      throw new Error('expected ambiguous');
    }
    expect(
      result.clarify.options.map((option) => {
        return option.value;
      })
    ).toEqual([
      'municipios_ivs_infraestrutura',
      'municipios_ivs_capital_humano',
      'municipios_idhm_longevidade',
      'municipios_idhm_educacao',
    ]);
    expect(result.clarify.default).toBe('municipios_ivs_infraestrutura');
  });

  test('a chosen dataset answers only its own family, so the other family still asks', () => {
    const result = preflightPrompt({
      prompt:
        'ivs infraestrutura e capital humano; idhm educacao e longevidade',
      datasetId: 'municipios_idhm_longevidade',
    });

    expect(result.status).toBe('ambiguous');
    if (result.status !== 'ambiguous') {
      throw new Error('expected ambiguous');
    }
    expect(
      result.clarify.options.map((option) => {
        return option.value;
      })
    ).toEqual([
      'municipios_ivs_infraestrutura',
      'municipios_ivs_capital_humano',
    ]);
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
