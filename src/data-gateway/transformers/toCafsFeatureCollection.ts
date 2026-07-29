import type { StaticCafAreaSource } from '../../data-source-static/types';
import type { CafsFeatureCollection } from '../schema';

/**
 * Transforms source-native CAF area records into a canonical GeoJSON
 * `FeatureCollection` of Points.
 *
 * Records without coordinates (`latitude`/`longitude` are `null` in the source)
 * are dropped. Coordinates are emitted in GeoJSON order: `[longitude, latitude]`.
 * Each feature carries its `nrCaf` in `properties`; the map source promotes it
 * to `feature.id` (`promoteId: 'nrCaf'`), so a hover reports it as
 * `featureId` and feeds the tooltip lookup.
 *
 * @param sources - Raw records from data-source-static.
 * @returns Canonical {@link CafsFeatureCollection}.
 *
 * @example
 * toCafsFeatureCollection([
 *   { nrCaf: '6', latitude: -15.77, longitude: -48.18, dsTipoArea: 'Terra', ... },
 * ]);
 * // { type: 'FeatureCollection', features: [{ geometry: { coordinates: [-48.18, -15.77] }, properties: { nrCaf: '6', ... } }] }
 */
export const toCafsFeatureCollection = (
  sources: StaticCafAreaSource[]
): CafsFeatureCollection => {
  const features = sources
    .filter(
      (
        source
      ): source is StaticCafAreaSource & {
        latitude: number;
        longitude: number;
        nrArea: number;
      } => {
        return (
          source.latitude !== null &&
          source.longitude !== null &&
          source.nrArea !== null
        );
      }
    )
    .map((source) => {
      return {
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [source.longitude, source.latitude] as [number, number],
        },
        properties: {
          nrCaf: source.nrCaf,
          dsTipoArea: source.dsTipoArea,
          dsTipoUnidadeMedida: source.dsTipoUnidadeMedida,
          nrArea: source.nrArea,
          nmMunicipio: source.nmMunicipio,
          sgUf: source.sgUf,
          dsTipoLocalizacaoArea: source.dsTipoLocalizacaoArea,
          dsCondicaoDominio: source.dsCondicaoDominio,
          stImovelPrincipal: source.stImovelPrincipal,
        },
      };
    });

  return {
    type: 'FeatureCollection',
    features,
  };
};
