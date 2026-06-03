import { gateway } from '../../../gateway';

/**
 * Returns cozinha locations as a GeoJSON `FeatureCollection` of Points,
 * ready to be used directly as a `@ttoss/geovis` geojson source
 * (`{ ..., data: '/api/cozinhas' }`).
 */
export const GET = async () => {
  const cozinhas = await gateway.getCozinhas();
  return Response.json(cozinhas);
};
