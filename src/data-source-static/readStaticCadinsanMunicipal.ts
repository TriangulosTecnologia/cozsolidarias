import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { StaticCadinsanMunicipioSource } from './types';

const CSV_PATH = join(
  process.cwd(),
  'src',
  'data-source-static',
  'data',
  'CADINSAN_2025_dados_municipais.csv'
);

/** Source column header holding the 7-digit IBGE municipality code. */
const CODE_COLUMN = 'Cod_IBGE';
/** Source column header holding the macro-region. */
const REGION_COLUMN = 'Região';
/** Source column header holding the state (UF). */
const UF_COLUMN = 'UF';
/** Source column header holding the município name. */
const NAME_COLUMN = 'Município';
/** Source column header holding the food-insecurity headcount including PBF. */
const COM_PBF_COLUMN = 'Cadinsan_absoluto_com_PBF';
/** Source column header holding the food-insecurity headcount excluding PBF. */
const SEM_PBF_COLUMN = 'Cadinsan_absoluto_sem_PBF';
/** Source column header holding the total CadÚnico registrations (denominator). */
const CADUNICO_COLUMN = 'Cadastros_Cadunico';

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
 * fields (the proportion columns carry commas, e.g. `"18,7%"`), newlines and
 * escaped (doubled) double-quotes.
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

  if (state.field !== '' || state.row.length > 0) {
    state.row.push(state.field);
    state.rows.push(state.row);
  }

  return state.rows;
};

/** Locates a column by exact header name; throws when it is absent. */
const columnIndex = (header: string[], name: string): number => {
  const index = header.indexOf(name);
  if (index === -1) {
    throw new Error(
      `[data-source-static] CADINSAN CSV is missing the "${name}" column.`
    );
  }
  return index;
};

/**
 * Parses and validates the raw CADINSAN 2025 municipal CSV into typed records.
 * Pure (no I/O): the disk read lives in {@link readStaticCadinsanMunicipal}.
 * Columns are located by header name (not position), so the reader survives
 * column reordering. Only the count columns are read; the source's own
 * proportion columns are ignored (the gateway recomputes the share).
 *
 * @param text - Raw CSV text (a leading UTF-8 BOM is tolerated and stripped).
 * @returns One record per município row, in file order.
 * @throws If the CSV is empty, a required column is missing, or any count cell
 * (`Cadinsan_absoluto_com_PBF`, `Cadinsan_absoluto_sem_PBF`,
 * `Cadastros_Cadunico`) is not a finite number.
 *
 * @example
 * parseCadinsanMunicipal(
 *   'Cod_IBGE,Região,UF,Município,Cadinsan_absoluto_com_PBF,Cadinsan_absoluto_sem_PBF,Cadastros_Cadunico,Cadinsan_proporcional_com_PBF,Cadinsan_proporcional_sem_PBF\n' +
 *     '3304557,Sudeste,Rio de Janeiro,Rio de Janeiro,97708,144648,521373,"18,7%","27,7%"'
 * );
 * // [{ codigoIbge: '3304557', regiao: 'Sudeste', uf: 'Rio de Janeiro',
 * //    municipio: 'Rio de Janeiro', absolutoComPbf: 97708, absolutoSemPbf: 144648,
 * //    cadastrosCadunico: 521373 }]
 */
export const parseCadinsanMunicipal = (
  text: string
): StaticCadinsanMunicipioSource[] => {
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows = parseCsv(clean);

  if (rows.length === 0) {
    throw new Error('[data-source-static] CADINSAN CSV is empty.');
  }

  const [header, ...dataRows] = rows;
  const codeIndex = columnIndex(header, CODE_COLUMN);
  const regionIndex = columnIndex(header, REGION_COLUMN);
  const ufIndex = columnIndex(header, UF_COLUMN);
  const nameIndex = columnIndex(header, NAME_COLUMN);
  const comPbfIndex = columnIndex(header, COM_PBF_COLUMN);
  const semPbfIndex = columnIndex(header, SEM_PBF_COLUMN);
  const cadunicoIndex = columnIndex(header, CADUNICO_COLUMN);

  return dataRows
    .filter((cells) => {
      return cells.some((cell) => {
        return cell.trim() !== '';
      });
    })
    .map((cells) => {
      // Reads a cell by index, defaulting to '' for a row shorter than the
      // header. Centralized so the missing-cell branch is exercised once.
      const at = (index: number): string => {
        return (cells[index] ?? '').trim();
      };
      const codigoIbge = at(codeIndex);

      const countCell = (index: number, column: string): number => {
        const raw = at(index);
        const value = Number(raw);
        if (raw === '' || !Number.isFinite(value)) {
          throw new Error(
            `[data-source-static] município ${codigoIbge} has a non-numeric ${column}: "${raw}".`
          );
        }
        return value;
      };

      return {
        codigoIbge,
        regiao: at(regionIndex),
        uf: at(ufIndex),
        municipio: at(nameIndex),
        absolutoComPbf: countCell(comPbfIndex, COM_PBF_COLUMN),
        absolutoSemPbf: countCell(semPbfIndex, SEM_PBF_COLUMN),
        cadastrosCadunico: countCell(cadunicoIndex, CADUNICO_COLUMN),
      };
    });
};

let cache: StaticCadinsanMunicipioSource[] | null = null;

/**
 * Reads, parses and validates the static CADINSAN 2025 municipal snapshot (food
 * insecurity among CadÚnico families, per município — all 5,570 Brazilian
 * municípios).
 *
 * Server-only: it reads the CSV from disk with `fs`, so it must be called from a
 * Server Component, route handler or other server context. The parsed result is
 * memoized for the lifetime of the process.
 *
 * @returns The list of CADINSAN records from
 * `data/CADINSAN_2025_dados_municipais.csv`.
 * @throws If the CSV is malformed (see {@link parseCadinsanMunicipal}).
 *
 * @example
 * const cadinsan = await readStaticCadinsanMunicipal();
 * cadinsan.find((r) => r.codigoIbge === '3304557')?.absolutoSemPbf; // 144648
 */
export const readStaticCadinsanMunicipal = async (): Promise<
  StaticCadinsanMunicipioSource[]
> => {
  if (cache) {
    return cache;
  }

  const raw = await readFile(CSV_PATH, 'utf8');
  cache = parseCadinsanMunicipal(raw);

  return cache;
};
