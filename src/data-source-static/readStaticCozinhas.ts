import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { StaticCozinhaSource } from './types';

const CSV_PATH = join(
  process.cwd(),
  'src',
  'data-source-static',
  'data',
  'cozinhas_com_geolocalizacao_all.csv'
);

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
  ['UF', 'uf'],
  ['Email', 'email'],
  ['Telefone', 'telefone'],
  ['CNPJ', 'cnpj'],
  ['A cozinha está em funcionamento atualmente?', 'emFuncionamento'],
  [
    'Em quantos dias da semana a Cozinha Solidária funciona?',
    'diasFuncionamento',
  ],
  ['Situação', 'situacao'],
  ['Data Envio para Análise', 'dataEnvioAnalise'],
  ['É Reanálise?', 'reanalise'],
  ['Avaliador', 'avaliador'],
  ['Data Avaliação', 'dataAvaliacao'],
  ['Homologador', 'homologador'],
  ['Data Homologação', 'dataHomologacao'],
  ['Público Atendido', 'publicoAtendido'],
  ['Público Total Atendido', 'publicoTotalAtendido'],
  ['Dados da Cozinha atualizados?', 'dadosAtualizados'],
  ['Data da última atualização', 'dataUltimaAtualizacao'],
  ['Fez atualização GEO e Fotos?', 'atualizacaoGeoFotos'],
  ['Link geolocalização', 'linkGeolocalizacao'],
  ['Latitude', 'latitude'],
  ['Longitude', 'longitude'],
  ['Status Foto/Geo', 'statusFotoGeo'],
  ['Endereço Completo', 'enderecoCompleto'],
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

let cache: StaticCozinhaSource[] | null = null;

/**
 * Reads, parses and validates the static "cozinhas solidárias" CSV snapshot.
 *
 * Server-only: it reads the CSV from disk with `fs`, so it must be called from
 * a Server Component, route handler or other server context. The parsed result
 * is memoized for the lifetime of the process.
 *
 * @returns The list of cozinha records from `data/cozinhas_com_geolocalizacao_all.csv`.
 * @throws If the CSV header does not match the expected columns.
 *
 * @example
 * const cozinhas = await readStaticCozinhas();
 * const comCoordenadas = cozinhas.filter((c) => c.latitude !== null);
 */
export const readStaticCozinhas = async (): Promise<StaticCozinhaSource[]> => {
  if (cache) {
    return cache;
  }

  // Strip the UTF-8 BOM so the first header matches exactly.
  const raw = (await readFile(CSV_PATH, 'utf8')).replace(/^\uFEFF/, '');
  const rows = parseCsv(raw);

  if (rows.length === 0) {
    throw new Error(`[data-source-static] cozinhas CSV is empty: ${CSV_PATH}`);
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

  cache = dataRows
    // Drop fully empty trailing lines.
    .filter((cells) => {
      return cells.some((cell) => {
        return cell.trim() !== '';
      });
    })
    .map(toRecord);

  return cache;
};
