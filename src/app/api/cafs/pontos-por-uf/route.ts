import { gateway } from '../../../../gateway';

/**
 * Returns one GeoJSON Point per UF, positioned at the CAF-weighted centroid of
 * its municípios and carrying the UF's CAF total in `properties.quantidade`.
 * Feeds the country level of the CAF map's zoom hierarchy (join
 * `joinKey: 'nome'`).
 */
export const GET = async () => {
  const pontos = await gateway.getCafPontosPorUf();
  return Response.json(pontos);
};
