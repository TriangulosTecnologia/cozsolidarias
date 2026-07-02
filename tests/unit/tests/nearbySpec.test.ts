import {
  buildNearbySpec,
  buildOverviewSpec,
  buildRingsCollection,
  CATEGORY_META,
  CATEGORY_ORDER,
  circleRing,
  groupByCategory,
  RING_RADII,
} from 'src/app/(features)/minha-cozinha/nearbySpec';
import type {
  NearbyCategory,
  NearbyPlaceFeature,
} from 'src/data-gateway/schema';

const center = { latitude: -30.06995, longitude: -51.22246 };

const feat = (
  category: NearbyCategory,
  distanceMeters: number,
  ring: 500 | 1500 | 3000,
  name: string | null = 'Place'
): NearbyPlaceFeature => {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [-51, -30] },
    properties: {
      id: `${category}-${distanceMeters}`,
      name,
      category,
      sourceType: 'test',
      distanceMeters,
      ring,
    },
  };
};

describe('nearbySpec constants', () => {
  test('exposes the three rings and five ordered categories', () => {
    expect(RING_RADII).toEqual([500, 1500, 3000]);
    expect(CATEGORY_ORDER).toHaveLength(5);
    for (const category of CATEGORY_ORDER) {
      expect(CATEGORY_META[category].label.length).toBeGreaterThan(0);
      expect(CATEGORY_META[category].color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});

describe('circleRing', () => {
  test('returns a closed line ring with steps + 1 vertices', () => {
    const feature = circleRing(center, 500);

    expect(feature.type).toBe('Feature');
    expect(feature.geometry.type).toBe('LineString');
    if (feature.geometry.type !== 'LineString') {
      throw new Error('expected a LineString geometry');
    }
    const points = feature.geometry.coordinates;
    expect(points).toHaveLength(65);
    expect(points[0]).toEqual(points[points.length - 1]);
  });

  test('scales with the radius', () => {
    const small = circleRing(center, 500);
    const large = circleRing(center, 3000);
    if (
      small.geometry.type !== 'LineString' ||
      large.geometry.type !== 'LineString'
    ) {
      throw new Error('expected LineString geometries');
    }
    // Vertex 0 is at theta=0 (cos=1, sin=0): its longitude offset equals lonDegrees.
    const smallSpanLon = small.geometry.coordinates[0][0] - center.longitude;
    const largeSpanLon = large.geometry.coordinates[0][0] - center.longitude;
    expect(Math.abs(largeSpanLon)).toBeGreaterThan(Math.abs(smallSpanLon));
  });
});

describe('buildRingsCollection', () => {
  test('builds one polygon per ring radius', () => {
    const collection = buildRingsCollection(center);

    expect(collection.type).toBe('FeatureCollection');
    expect(collection.features).toHaveLength(RING_RADII.length);
  });
});

describe('buildNearbySpec', () => {
  test('includes ring, center and per-category sources and layers', () => {
    const spec = buildNearbySpec({
      center,
      features: [feat('saude', 100, 500), feat('educacao', 900, 1500)],
      provider: 'osm',
    });

    const sourceIds = spec.sources.map((source) => {
      return source.id;
    });
    const layerIds = spec.layers.map((layer) => {
      return layer.id;
    });

    expect(sourceIds).toEqual(
      expect.arrayContaining([
        'rings',
        'center',
        'nearby-saude',
        'nearby-transporte',
      ])
    );
    expect(layerIds).toEqual(
      expect.arrayContaining(['rings-line', 'center-pt', 'nearby-saude-pts'])
    );
    expect(spec.view.center).toEqual([center.longitude, center.latitude]);
  });

  test('works for the google provider too', () => {
    const spec = buildNearbySpec({ center, features: [], provider: 'google' });

    expect(spec.id).toBe('minha-cozinha-nearby');
  });
});

describe('buildOverviewSpec', () => {
  test('maps every kitchen to a point in the overview source', () => {
    const spec = buildOverviewSpec([
      {
        codigo: 'A',
        nome: 'A',
        municipio: 'M',
        uf: 'RS',
        latitude: -30,
        longitude: -51,
      },
      {
        codigo: 'B',
        nome: 'B',
        municipio: 'N',
        uf: 'SP',
        latitude: -23,
        longitude: -46,
      },
    ]);

    expect(spec.sources[0].id).toBe('kitchens');
    expect(spec.layers[0].id).toBe('kitchens-pts');
  });
});

describe('groupByCategory', () => {
  test('groups in display order and sorts each group by distance', () => {
    const groups = groupByCategory([
      feat('saude', 800, 1500),
      feat('saude', 200, 500),
      feat('abastecimento', 300, 500),
    ]);

    expect(
      groups.map((group) => {
        return group.category;
      })
    ).toEqual(CATEGORY_ORDER);

    const saude = groups.find((group) => {
      return group.category === 'saude';
    });
    expect(
      saude?.items.map((item) => {
        return item.properties.distanceMeters;
      })
    ).toEqual([200, 800]);

    const transporte = groups.find((group) => {
      return group.category === 'transporte';
    });
    expect(transporte?.items).toHaveLength(0);
  });
});
