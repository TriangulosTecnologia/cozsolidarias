import { gateway } from '../../../../gateway';

/**
 * Returns the planned 2025 PAA kg per person served, per cozinha município, as
 * an array of `{ codigoIbge, municipio, kgPrevistos, pessoasAtendidas,
 * cozinhas, kgPorPessoa }`, ready to feed the "kg por pessoa atendida"
 * choropleth's `mapData` (join `geometryId: codigoIbge` ↔
 * `feature.properties.codarea`).
 */
export const GET = async () => {
  const porMunicipio = await gateway.getPaaKgPorPessoaPorMunicipio();
  return Response.json(porMunicipio);
};
