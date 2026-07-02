/**
 * @jest-environment node
 */
import { GET } from 'src/app/api/minha-cozinha/[cozinhaId]/nearby/route';
import type {
  NearbyPlacesContract,
  NearbyProvider,
} from 'src/data-gateway/schema';
import { gateway } from 'src/gateway';

const fixture = (provider: NearbyProvider): NearbyPlacesContract => {
  return {
    type: 'FeatureCollection',
    metadata: {
      provider,
      cozinhaId: 'CS1',
      center: { latitude: 0, longitude: 0 },
      radiusMeters: 3000,
      generatedAt: '2026-07-02T00:00:00.000Z',
      attribution:
        provider === 'osm' ? '© OpenStreetMap contributors' : 'Google Maps',
      truncatedCategories: [],
    },
    features: [],
  };
};

const request = (query = ''): Request => {
  return new Request(`http://test/api/minha-cozinha/CS1/nearby${query}`);
};

const params = Promise.resolve({ cozinhaId: 'CS1' });

describe('GET /api/minha-cozinha/[cozinhaId]/nearby', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('defaults the provider to osm and returns the collection', async () => {
    const spy = jest
      .spyOn(gateway, 'getNearbyPlaces')
      .mockResolvedValue(fixture('osm'));

    const response = await GET(request(), { params });
    const body = (await response.json()) as NearbyPlacesContract;

    expect(spy).toHaveBeenCalledWith({ cozinhaId: 'CS1', provider: 'osm' });
    expect(body.metadata.provider).toBe('osm');
  });

  test('honours provider=google', async () => {
    const spy = jest
      .spyOn(gateway, 'getNearbyPlaces')
      .mockResolvedValue(fixture('google'));

    await GET(request('?provider=google'), { params });

    expect(spy).toHaveBeenCalledWith({ cozinhaId: 'CS1', provider: 'google' });
  });

  test('falls back to osm on an unknown provider', async () => {
    const spy = jest
      .spyOn(gateway, 'getNearbyPlaces')
      .mockResolvedValue(fixture('osm'));

    await GET(request('?provider=bing'), { params });

    expect(spy).toHaveBeenCalledWith({ cozinhaId: 'CS1', provider: 'osm' });
  });
});
