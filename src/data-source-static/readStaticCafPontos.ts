import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { StaticCafPontosSource } from './types';

/**
 * Positions for the CAF map's country level. Generated offline by
 * `scripts/generateCafPontos.ts` from the committed município polygons and CAF
 * counts, and read here as a 27-row artefact.
 */
const SNAPSHOT_PATH = join(
  process.cwd(),
  'src',
  'data-source-static',
  'data',
  'caf-pontos.json'
);

/** Whether a value carries a finite `longitude`/`latitude` pair. */
const hasCoordinates = (candidate: Record<string, unknown>): boolean => {
  return (
    typeof candidate['longitude'] === 'number' &&
    Number.isFinite(candidate['longitude']) &&
    typeof candidate['latitude'] === 'number' &&
    Number.isFinite(candidate['latitude'])
  );
};

/** Type guard for one UF anchor, rejecting malformed/partial entries. */
const isUf = (
  value: unknown
): value is StaticCafPontosSource['ufs'][number] => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate['codigoUf'] === 'string' &&
    candidate['codigoUf'] !== '' &&
    typeof candidate['uf'] === 'string' &&
    candidate['uf'] !== '' &&
    typeof candidate['nome'] === 'string' &&
    candidate['nome'] !== '' &&
    hasCoordinates(candidate)
  );
};

/**
 * Parses and validates the CAF anchor snapshot text. Pure (no I/O): the disk
 * read lives in {@link readStaticCafPontos}.
 *
 * @param text - Raw JSON text of the snapshot (`{ ufs }`).
 * @returns The validated UF anchors.
 * @throws If the JSON is not the expected object, `ufs` is missing, or any
 * entry is malformed.
 *
 * @example
 * parseCafPontos('{"ufs":[{"codigoUf":"53","uf":"DF","nome":"Distrito Federal","longitude":-47.8,"latitude":-15.8}]}');
 * // { ufs: [{ codigoUf: '53', uf: 'DF', nome: 'Distrito Federal', longitude: -47.8, latitude: -15.8 }] }
 */
export const parseCafPontos = (text: string): StaticCafPontosSource => {
  const parsed: unknown = JSON.parse(text);

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(
      '[data-source-static] CAF anchors snapshot must be a JSON object.'
    );
  }

  const { ufs } = parsed as Record<string, unknown>;

  if (!Array.isArray(ufs)) {
    throw new Error(
      '[data-source-static] CAF anchors snapshot needs a `ufs` array.'
    );
  }

  return {
    ufs: ufs.map((entry, index) => {
      if (!isUf(entry)) {
        throw new Error(
          `[data-source-static] malformed CAF UF anchor at index ${index}.`
        );
      }
      return entry;
    }),
  };
};

let cache: StaticCafPontosSource | null = null;

/**
 * Reads, parses and validates the CAF anchor snapshot.
 *
 * Server-only: it reads from disk with `fs`, so it must be called from a Server
 * Component, route handler or other server context. The parsed result is
 * memoized for the lifetime of the process.
 *
 * @returns The UF anchors from `data/caf-pontos.json`.
 * @throws If the snapshot is missing or malformed.
 *
 * @example
 * const { ufs } = await readStaticCafPontos();
 * ufs.find((row) => row.uf === 'BA')?.longitude;
 */
export const readStaticCafPontos = async (): Promise<StaticCafPontosSource> => {
  if (cache) {
    return cache;
  }

  const raw = await readFile(SNAPSHOT_PATH, 'utf8');
  cache = parseCafPontos(raw);

  return cache;
};
