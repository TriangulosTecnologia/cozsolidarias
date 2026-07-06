import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * `{ codigoIbge: habitantes }` for every Brazilian município, from the IBGE
 * Census 2022 "população residente" snapshot.
 */
export type StaticPopulacao = Record<string, number>;

/**
 * Same file the map could fetch from the browser
 * (`/geo/municipios-populacao.json`), read here from disk so the gateway can
 * derive the cozinhas-per-100k-inhabitants rate server-side.
 */
const POPULACAO_PATH = join(
  process.cwd(),
  'public',
  'geo',
  'municipios-populacao.json'
);

let cache: StaticPopulacao | null = null;

/**
 * Reads and parses the per-município population snapshot (IBGE Census 2022).
 *
 * Server-only: reads from disk with `fs`, so it must be called from a Server
 * Component, route handler or other server context. The parsed result is
 * memoized for the lifetime of the process.
 *
 * @returns A flat `{ codigoIbge: habitantes }` map keyed by 7-digit IBGE code
 * (joins to `feature.properties.codarea` on the map).
 *
 * @example
 * const populacao = await readStaticPopulacao();
 * populacao['3550308']; // 11451999 (São Paulo)
 */
export const readStaticPopulacao = async (): Promise<StaticPopulacao> => {
  if (cache) {
    return cache;
  }

  const raw = await readFile(POPULACAO_PATH, 'utf8');
  cache = JSON.parse(raw) as StaticPopulacao;

  return cache;
};
