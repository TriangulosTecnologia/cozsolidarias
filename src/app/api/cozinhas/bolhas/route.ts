import { gateway } from '../../../../gateway';

/**
 * Returns one cozinha "bubble" per município (Brazil-wide) for the requested
 * snapshot year (`?ano=YYYY`, defaulting to the latest) as a GeoJSON
 * `FeatureCollection` of Points, ready to feed the proportional-circle map's
 * geojson source (`{ ..., data: '/api/cozinhas/bolhas?ano=2024' }`). Each
 * feature carries `properties.codarea` (join key) and `properties.quantidade`
 * (drives the circle size).
 */
export const GET = async (request: Request) => {
  const ano = new URL(request.url).searchParams.get('ano');
  const bolhas = await gateway.getCozinhasBubbles(
    ano ? Number(ano) : undefined
  );
  return Response.json(bolhas);
};
