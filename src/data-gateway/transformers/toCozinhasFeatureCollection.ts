import type { StaticCozinhaSource } from '../../data-source-static/types';
import type { CozinhasFeatureCollection } from '../schema';

/**
 * Transforms source-native cozinha records into a canonical GeoJSON
 * `FeatureCollection` of Points.
 *
 * Records without coordinates (`latitude`/`longitude` are `null` in the source)
 * are dropped. Coordinates are emitted in GeoJSON order: `[longitude, latitude]`.
 * Each feature carries its `codigo` in `properties`; the map source promotes it
 * to `feature.id` (`promoteId: 'codigo'`), so a map click reports it as
 * `featureId` and it can be requested via `/api/cozinhas/[codigo]`.
 *
 * @param sources - Raw records from data-source-static.
 * @returns Canonical {@link CozinhasFeatureCollection}.
 *
 * @example
 * toCozinhasFeatureCollection([
 *   { codigo: 'CS016282', latitude: -23.0, longitude: -43.3, ... },
 * ]);
 * // { type: 'FeatureCollection', features: [{ geometry: { coordinates: [-43.3, -23.0] }, properties: { codigo: 'CS016282' } }] }
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
        properties: { codigo: source.codigo },
      };
    });

  return {
    type: 'FeatureCollection',
    features,
  };
};
