import { gateway } from '../../../../gateway';

/**
 * Returns the cozinha count per município (Brazil-wide) for the requested
 * snapshot year (`?ano=YYYY`, defaulting to the latest) as an array of
 * `{ codigoIbge, municipio, quantidade }`, ready to feed the choropleth map's
 * `mapData` (join `geometryId: codigoIbge` ↔ `feature.properties.codarea`).
 */
export const GET = async (request: Request) => {
  const ano = new URL(request.url).searchParams.get('ano');
  const porMunicipio = await gateway.getCozinhasPorMunicipio(
    ano ? Number(ano) : undefined
  );
  return Response.json(porMunicipio);
};
