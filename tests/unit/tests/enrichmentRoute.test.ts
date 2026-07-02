/**
 * @jest-environment node
 */
import { GET } from 'src/app/api/minha-cozinha/[cozinhaId]/enrichment/route';
import type { KitchenEnrichment } from 'src/data-gateway/schema';
import { gateway } from 'src/gateway';

const fixture = (): KitchenEnrichment => {
  return {
    cozinhaId: 'CS1',
    generatedAt: '2025-11-04',
    status: {
      situacao: { value: 'Habilitada', source: 'Banco' },
      emFuncionamento: { value: 'Sim', source: 'Banco' },
      refeicoesPorDia: { value: null, source: 'Banco' },
    },
    sourcing: null,
    supplyNetwork: {
      municipio: 'Porto Alegre',
      paaReceivingUnits: { value: 126, source: 'PAA' },
      isPaaReceiver: { value: false, source: 'PAA' },
      paaProducts: { value: [], source: 'PAA' },
      cafOrganizations: { value: 0, source: 'CAF' },
      cafExamples: { value: [], source: 'CAF' },
    },
  };
};

const request = (): Request => {
  return new Request('http://test/api/minha-cozinha/CS1/enrichment');
};

const params = Promise.resolve({ cozinhaId: 'CS1' });

describe('GET /api/minha-cozinha/[cozinhaId]/enrichment', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('returns the enrichment for the requested cozinha', async () => {
    const spy = jest
      .spyOn(gateway, 'getKitchenEnrichment')
      .mockResolvedValue(fixture());

    const response = await GET(request(), { params });
    const body = (await response.json()) as KitchenEnrichment;

    expect(spy).toHaveBeenCalledWith({ cozinhaId: 'CS1' });
    expect(body.cozinhaId).toBe('CS1');
    expect(body.supplyNetwork.municipio).toBe('Porto Alegre');
  });
});
