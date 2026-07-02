import { gateway } from '@/gateway';

/**
 * Returns the cozinhas that have a nearby snapshot available, as an array of
 * `{ codigo, nome, municipio, uf, latitude, longitude }` — feeds the Minha
 * Cozinha selector.
 *
 * `GET /api/minha-cozinha`
 */
export const GET = async () => {
  const kitchens = await gateway.getNearbyKitchens();
  return Response.json(kitchens);
};
