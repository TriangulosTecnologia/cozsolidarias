import { gateway } from '../../../../gateway';

/**
 * Returns one cozinha "bubble" per município (Brazil-wide) as a GeoJSON
 * `FeatureCollection` of Points, ready to feed the proportional-circle map's
 * geojson source (`{ ..., data: '/api/cozinhas/bolhas' }`). Each feature
 * carries `properties.codarea` (join key) and `properties.quantidade` (drives
 * the circle size).
 */
export const GET = async () => {
  const bolhas = await gateway.getCozinhasBubbles();
  return Response.json(bolhas);
};
