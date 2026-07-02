import {
  computeIndicators,
  formatDistance,
} from 'src/app/(features)/minha-cozinha/indicators';
import type {
  NearbyCategory,
  NearbyPlaceFeature,
} from 'src/data-gateway/schema';

const feat = (
  category: NearbyCategory,
  distanceMeters: number
): NearbyPlaceFeature => {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [-51, -30] },
    properties: {
      id: `${category}-${distanceMeters}`,
      name: 'Place',
      category,
      sourceType: 'test',
      distanceMeters,
      ring: distanceMeters <= 500 ? 500 : distanceMeters <= 1500 ? 1500 : 3000,
    },
  };
};

describe('formatDistance', () => {
  test('formats metres and kilometres in pt-BR', () => {
    expect(formatDistance(412)).toBe('412 m');
    expect(formatDistance(999)).toBe('999 m');
    expect(formatDistance(1000)).toBe('1,0 km');
    expect(formatDistance(1234)).toBe('1,2 km');
  });
});

describe('computeIndicators', () => {
  test('returns zeroed indicators for no features', () => {
    const indicators = computeIndicators([]);

    expect(indicators.total).toBe(0);
    expect(indicators.overallAccess).toBe(0);
    expect(indicators.categories).toHaveLength(5);
    for (const category of indicators.categories) {
      expect(category.total).toBe(0);
      expect(category.nearestMeters).toBeNull();
      expect(category.accessScore).toBe(0);
    }
  });

  test('computes totals, ring counts, nearest and proximity scores', () => {
    const indicators = computeIndicators([
      feat('saude', 300),
      feat('saude', 2000),
      feat('abastecimento', 800),
      feat('transporte', 2500),
    ]);

    expect(indicators.total).toBe(4);

    const byCategory = (category: NearbyCategory) => {
      return indicators.categories.find((indicator) => {
        return indicator.category === category;
      });
    };

    const saude = byCategory('saude');
    expect(saude?.total).toBe(2);
    expect(saude?.within500).toBe(1);
    expect(saude?.within1500).toBe(1);
    expect(saude?.nearestMeters).toBe(300);
    expect(saude?.accessScore).toBe(100);

    expect(byCategory('abastecimento')?.accessScore).toBe(66);
    expect(byCategory('transporte')?.accessScore).toBe(33);
    expect(byCategory('educacao')?.accessScore).toBe(0);

    // round((100 + 0 + 66 + 33 + 0) / 5) = 40
    expect(indicators.overallAccess).toBe(40);
  });
});
