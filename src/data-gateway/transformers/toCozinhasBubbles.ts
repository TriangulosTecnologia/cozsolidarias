import type { CozinhasBubblesFeatureCollection } from '../schema';
import type { MunicipioAggregate } from './toCozinhasPorMunicipio';

/**
 * Projects a per-município aggregate into the proportional-circle (bubble) map
 * source: one GeoJSON Point per município (anchored at its cozinhas' mean
 * position), carrying the `codarea`/`municipio`/`quantidade` properties the map
 * joins on.
 *
 * Pure mapping — the expensive point-in-polygon work lives in
 * {@link aggregateCozinhasPorMunicipio}, whose result the gateway memoizes and
 * shares with the choropleth. Only municípios with ≥1 cozinha get a bubble (the
 * aggregation never emits empty buckets).
 *
 * @param aggregate - Per-município counts + anchor points.
 * @returns Canonical {@link CozinhasBubblesFeatureCollection}: one feature per
 * aggregate entry, in the same order, anchored at its `centroid`.
 *
 * @example
 * toCozinhasBubbles([
 *   {
 *     codigoIbge: '2927408',
 *     municipio: 'SALVADOR',
 *     quantidade: 26,
 *     pessoasAtendidas: 45897,
 *     centroid: [-38.4555, -12.913],
 *   },
 * ]);
 * // {
 * //   type: 'FeatureCollection',
 * //   features: [{
 * //     type: 'Feature',
 * //     geometry: { type: 'Point', coordinates: [-38.4555, -12.913] },
 * //     properties: { codarea: '2927408', municipio: 'SALVADOR', quantidade: 26 },
 * //   }],
 * // }
 */
export const toCozinhasBubbles = (
  aggregate: MunicipioAggregate[]
): CozinhasBubblesFeatureCollection => {
  const features = aggregate.map(
    ({ codigoIbge, municipio, quantidade, centroid }) => {
      return {
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: centroid,
        },
        properties: { codarea: codigoIbge, municipio, quantidade },
      };
    }
  );

  return {
    type: 'FeatureCollection',
    features,
  };
};
