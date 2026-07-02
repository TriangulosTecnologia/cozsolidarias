/**
 * @jest-environment node
 */
import { GET } from 'src/app/api/minha-cozinha/route';
import type { NearbyKitchen } from 'src/data-gateway/schema';
import { gateway } from 'src/gateway';

describe('GET /api/minha-cozinha', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('returns the available kitchens from the gateway', async () => {
    const kitchens: NearbyKitchen[] = [
      {
        codigo: 'CS014558',
        nome: 'Casa da Tia Grazi',
        municipio: 'Porto Alegre',
        uf: 'RS',
        latitude: -30.06995,
        longitude: -51.22246,
      },
    ];
    const spy = jest
      .spyOn(gateway, 'getNearbyKitchens')
      .mockResolvedValue(kitchens);

    const response = await GET();
    const body = (await response.json()) as NearbyKitchen[];

    expect(spy).toHaveBeenCalledTimes(1);
    expect(body).toEqual(kitchens);
  });
});
