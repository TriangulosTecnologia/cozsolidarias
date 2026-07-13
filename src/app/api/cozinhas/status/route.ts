import { gateway } from '../../../../gateway';

/**
 * Returns cozinha locations as a GeoJSON `FeatureCollection` of Points whose
 * properties carry `codigo`, `nome` and the canonical `situacao`, ready to be
 * used directly as a `@ttoss/geovis` geojson source
 * (`{ ..., data: '/api/cozinhas/status' }`) for the status-colored points map.
 */
export const GET = async () => {
  const cozinhas = await gateway.getCozinhasStatus();
  return Response.json(cozinhas);
};
