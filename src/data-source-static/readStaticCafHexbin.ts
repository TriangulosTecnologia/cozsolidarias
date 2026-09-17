import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { StaticCafHexbinSource } from './types';

/**
 * The CAF hexbin snapshot for one H3 resolution: one cell per hexagon covering
 * Brazil, with the CAFs counted inside it. Generated offline by
 * `scripts/generateCafHexbin.ts`, one run per resolution.
 */
const snapshotPath = (resolution: number) => {
  return join(
    process.cwd(),
    'src',
    'data-source-static',
    'data',
    `caf-hexbin-r${resolution}.json`
  );
};

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

const cache = new Map<number, StaticCafHexbinSource>();

/**
 * Reads, parses and validates the CAF hexbin snapshot for one resolution.
 *
 * Server-only: it reads from disk with `fs`, so it must be called from a Server
 * Component, route handler or other server context. Each resolution is memoized
 * separately for the lifetime of the process — at 6k cells with their rings (35k
 * at r5) the validation is worth paying once rather than per request, and
 * keeping them apart is what lets the map switch between them without re-reading
 * the one it came from.
 *
 * @param resolution - The H3 resolution to read; defaults to r4.
 * @returns The snapshot from `data/caf-hexbin-r<resolution>.json`.
 * @throws If the snapshot is missing or malformed.
 *
 * @example
 * const { cells } = await readStaticCafHexbin(5);
 * cells.filter((cell) => cell.count > 0).length;
 */
export const readStaticCafHexbin = async (
  resolution = 4
): Promise<StaticCafHexbinSource> => {
  const cached = cache.get(resolution);
  if (cached) {
    return cached;
  }

  const raw = await readFile(snapshotPath(resolution), 'utf8');
  const parsed = parseCafHexbin(raw);
  cache.set(resolution, parsed);

  return parsed;
};
