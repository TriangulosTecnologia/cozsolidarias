import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { StaticEnrichmentSource } from './types';

/** Root of the per-kitchen enrichment snapshots (`<cozinhaId>.json`). */
const ENRICHMENT_DIR = join(
  process.cwd(),
  'src',
  'data-source-static',
  'data',
  'enrichment'
);

/**
 * Reads a raw kitchen-enrichment snapshot for one cozinha.
 *
 * Server-only: reads from disk with `fs`. Returns the parsed file untouched
 * (source-native); validation and narrowing happen in the gateway transformer.
 * Fails loudly when the snapshot is missing.
 *
 * @param params - `cozinhaId` (e.g. `CS014558`).
 * @returns The parsed snapshot as {@link StaticEnrichmentSource}.
 * @throws If the snapshot file does not exist.
 *
 * @example
 * const raw = await readStaticEnrichment({ cozinhaId: 'CS014558' });
 * raw.supplyNetwork.municipio; // 'Porto Alegre'
 */
export const readStaticEnrichment = async (params: {
  cozinhaId: string;
}): Promise<StaticEnrichmentSource> => {
  const path = join(ENRICHMENT_DIR, `${params.cozinhaId}.json`);

  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch {
    throw new Error(
      `[data-source-static] enrichment snapshot not found: ${params.cozinhaId}.json. ` +
        `Generate it with scripts/minha-cozinha-enrichment.`
    );
  }

  return JSON.parse(raw) as StaticEnrichmentSource;
};
