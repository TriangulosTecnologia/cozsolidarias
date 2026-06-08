import { gateway } from '../../../../gateway';

/**
 * Returns the cozinha count per SP município as an array of
 * `{ codigoIbge, municipio, quantidade }`, ready to feed the choropleth map's
 * `mapData` (join `geometryId: codigoIbge` ↔ `feature.properties.codarea`).
 */
export const GET = async () => {
  const porMunicipio = await gateway.getCozinhasPorMunicipio();
  return Response.json(porMunicipio);
};
