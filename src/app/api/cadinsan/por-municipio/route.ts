import { gateway } from '../../../../gateway';

/**
 * Returns the CADINSAN 2025 food-insecurity figures per município as an array of
 * `{ codigoIbge, municipio, uf, regiao, absolutoComPbf, absolutoSemPbf,
 * cadastrosCadunico, proporcaoComPbf, proporcaoSemPbf }`, ready to feed the
 * food-insecurity choropleths' `mapData` (join `geometryId: codigoIbge` ↔
 * `feature.properties.codarea`).
 */
export const GET = async () => {
  const porMunicipio = await gateway.getCadinsanPorMunicipio();
  return Response.json(porMunicipio);
};
