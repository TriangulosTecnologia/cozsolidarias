import { gateway } from '../../../gateway';

/**
 * Returns CAF area locations as a GeoJSON `FeatureCollection` of Points,
 * ready to be used directly as a `@ttoss/geovis` geojson source
 * (`{ ..., data: '/api/cafs' }`).
 */
export const GET = async () => {
  const cafs = await gateway.getCafs();
  return Response.json(cafs);
};
