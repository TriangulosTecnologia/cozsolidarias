import { toAppNearbyPlaces } from 'src/data-gateway/transformers/toAppNearbyPlaces';
import type { StaticNearbyPlacesSource } from 'src/data-source-static/types';

const validSource = (): StaticNearbyPlacesSource => {
  return {
    type: 'FeatureCollection',
    metadata: {
      provider: 'osm',
      cozinhaId: 'CS014558',
      center: { latitude: -30.06995, longitude: -51.22246 },
      radiusMeters: 3000,
      generatedAt: '2026-07-02T04:46:46.180Z',
      attribution: '© OpenStreetMap contributors',
      truncatedCategories: ['abastecimento'],
    },
    features: [
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [-51.2245, -30.0696] },
        properties: {
          id: 'osm:way/1',
          name: 'Super Frare',
          category: 'abastecimento',
          sourceType: 'shop=supermarket',
          distanceMeters: 199,
          ring: 500,
        },
      },
    ],
  };
};

const ctx = { provider: 'osm' as const, cozinhaId: 'CS014558' };

describe('toAppNearbyPlaces', () => {
  test('returns a validated FeatureCollection contract', () => {
    const result = toAppNearbyPlaces(validSource(), ctx);

    expect(result.type).toBe('FeatureCollection');
    expect(result.metadata.provider).toBe('osm');
    expect(result.metadata.truncatedCategories).toEqual(['abastecimento']);
    expect(result.features).toHaveLength(1);
    expect(result.features[0].properties.category).toBe('abastecimento');
    expect(result.features[0].properties.ring).toBe(500);
    expect(result.features[0].geometry.coordinates).toEqual([
      -51.2245, -30.0696,
    ]);
  });

  test('throws when the collection type is not FeatureCollection', () => {
    const source = validSource();
    source.type = 'Nope';

    expect(() => {
      return toAppNearbyPlaces(source, ctx);
    }).toThrow(/not a FeatureCollection/);
  });

  test('throws on an unknown provider in metadata', () => {
    const source = validSource();
    source.metadata.provider = 'bing';

    expect(() => {
      return toAppNearbyPlaces(source, ctx);
    }).toThrow(/unknown provider/);
  });

  test('throws on an unknown feature category', () => {
    const source = validSource();
    source.features[0].properties.category = 'lazer';

    expect(() => {
      return toAppNearbyPlaces(source, ctx);
    }).toThrow(/unknown category/);
  });

  test('throws on an invalid ring value', () => {
    const source = validSource();
    source.features[0].properties.ring = 999;

    expect(() => {
      return toAppNearbyPlaces(source, ctx);
    }).toThrow(/invalid ring/);
  });

  test('throws on an unknown truncated category', () => {
    const source = validSource();
    source.metadata.truncatedCategories = ['lazer'];

    expect(() => {
      return toAppNearbyPlaces(source, ctx);
    }).toThrow(/unknown truncated category/);
  });
});
