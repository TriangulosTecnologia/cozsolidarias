import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { StaticCafAreaSource } from './types';

const CSV_PATH = join(
  process.cwd(),
  'src',
  'data-source-static',
  'data',
  'caf-area.csv'
);

/**
 * Maps each CSV column header to the key used in {@link StaticCafAreaSource}.
 * The order must match the column order in the CSV.
 */
const COLUMNS = [
  ['nr_caf', 'nrCaf'],
  ['ds_tipo_area', 'dsTipoArea'],
  ['ds_tipo_unidade_medida', 'dsTipoUnidadeMedida'],
  ['nr_area', 'nrArea'],
  ['cd_municipio', 'cdMunicipio'],
  ['sg_uf', 'sgUf'],
  ['nm_municipio', 'nmMunicipio'],
  ['ds_tipo_localizacao_area', 'dsTipoLocalizacaoArea'],
  ['ds_condicao_dominio', 'dsCondicaoDominio'],
  ['st_imovel_principal', 'stImovelPrincipal'],
  ['nr_latitude', 'latitude'],
  ['nr_longitude', 'longitude'],
] as const satisfies ReadonlyArray<
  readonly [string, keyof StaticCafAreaSource]
>;

/** Keys coerced to `number | null`. */
const NUMERIC_KEYS = new Set<keyof StaticCafAreaSource>([
  'nrArea',
  'latitude',
  'longitude',
]);

/** Mutable cursor threaded through {@link parseSemicolonCsv} as it scans the text. */
type CsvParseState = {
  rows: string[][];
  row: string[];
  field: string;
  inQuotes: boolean;
};

/**
 * Consumes one character from a semicolon-delimited CSV. Returns `true` when
 * it also consumed the next character (an escaped `""`), so the caller advances
 * the index by an extra step.
 */
const consumeChar = (
  state: CsvParseState,
  char: string,
  nextChar: string | undefined
): boolean => {
  if (state.inQuotes) {
    if (char !== '"') {
      state.field += char;
    } else if (nextChar === '"') {
      state.field += '"';
      return true;
    } else {
      state.inQuotes = false;
    }
    return false;
  }

  if (char === '"') {
    state.inQuotes = true;
  } else if (char === ';') {
    state.row.push(state.field);
    state.field = '';
  } else if (char === '\n') {
    state.row.push(state.field);
    state.rows.push(state.row);
    state.row = [];
    state.field = '';
  } else if (char !== '\r') {
    state.field += char;
  }

  return false;
};

/**
 * Parses semicolon-delimited CSV text into an array of string-cell rows.
 * Handles quoted fields with embedded semicolons, newlines and escaped
 * (doubled) double-quotes.
 */
const parseSemicolonCsv = (text: string): string[][] => {
  const state: CsvParseState = {
    rows: [],
    row: [],
    field: '',
    inQuotes: false,
  };

  for (let i = 0; i < text.length; i += 1) {
    if (consumeChar(state, text[i], text[i + 1])) {
      i += 1;
    }
  }

  if (state.field !== '' || state.row.length > 0) {
    state.row.push(state.field);
    state.rows.push(state.row);
  }

  return state.rows;
};

const toRecord = (cells: string[]): StaticCafAreaSource => {
  const record = {} as Record<
    keyof StaticCafAreaSource,
    string | number | null
  >;

  for (const [index, [, key]] of COLUMNS.entries()) {
    const value = (cells[index] ?? '').trim();

    if (NUMERIC_KEYS.has(key)) {
      const parsed = Number(value);
      record[key] = value === '' || Number.isNaN(parsed) ? null : parsed;
    } else {
      record[key] = value;
    }
  }

  return record as StaticCafAreaSource;
};

/**
 * Parses and validates the raw CAF area CSV text into typed records. Pure
 * (no I/O): the disk read lives in {@link readStaticCafs}.
 *
 * @param text - Raw semicolon-delimited CSV text (a leading UTF-8 BOM is
 * tolerated and stripped).
 * @returns The list of parsed CAF area records.
 * @throws If the CSV is empty or its header does not match the expected columns.
 *
 * @example
 * parseCafsCsv('"nr_caf";"ds_tipo_area";...\n6;Terra;...');
 * // [{ nrCaf: '6', dsTipoArea: 'Terra', ... }]
 */
export const parseCafsCsv = (text: string): StaticCafAreaSource[] => {
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows = parseSemicolonCsv(clean);

  if (rows.length === 0) {
    throw new Error('[data-source-static] CAF area CSV is empty.');
  }

  const [header, ...dataRows] = rows;

  if (header.length !== COLUMNS.length) {
    throw new Error(
      `[data-source-static] expected ${COLUMNS.length} columns but found ${header.length}.`
    );
  }

  for (const [index, [csvHeader]] of COLUMNS.entries()) {
    if (header[index] !== csvHeader) {
      throw new Error(
        `[data-source-static] column ${index} mismatch: expected "${csvHeader}", found "${header[index]}".`
      );
    }
  }

  return dataRows
    .filter((cells) => {
      return cells.some((cell) => {
        return cell.trim() !== '';
      });
    })
    .map(toRecord);
};

let cache: StaticCafAreaSource[] | null = null;

/**
 * Reads, parses and validates the static CAF area CSV snapshot.
 *
 * Server-only: it reads the CSV from disk with `fs`, so it must be called from
 * a Server Component, route handler or other server context. The parsed result
 * is memoized for the lifetime of the process.
 *
 * @returns The list of CAF area records from `data/caf-area.csv`.
 * @throws If the CSV header does not match the expected columns.
 *
 * @example
 * const cafs = await readStaticCafs();
 * const comCoordenadas = cafs.filter((c) => c.latitude !== null);
 */
export const readStaticCafs = async (): Promise<StaticCafAreaSource[]> => {
  if (cache) {
    return cache;
  }

  const raw = await readFile(CSV_PATH, 'utf8');
  cache = parseCafsCsv(raw);

  return cache;
};
