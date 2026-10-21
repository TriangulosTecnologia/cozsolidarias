import { gateway } from '@/gateway';

/**
 * Returns the fixed 2025 habilitadas / all national kitchens snapshot.
 * @returns Canonical aggregate; individual kitchen records are not exposed.
 * @example GET(); // GET /api/cozinhas/habilitadas-participacao
 */
export const GET = async () => {
  return Response.json(await gateway.getKitchenEnabledShare2025());
};
