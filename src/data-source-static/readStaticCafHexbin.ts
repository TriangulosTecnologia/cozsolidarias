import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { StaticCafHexbinSource } from './types';

/**
 * The CAF hexbin snapshot: one H3 cell per hexagon covering Brazil, with the
 * CAFs counted inside it. Generated offline by `scripts/generateCafHexbin.ts`.
 */
const SNAPSHOT_PATH = join(
  process.cwd(),
  'src',
  'data-source-static',
  'data',
  'caf-hexbin-r4.json'
);

/** Whether a value is a `[longitude, latitude]` pair of finite numbers. */
const isPosition = (value: unknown): value is [number, number] => {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((coordinate) => {
      return typeof coordinate === 'number' && Number.isFinite(coordinate);
    })
  );
};

/** Type guard for one cell, rejecting malformed/partial entries. */
const isCell = (
  value: unknown
): value is StaticCafHexbinSource['cells'][number] => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate['h3'] === 'string' &&
    candidate['h3'] !== '' &&
    typeof candidate['count'] === 'number' &&
    Number.isFinite(candidate['count']) &&
    // Three vertices is the minimum that bounds an area at all. The real rings
    // carry six or eight — H3 adds vertices where a cell crosses an icosahedron
    // edge — so this is a floor against truncation, not a shape assertion.
    Array.isArray(candidate['ring']) &&
    candidate['ring'].length >= 3 &&
    candidate['ring'].every(isPosition)
  );
};

/**
 * Parses and validates the hexbin snapshot text. Pure (no I/O): the disk read
 * lives in {@link readStaticCafHexbin}.
 *
 * @param text - Raw JSON text of the snapshot (`{ resolution, cells }`).
 * @returns The validated snapshot.
 * @throws If the JSON is not the expected object, `cells` is missing, or any
 * entry is malformed.
 *
 * @example
 * parseCafHexbin('{"resolution":4,"cells":[{"h3":"84a","count":2,"ring":[[-46,-23],[-45,-23],[-45,-22]]}]}');
 * // { resolution: 4, cells: [{ h3: '84a', count: 2, ring: [...] }] }
 */
export const parseCafHexbin = (text: string): StaticCafHexbinSource => {
  const parsed: unknown = JSON.parse(text);

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(
      '[data-source-static] CAF hexbin snapshot must be a JSON object.'
    );
  }

  const { resolution, cells } = parsed as Record<string, unknown>;

  if (typeof resolution !== 'number' || !Number.isFinite(resolution)) {
    throw new Error(
      '[data-source-static] CAF hexbin snapshot needs a numeric `resolution`.'
    );
  }

  if (!Array.isArray(cells)) {
    throw new Error(
      '[data-source-static] CAF hexbin snapshot needs a `cells` array.'
    );
  }

  return {
    resolution,
    cells: cells.map((entry, index) => {
      if (!isCell(entry)) {
        throw new Error(
          `[data-source-static] malformed CAF hexbin cell at index ${index}.`
        );
      }
      return entry;
    }),
  };
};

let cache: StaticCafHexbinSource | null = null;

/**
 * Reads, parses and validates the CAF hexbin snapshot.
 *
 * Server-only: it reads from disk with `fs`, so it must be called from a Server
 * Component, route handler or other server context. The parsed result is
 * memoized for the lifetime of the process — at ~6k cells with their rings, the
 * validation is worth paying once rather than per request.
 *
 * @returns The snapshot from `data/caf-hexbin-r4.json`.
 * @throws If the snapshot is missing or malformed.
 *
 * @example
 * const { cells } = await readStaticCafHexbin();
 * cells.filter((cell) => cell.count > 0).length;
 */
export const readStaticCafHexbin = async (): Promise<StaticCafHexbinSource> => {
  if (cache) {
    return cache;
  }

  const raw = await readFile(SNAPSHOT_PATH, 'utf8');
  cache = parseCafHexbin(raw);

  return cache;
};
