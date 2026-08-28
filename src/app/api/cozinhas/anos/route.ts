import { gateway } from '../../../../gateway';

/**
 * Returns the cozinha snapshot years available for the time-lapse, oldest to
 * newest (e.g. `[2025, 2026]`). The client uses it to set the
 * timeline range and to prefetch every year up front.
 */
export const GET = async () => {
  return Response.json(gateway.getCozinhasYears());
};
