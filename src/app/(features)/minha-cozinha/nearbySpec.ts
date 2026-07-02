import type {
  GeoJSONFeature,
  GeoJSONFeatureCollection,
  VisualizationSpec,
} from '@ttoss/geovis';

import type {
  NearbyCategory,
  NearbyKitchen,
  NearbyPlaceFeature,
  NearbyProvider,
} from '@/data-gateway/schema';

/** The concentric analysis rings, in metres. */
export const RING_RADII = [500, 1500, 3000] as const;

/** Categories in display order. */
export const CATEGORY_ORDER: NearbyCategory[] = [
  'abastecimento',
  'assistencia',
  'saude',
  'educacao',
  'transporte',
];

/** Label + map colour per category (brand palette, used as intentional map colours). */
export const CATEGORY_META: Record<
  NearbyCategory,
  { label: string; color: string }
> = {
  abastecimento: { label: 'Abastecimento', color: '#337C59' },
  assistencia: { label: 'Assistência', color: '#69448C' },
  saude: { label: 'Saúde', color: '#E45946' },
  educacao: { label: 'Educação', color: '#FF9D00' },
  transporte: { label: 'Transporte', color: '#524945' },
};

const PROVIDER_ATTRIBUTION: Record<NearbyProvider, string> = {
  osm: '© OpenStreetMap contributors',
  google: 'Google Maps',
};

const RING_LINE_COLOR = '#7A716D';
const CENTER_COLOR = '#241F21';
const IVORY = '#FAF9F7';

type Center = { latitude: number; longitude: number };

/**
 * GeoJSON Polygon approximating a circle of `radiusMeters` around `center`, as
 * an equirectangular ellipse — accurate enough for display at city scale.
 *
 * @example
 * const ring = circlePolygon({ latitude: -30, longitude: -51 }, 500);
 */
export const circlePolygon = (
  center: Center,
  radiusMeters: number,
  steps = 64
): GeoJSONFeature => {
  const latDegrees = radiusMeters / 111320;
  const lonDegrees =
    radiusMeters / (111320 * Math.cos((center.latitude * Math.PI) / 180));

  const ring: Array<[number, number]> = [];
  for (let index = 0; index <= steps; index += 1) {
    const theta = (index / steps) * 2 * Math.PI;
    ring.push([
      center.longitude + lonDegrees * Math.cos(theta),
      center.latitude + latDegrees * Math.sin(theta),
    ]);
  }

  return {
    type: 'Feature',
    properties: { radiusMeters },
    geometry: { type: 'Polygon', coordinates: [ring] },
  };
};

const featureCollection = (
  features: GeoJSONFeature[]
): GeoJSONFeatureCollection => {
  return { type: 'FeatureCollection', features };
};

const pointFeature = (longitude: number, latitude: number): GeoJSONFeature => {
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Point', coordinates: [longitude, latitude] },
  };
};

/** The 3 concentric rings (500/1500/3000 m) as a polygon FeatureCollection. */
export const buildRingsCollection = (
  center: Center
): GeoJSONFeatureCollection => {
  return featureCollection(
    RING_RADII.map((radius) => {
      return circlePolygon(center, radius);
    })
  );
};

/**
 * Builds the geovis spec for a selected kitchen: 3 border-only rings, the
 * kitchen centre, and one point layer per category (coloured via
 * {@link CATEGORY_META}).
 *
 * @example
 * const spec = buildNearbySpec({ center, features, provider: 'osm' });
 */
export const buildNearbySpec = (params: {
  center: Center;
  features: NearbyPlaceFeature[];
  provider: NearbyProvider;
}): VisualizationSpec => {
  const { center, features, provider } = params;
  const attribution = PROVIDER_ATTRIBUTION[provider];

  const categorySources = CATEGORY_ORDER.map((category) => {
    return {
      id: `nearby-${category}`,
      type: 'geojson' as const,
      attribution,
      data: featureCollection(
        features.filter((feature) => {
          return feature.properties.category === category;
        })
      ),
    };
  });

  const categoryLayers = CATEGORY_ORDER.map((category) => {
    return {
      id: `nearby-${category}-pts`,
      sourceId: `nearby-${category}`,
      geometry: 'point' as const,
      paint: {
        circleColor: CATEGORY_META[category].color,
        circleRadius: 5,
        circleOpacity: 0.85,
        circleStrokeColor: IVORY,
        circleStrokeWidth: 1,
      },
    };
  });

  return {
    id: 'minha-cozinha-nearby',
    engine: 'maplibre',
    view: { center: [center.longitude, center.latitude], zoom: 13 },
    sources: [
      { id: 'rings', type: 'geojson', data: buildRingsCollection(center) },
      {
        id: 'center',
        type: 'geojson',
        data: featureCollection([
          pointFeature(center.longitude, center.latitude),
        ]),
      },
      ...categorySources,
    ],
    layers: [
      {
        id: 'rings-line',
        sourceId: 'rings',
        geometry: 'polygon',
        paint: { fillOpacity: 0, lineColor: RING_LINE_COLOR },
      },
      ...categoryLayers,
      {
        id: 'center-pt',
        sourceId: 'center',
        geometry: 'point',
        paint: {
          circleColor: CENTER_COLOR,
          circleRadius: 7,
          circleStrokeColor: IVORY,
          circleStrokeWidth: 2,
        },
      },
    ],
  };
};

/** Builds the overview spec: every available kitchen as a point over Brazil. */
export const buildOverviewSpec = (
  kitchens: NearbyKitchen[]
): VisualizationSpec => {
  return {
    id: 'minha-cozinha-overview',
    engine: 'maplibre',
    view: { center: [-52, -15], zoom: 3.2 },
    sources: [
      {
        id: 'kitchens',
        type: 'geojson',
        data: featureCollection(
          kitchens.map((kitchen) => {
            return pointFeature(kitchen.longitude, kitchen.latitude);
          })
        ),
      },
    ],
    layers: [
      {
        id: 'kitchens-pts',
        sourceId: 'kitchens',
        geometry: 'point',
        paint: {
          circleColor: '#337C59',
          circleRadius: 6,
          circleStrokeColor: IVORY,
          circleStrokeWidth: 1.5,
        },
      },
    ],
  };
};

/** A category with its POIs, sorted by distance ascending. */
export type NearbyGroup = {
  category: NearbyCategory;
  label: string;
  color: string;
  items: NearbyPlaceFeature[];
};

/**
 * Groups features by category (display order), each sorted by distance.
 *
 * @example
 * const groups = groupByCategory(nearby.features);
 */
export const groupByCategory = (
  features: NearbyPlaceFeature[]
): NearbyGroup[] => {
  return CATEGORY_ORDER.map((category) => {
    const items = features
      .filter((feature) => {
        return feature.properties.category === category;
      })
      .sort((first, second) => {
        return (
          first.properties.distanceMeters - second.properties.distanceMeters
        );
      });

    return {
      category,
      label: CATEGORY_META[category].label,
      color: CATEGORY_META[category].color,
      items,
    };
  });
};
