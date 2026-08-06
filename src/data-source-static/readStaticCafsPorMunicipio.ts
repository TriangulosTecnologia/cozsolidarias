import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { StaticCafPorMunicipioSource } from './types';

/**
 * Pre-aggregated CAF-per-município snapshot. Generated offline by
 * `scripts/generateCafPorMunicipio.ts` from `caf-area.csv` (which is too large
 * to aggregate at request time) and read here as a small (~5.5k row) artefact.
 */
const SNAPSHOT_PATH = join(
  process.cwd(),
  'src',
  'data-source-static',
  'data',
  'caf-por-municipio.json'
);

/** Type guard for one snapshot record, rejecting malformed/partial entries. */
const isRecord = (value: unknown): value is StaticCafPorMunicipioSource => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate['cdMunicipio'] === 'string' &&
    candidate['cdMunicipio'] !== '' &&
    typeof candidate['nmMunicipio'] === 'string' &&
    typeof candidate['quantidade'] === 'number' &&
    Number.isFinite(candidate['quantidade']) &&
    candidate['quantidade'] >= 0
  );
};

/**
 * Parses and validates the CAF-per-município snapshot text. Pure (no I/O): the
 * disk read lives in {@link readStaticCafsPorMunicipio}.
 *
 * @param text - Raw JSON text of the snapshot (an array of records).
 * @returns The validated list of per-município CAF counts.
 * @throws If the JSON is not an array or any record is malformed.
 *
 * @example
 * parseCafsPorMunicipio('[{"cdMunicipio":"3550308","nmMunicipio":"São Paulo","quantidade":42}]');
 * // [{ cdMunicipio: '3550308', nmMunicipio: 'São Paulo', quantidade: 42 }]
 */
export const parseCafsPorMunicipio = (
  text: string
): StaticCafPorMunicipioSource[] => {
  const parsed: unknown = JSON.parse(text);

  if (!Array.isArray(parsed)) {
    throw new Error(
      '[data-source-static] CAF-per-município snapshot must be a JSON array.'
    );
  }

  return parsed.map((entry, index) => {
    if (!isRecord(entry)) {
      throw new Error(
        `[data-source-static] malformed CAF-per-município record at index ${index}.`
      );
    }
    return entry;
  });
};

let cache: StaticCafPorMunicipioSource[] | null = null;

/**
 * Reads, parses and validates the CAF-per-município snapshot.
 *
 * Server-only: it reads from disk with `fs`, so it must be called from a Server
 * Component, route handler or other server context. The parsed result is
 * memoized for the lifetime of the process.
 *
 * @returns The list of per-município CAF counts from
 * `data/caf-por-municipio.json`.
 * @throws If the snapshot is missing or malformed.
 *
 * @example
 * const porMunicipio = await readStaticCafsPorMunicipio();
 * porMunicipio.find((r) => r.cdMunicipio === '3550308')?.quantidade;
 */
export const readStaticCafsPorMunicipio = async (): Promise<
  StaticCafPorMunicipioSource[]
> => {
  if (cache) {
    return cache;
  }

  const raw = await readFile(SNAPSHOT_PATH, 'utf8');
  cache = parseCafsPorMunicipio(raw);

  return cache;
};
