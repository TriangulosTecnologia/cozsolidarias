import type { StaticCozinhaSource } from '../../data-source-static/types';
import type { CozinhasFeatureCollection } from '../schema';

/**
 * Transforms source-native cozinha records into a canonical GeoJSON
 * `FeatureCollection` of Points.
 *
 * Records without coordinates (`latitude`/`longitude` are `null` in the source)
 * are dropped. Coordinates are emitted in GeoJSON order: `[longitude, latitude]`.
 *
 * @param sources - Raw records from data-source-static.
 * @returns Canonical {@link CozinhasFeatureCollection}.
 *
 * @example
 * toCozinhasFeatureCollection([
 *   { latitude: -23.0, longitude: -43.3, ... },
 * ]);
 * // { type: 'FeatureCollection', features: [{ ..., geometry: { coordinates: [-43.3, -23.0] } }] }
 */
export const toCozinhasFeatureCollection = (
  sources: StaticCozinhaSource[]
): CozinhasFeatureCollection => {
  const features = sources
    .filter(
      (
        source
      ): source is StaticCozinhaSource & {
        latitude: number;
        longitude: number;
      } => {
        return source.latitude !== null && source.longitude !== null;
      }
    )
    .map((source) => {
      return {
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [source.longitude, source.latitude] as [number, number],
        },
        properties: {},
      };
    });

  return {
    type: 'FeatureCollection',
    features,
  };
};
