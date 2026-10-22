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
