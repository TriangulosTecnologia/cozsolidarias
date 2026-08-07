import { gateway } from '../../../../gateway';

/**
 * Returns the distinct-CAF count and share (%) of Brazil per município as an
 * array of `{ codigoIbge, municipio, quantidade, percentualDoBrasil }`, ready to
 * feed the CAF share choropleth's `mapData` (join `geometryId: codigoIbge` ↔
 * `feature.properties.codarea`).
 */
export const GET = async () => {
  const porMunicipio = await gateway.getCafsPorMunicipio();
  return Response.json(porMunicipio);
};
