import { gateway } from '@/gateway';

/**
 * Returns the supply/public-policy enrichment for a cozinha: official status,
 * self-reported sourcing, and the federal supply network in its município. Each
 * datum carries its own provenance so the UI can show where it came from.
 *
 * `GET /api/minha-cozinha/CS014558/enrichment`
 */
export const GET = async (
  _request: Request,
  context: { params: Promise<{ cozinhaId: string }> }
) => {
  const { cozinhaId } = await context.params;
  const enrichment = await gateway.getKitchenEnrichment({ cozinhaId });
  return Response.json(enrichment);
};
