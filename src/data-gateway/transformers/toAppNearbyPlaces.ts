import type { StaticNearbyPlacesSource } from '../../data-source-static/types';
import type {
  NearbyCategory,
  NearbyPlaceFeature,
  NearbyPlacesContract,
  NearbyProvider,
  NearbyRing,
} from '../schema';

const CATEGORIES: readonly NearbyCategory[] = [
  'abastecimento',
  'assistencia',
  'saude',
  'educacao',
  'transporte',
];

const RINGS: readonly NearbyRing[] = [500, 1500, 3000];

const isNearbyCategory = (value: string): value is NearbyCategory => {
  return (CATEGORIES as readonly string[]).includes(value);
};

const isNearbyRing = (value: number): value is NearbyRing => {
  return (RINGS as readonly number[]).includes(value);
};

/** Validates a single source feature and narrows it to the app contract. */
const toContractFeature = (
  feature: StaticNearbyPlacesSource['features'][number],
  label: string
): NearbyPlaceFeature => {
  const { properties, geometry } = feature;

  if (!isNearbyCategory(properties.category)) {
    throw new Error(
      `[data-gateway] ${label}: unknown category "${properties.category}".`
    );
  }
  if (!isNearbyRing(properties.ring)) {
    throw new Error(
      `[data-gateway] ${label}: invalid ring "${properties.ring}".`
    );
  }

  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: geometry.coordinates },
    properties: {
      id: properties.id,
      name: properties.name,
      category: properties.category,
      sourceType: properties.sourceType,
      distanceMeters: properties.distanceMeters,
      ring: properties.ring,
    },
  };
};

/**
 * Validates a raw nearby snapshot and returns the canonical
 * {@link NearbyPlacesContract}. Narrows `category`/`ring` to their unions and
 * fails with a typed error on any structural or value violation.
 *
 * @param source - The raw snapshot read from disk.
 * @param context - `provider` and `cozinhaId` used only for error messages.
 * @returns The validated, app-facing collection.
 * @throws If the collection, metadata, or any feature is malformed.
 *
 * @example
 * const contract = toAppNearbyPlaces(raw, { provider: 'osm', cozinhaId: 'CS014558' });
 * contract.metadata.provider; // 'osm'
 */
export const toAppNearbyPlaces = (
  source: StaticNearbyPlacesSource,
  context: { provider: NearbyProvider; cozinhaId: string }
): NearbyPlacesContract => {
  const label = `${context.provider}/${context.cozinhaId}`;

  if (source.type !== 'FeatureCollection' || !Array.isArray(source.features)) {
    throw new Error(`[data-gateway] ${label}: not a FeatureCollection.`);
  }

  const metadata = source.metadata;
  if (metadata.provider !== 'osm' && metadata.provider !== 'google') {
    throw new Error(
      `[data-gateway] ${label}: unknown provider "${metadata.provider}".`
    );
  }

  const truncatedCategories = metadata.truncatedCategories.map((value) => {
    if (!isNearbyCategory(value)) {
      throw new Error(
        `[data-gateway] ${label}: unknown truncated category "${value}".`
      );
    }
    return value;
  });

  return {
    type: 'FeatureCollection',
    metadata: {
      provider: metadata.provider,
      cozinhaId: metadata.cozinhaId,
      center: metadata.center,
      radiusMeters: metadata.radiusMeters,
      generatedAt: metadata.generatedAt,
      attribution: metadata.attribution,
      truncatedCategories,
    },
    features: source.features.map((feature) => {
      return toContractFeature(feature, label);
    }),
  };
};
