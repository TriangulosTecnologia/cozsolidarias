import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * `{ codigoIbge: pessoasCadastradas }` for every Brazilian município, from the
 * MDS/SAGI "MI Social" Cadastro Único snapshot (people registered per município).
 */
export type StaticCadUnico = Record<string, number>;

/**
 * Same file the map could fetch from the browser
 * (`/geo/municipios-cadunico.json`), read here from disk so the gateway can
 * derive the cozinhas-per-100k-CadÚnico-people rate server-side.
 */
const CADUNICO_PATH = join(
  process.cwd(),
  'public',
  'geo',
  'municipios-cadunico.json'
);

let cache: StaticCadUnico | null = null;

/**
 * Reads and parses the per-município Cadastro Único snapshot (MDS/SAGI MI
 * Social, reference month 2026-06).
 *
 * Server-only: reads from disk with `fs`, so it must be called from a Server
 * Component, route handler or other server context. The parsed result is
 * memoized for the lifetime of the process.
 *
 * @returns A flat `{ codigoIbge: pessoasCadastradas }` map keyed by 7-digit IBGE
 * code (joins to `feature.properties.codarea` on the map).
 *
 * @example
 * const cadunico = await readStaticCadUnico();
 * cadunico['3550308']; // 3884884 (São Paulo)
 */
export const readStaticCadUnico = async (): Promise<StaticCadUnico> => {
  if (cache) {
    return cache;
  }

  const raw = await readFile(CADUNICO_PATH, 'utf8');
  cache = JSON.parse(raw) as StaticCadUnico;

  return cache;
};
