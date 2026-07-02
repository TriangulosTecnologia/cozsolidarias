import type { NearbyCategory, NearbyPlaceFeature } from '@/data-gateway/schema';

import { CATEGORY_META, CATEGORY_ORDER } from './nearbySpec';

/**
 * Formats a distance in metres for display (`412 m`, `1,2 km`).
 *
 * @example
 * formatDistance(412); // '412 m'
 * formatDistance(1234); // '1,2 km'
 */
export const formatDistance = (meters: number): string => {
  if (meters < 1000) {
    return `${meters} m`;
  }
  return `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
};

/** Illustrative per-category summary of the surroundings. */
export type CategoryIndicator = {
  category: NearbyCategory;
  label: string;
  color: string;
  /** Total POIs of this category within the fetch radius. */
  total: number;
  /** POIs within 500 m / 1500 m (cumulative). */
  within500: number;
  within1500: number;
  /** Distance to the nearest POI of this category, or `null` if none. */
  nearestMeters: number | null;
  /**
   * Illustrative 0–100 proximity score: 100 if the nearest is within 500 m,
   * 66 within 1500 m, 33 within 3000 m, 0 if absent. NOT a validated metric —
   * it demonstrates the intent of an "access" index, nothing more.
   */
  accessScore: number;
};

/** Illustrative surroundings indicators for a kitchen. */
export type NearbyIndicators = {
  /** Total POIs across all categories. */
  total: number;
  /** Average of the per-category access scores (0–100, illustrative). */
  overallAccess: number;
  categories: CategoryIndicator[];
};

const accessScore = (nearestMeters: number | null): number => {
  if (nearestMeters === null) {
    return 0;
  }
  if (nearestMeters <= 500) {
    return 100;
  }
  if (nearestMeters <= 1500) {
    return 66;
  }
  return 33;
};

/**
 * Computes illustrative surroundings indicators from the nearby POIs: per
 * category totals, ring counts, nearest distance and a proximity-based access
 * score, plus an overall access average. Intended to demonstrate the idea of
 * indices, not to be a rigorous methodology.
 *
 * @example
 * const indicators = computeIndicators(nearby.features);
 * indicators.overallAccess; // 0–100
 */
export const computeIndicators = (
  features: NearbyPlaceFeature[]
): NearbyIndicators => {
  const categories = CATEGORY_ORDER.map((category) => {
    const items = features.filter((feature) => {
      return feature.properties.category === category;
    });
    const distances = items.map((feature) => {
      return feature.properties.distanceMeters;
    });
    const nearestMeters = distances.length > 0 ? Math.min(...distances) : null;

    return {
      category,
      label: CATEGORY_META[category].label,
      color: CATEGORY_META[category].color,
      total: items.length,
      within500: distances.filter((distance) => {
        return distance <= 500;
      }).length,
      within1500: distances.filter((distance) => {
        return distance <= 1500;
      }).length,
      nearestMeters,
      accessScore: accessScore(nearestMeters),
    };
  });

  const overallAccess = Math.round(
    categories.reduce((sum, indicator) => {
      return sum + indicator.accessScore;
    }, 0) / categories.length
  );

  return { total: features.length, overallAccess, categories };
};
