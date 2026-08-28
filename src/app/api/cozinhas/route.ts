import { gateway } from '../../../gateway';

/**
 * Returns cozinha locations as a GeoJSON `FeatureCollection` of Points for the
 * requested snapshot year (`?ano=YYYY`, defaulting to the latest), ready to be
 * used directly as a `@ttoss/geovis` geojson source
 * (`{ ..., data: '/api/cozinhas?ano=2025' }`). Backs the time-lapse.
 */
export const GET = async (request: Request) => {
  const ano = new URL(request.url).searchParams.get('ano');
  const cozinhas = await gateway.getCozinhas(ano ? Number(ano) : undefined);
  return Response.json(cozinhas);
};
