import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { StaticCozinhaSource } from './types';

/**
 * Available cozinha snapshot years, oldest to newest. **2022–2025 are temporary
 * fictitious test snapshots** (same records as the `_all` file, only the
 * coordinates differ; generated to build the time-lapse feature); **2026** maps
 * to the real `_all` snapshot. Replace the `_teste` entries with real per-year
 * files once they exist.
 */
export const COZINHAS_YEARS = [2022, 2023, 2024, 2025, 2026] as const;

/** A year that has a cozinha snapshot. */
export type CozinhaYear = (typeof COZINHAS_YEARS)[number];

/** The most recent snapshot year; the default when no year is requested. */
export const LATEST_COZINHA_YEAR: CozinhaYear = 2026;

/** Type guard: whether a number is one of the {@link COZINHAS_YEARS}. */
export const isCozinhaYear = (value: number): value is CozinhaYear => {
  return (COZINHAS_YEARS as readonly number[]).includes(value);
};

/** Maps each snapshot year to its CSV filename under `data/`. */
const YEAR_TO_FILE: Record<CozinhaYear, string> = {
  2022: 'cozinhas_com_geolocalizacao_2022_teste.csv',
  2023: 'cozinhas_com_geolocalizacao_2023_teste.csv',
  2024: 'cozinhas_com_geolocalizacao_2024_teste.csv',
  2025: 'cozinhas_com_geolocalizacao_2025_teste.csv',
  2026: 'cozinhas_com_geolocalizacao_all.csv',
};

const dataPath = (file: string): string => {
  return join(process.cwd(), 'src', 'data-source-static', 'data', file);
};

/**
 * Maps each CSV column header to the key used in {@link StaticCozinhaSource}.
 * The order must match the column order in the CSV.
 */
const COLUMNS = [
  ['Código da Cozinha', 'codigo'],
  ['Nome da Cozinha', 'nome'],
  ['Endereço da Cozinha', 'endereco'],
  ['Bairro da Cozinha', 'bairro'],
  ['CEP', 'cep'],
  ['Município da Cozinha', 'municipio'],
  ['Código IBGE', 'codigoIbge'],
  ['UF', 'uf'],
  ['Email', 'email'],
  ['CNPJ', 'cnpj'],
  ['A cozinha está em funcionamento atualmente?', 'emFuncionamento'],
  [
    'Em quantos dias da semana a Cozinha Solidária funciona?',
    'diasFuncionamento',
  ],
  ['Situação', 'situacao'],
  ['Público Atendido', 'publicoAtendido'],
  ['Público Total Atendido', 'publicoTotalAtendido'],
  ['Quantidade refeições produzidas por dia de trabalho', 'refeicoesPorDia'],
  ['Latitude', 'latitude'],
  ['Longitude', 'longitude'],
] as const satisfies ReadonlyArray<
  readonly [string, keyof StaticCozinhaSource]
>;

/** Keys coerced to `number | null`. */
const NUMERIC_KEYS = new Set<keyof StaticCozinhaSource>([
  'latitude',
  'longitude',
]);

/** Values that represent "missing" in the source spreadsheet. */
const isBlank = (value: string): boolean => {
  return value === '' || value === '---';
};

/** Mutable cursor threaded through {@link parseCsv} as it scans the text. */
type CsvParseState = {
  rows: string[][];
  row: string[];
  field: string;
  inQuotes: boolean;
};

/**
 * Consumes one character. Returns `true` when it also consumed the next
 * character (an escaped `""`), so the caller advances the index by an extra
 * step.
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
  } else if (char === ',') {
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
 * Parses RFC 4180 CSV text into an array of string-cell rows. Handles quoted
 * fields with embedded commas, newlines and escaped (doubled) double-quotes.
 */
const parseCsv = (text: string): string[][] => {
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

  // Flush the trailing field/row when the file does not end with a newline.
  if (state.field !== '' || state.row.length > 0) {
    state.row.push(state.field);
    state.rows.push(state.row);
  }

  return state.rows;
};

const toRecord = (cells: string[]): StaticCozinhaSource => {
  const record = {} as Record<
    keyof StaticCozinhaSource,
    string | number | null
  >;

  for (const [index, [, key]] of COLUMNS.entries()) {
    const value = (cells[index] ?? '').trim();

    if (NUMERIC_KEYS.has(key)) {
      const parsed = Number(value);
      record[key] = isBlank(value) || Number.isNaN(parsed) ? null : parsed;
    } else {
      record[key] = isBlank(value) ? '' : value;
    }
  }

  return record as StaticCozinhaSource;
};

/**
 * Parses and validates the raw "cozinhas solidárias" CSV text into typed
 * records. Pure (no I/O): the disk read lives in {@link readStaticCozinhas}.
 *
 * @param text - Raw CSV text (a leading UTF-8 BOM is tolerated and stripped).
 * @returns The list of parsed cozinha records.
 * @throws If the CSV is empty or its header does not match the expected columns.
 */
export const parseCozinhasCsv = (text: string): StaticCozinhaSource[] => {
  // Strip the UTF-8 BOM so the first header matches exactly.
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows = parseCsv(clean);

  if (rows.length === 0) {
    throw new Error('[data-source-static] cozinhas CSV is empty.');
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

  return (
    dataRows
      // Drop fully empty trailing lines.
      .filter((cells) => {
        return cells.some((cell) => {
          return cell.trim() !== '';
        });
      })
      .map(toRecord)
  );
};

const cache = new Map<CozinhaYear, StaticCozinhaSource[]>();

/**
 * Reads, parses and validates a static "cozinhas solidárias" CSV snapshot for a
 * given year.
 *
 * Server-only: it reads the CSV from disk with `fs`, so it must be called from
 * a Server Component, route handler or other server context. Each year's parsed
 * result is memoized for the lifetime of the process.
 *
 * @param options.year - Snapshot year to read; one of {@link COZINHAS_YEARS}.
 *   Defaults to {@link LATEST_COZINHA_YEAR}.
 * @returns The list of cozinha records for that year.
 * @throws If the CSV header does not match the expected columns.
 *
 * @example
 * const cozinhas = await readStaticCozinhas({ year: 2024 });
 * const comCoordenadas = cozinhas.filter((c) => c.latitude !== null);
 */
export const readStaticCozinhas = async (
  options: { year?: CozinhaYear } = {}
): Promise<StaticCozinhaSource[]> => {
  const year = options.year ?? LATEST_COZINHA_YEAR;

  const cached = cache.get(year);
  if (cached) {
    return cached;
  }

  const raw = await readFile(dataPath(YEAR_TO_FILE[year]), 'utf8');
  const parsed = parseCozinhasCsv(raw);
  cache.set(year, parsed);

  return parsed;
};
