import { gateway } from '../../../../gateway';

/**
 * Returns the overall IVS score per município (Atlas da Vulnerabilidade Social,
 * IPEA) as an array of `{ codigoIbge, municipio, ivs }`, ready to feed the
 * social-vulnerability choropleth's `mapData` (join `geometryId: codigoIbge` ↔
 * `feature.properties.codarea`).
 */
export const GET = async () => {
  const ivsPorMunicipio = await gateway.getIvsPorMunicipio();
  return Response.json(ivsPorMunicipio);
};
