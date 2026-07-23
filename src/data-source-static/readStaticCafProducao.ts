import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { StaticCafProducaoSource } from './types';

const CSV_PATH = join(
  process.cwd(),
  'src',
  'data-source-static',
  'data',
  'producao-caf.csv'
);

/**
 * Maps each CSV column header to the key used in {@link StaticCafProducaoSource}.
 * The order must match the column order in the CSV.
 */
const COLUMNS = [
  ['nr_caf', 'nrCaf'],
  ['categoria_renda', 'categoriaRenda'],
  ['ds_tipo_renda', 'dsTipoRenda'],
  ['ds_produto', 'dsProduto'],
  ['vl_renda_auferida', 'vlRendaAuferida'],
  ['vl_renda_estimada', 'vlRendaEstimada'],
] as const satisfies ReadonlyArray<
  readonly [string, keyof StaticCafProducaoSource]
>;

/** Keys coerced to `number | null`. */
const NUMERIC_KEYS = new Set<keyof StaticCafProducaoSource>([
  'vlRendaAuferida',
  'vlRendaEstimada',
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

const toRecord = (cells: string[]): StaticCafProducaoSource => {
  const record = {} as Record<
    keyof StaticCafProducaoSource,
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

  return record as StaticCafProducaoSource;
};

/**
 * Parses and validates the raw CAF production CSV text into typed records.
 * Pure (no I/O): the disk read lives in {@link readStaticCafProducao}.
 *
 * @param text - Raw semicolon-delimited CSV text (a leading UTF-8 BOM is
 * tolerated and stripped).
 * @returns The list of parsed CAF production records.
 * @throws If the CSV is empty or its header does not match the expected columns.
 *
 * @example
 * parseCafProducaoCsv('"nr_caf";"categoria_renda";...\n6;RENDA DO ESTABELECIMENTO AGROPECUÁRIO;...');
 * // [{ nrCaf: '6', categoriaRenda: 'RENDA DO ESTABELECIMENTO AGROPECUÁRIO', ... }]
 */
export const parseCafProducaoCsv = (
  text: string
): StaticCafProducaoSource[] => {
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows = parseSemicolonCsv(clean);

  if (rows.length === 0) {
    throw new Error('[data-source-static] CAF production CSV is empty.');
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

let cache: StaticCafProducaoSource[] | null = null;

/**
 * Reads, parses and validates the static CAF production CSV snapshot.
 *
 * Server-only: reads the CSV from disk with `fs`, so it must be called from a
 * Server Component, route handler or other server context. The parsed result is
 * memoized for the process lifetime.
 *
 * @returns The list of CAF production records from `data/producao-caf.csv`.
 * @throws If the CSV header does not match the expected columns.
 *
 * @example
 * const producao = await readStaticCafProducao();
 * const doNrCaf6 = producao.filter((p) => p.nrCaf === '6');
 */
export const readStaticCafProducao = async (): Promise<
  StaticCafProducaoSource[]
> => {
  if (cache) {
    return cache;
  }

  const raw = await readFile(CSV_PATH, 'utf8');
  cache = parseCafProducaoCsv(raw);

  return cache;
};
