import type { CatalogueContract } from '@/data-gateway/schema';
import { gateway } from '@/gateway';

import { buildCatalogueContext } from './mapDataCatalogue';
import type { FamilyName } from './renderableFields';

/**
 * Module-level cache of the gateway's catalogue, read once per process.
 */
let cachedCatalogue: Promise<CatalogueContract> | null = null;

/**
 * The gateway's catalogue, read once and kept for the process lifetime.
 */
const readCatalogue = (): Promise<CatalogueContract> => {
  if (!cachedCatalogue) {
    cachedCatalogue = gateway.getCatalogue();
  }
  return cachedCatalogue;
};

/**
 * The two-tier catalogue context (see {@link buildCatalogueContext}) for one
 * request: with `focus`, only that family's datasets keep their detail. Joined
 * into the first `messages[0].content` of a session (see {@link getAgentResponse}).
 */
export const readCatalogueContext = async (
  focus?: FamilyName
): Promise<string> => {
  return buildCatalogueContext(await readCatalogue(), focus);
};
