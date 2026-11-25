import {
  preflightRequest,
  readConcepts,
} from 'src/app/api/ai/spec/requestPreflight';

import { gateway } from '@/gateway';

describe('preflightRequest', () => {
  test('a catalogue read that failed once is retried, not cached as an empty index', async () => {
    jest
      .spyOn(gateway, 'getCatalogue')
      .mockRejectedValueOnce(new Error('catalogue unreadable'));

    const prompt = 'mapa de rodovias e aeroportos por município';
    const whileDown = await preflightRequest({ prompt });
    const afterRecovery = await preflightRequest({ prompt });

    expect(whileDown).not.toBeInstanceOf(Response);
    expect(afterRecovery).toBeInstanceOf(Response);
  });

  test('binds the ids of the families the prompt names, only when the user chose no dataset', async () => {
    const named = await preflightRequest({ prompt: 'IVS por município' });
    const chosen = await preflightRequest({
      prompt: 'IVS por município',
      datasetId: 'municipios_ivs_renda_trabalho',
    });
    const unnamed = await preflightRequest({ prompt: 'um mapa qualquer' });

    expect(named).toMatchObject({
      conceptIds: [
        'municipios_ivs',
        'municipios_ivs_infraestrutura',
        'municipios_ivs_capital_humano',
        'municipios_ivs_renda_trabalho',
      ],
    });
    expect(chosen).not.toHaveProperty('conceptIds');
    expect(unnamed).not.toHaveProperty('conceptIds');
  });
});

describe('readConcepts', () => {
  test('reads the catalogue index once and keeps it', async () => {
    const first = await readConcepts();

    expect(first.length).toBeGreaterThan(0);
    expect(await readConcepts()).toBe(first);
  });
});
