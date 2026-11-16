import { preflightRequest } from 'src/app/api/ai/spec/requestPreflight';

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
});
