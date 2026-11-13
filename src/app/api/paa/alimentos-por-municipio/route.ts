import { gateway } from '../../../../gateway';

/**
 * Returns the food planned in the 2025 PAA purchases for the Cozinhas
 * Solidárias per supplier município as an array of `{ codigoIbge, municipio,
 * quantidadeKg, produtos, fornecedores }`, ready to feed the "alimentos
 * previstos" choropleth's `mapData` (join `geometryId: codigoIbge` ↔
 * `feature.properties.codarea`).
 */
export const GET = async () => {
  const porMunicipio = await gateway.getPaaAlimentosPorMunicipio();
  return Response.json(porMunicipio);
};
