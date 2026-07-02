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
 * @returns Canonical {@link CozinhasBubblesFeatureCollection}.
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
