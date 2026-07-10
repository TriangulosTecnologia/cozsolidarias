import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Source-native row of the Atlas da Vulnerabilidade Social (IVS) snapshot: one
 * município with its overall IVS score. Mirrors the three columns this reader
 * pulls from the 103-column raw file, with no interpretation beyond decimal
 * normalization and numeric coercion of `ivs`.
 */
export type StaticIvsSource = {
  /** 7-digit IBGE code (source column `municipio`); joins to `codarea` on the map. */
  codigoIbge: string;
  /** Município display name with UF (source column `nome_municipio_uf`), e.g. `Brasília (DF)`. */
  municipio: string;
  /** Overall Social Vulnerability Index, 0–1 (source column `ivs`); higher = more vulnerable. */
  ivs: number;
  /** IVS Infraestrutura Urbana sub-index, 0–1 (source column `ivs_infraestrutura_urbana`). */
  ivsInfraestruturaUrbana: number;
  /** IVS Capital Humano sub-index, 0–1 (source column `ivs_capital_humano`). */
  ivsCapitalHumano: number;
  /** IVS Renda e Trabalho sub-index, 0–1 (source column `ivs_renda_e_trabalho`). */
  ivsRendaETrabalho: number;
};

const CSV_PATH = join(
  process.cwd(),
  'src',
  'data-source-static',
  'data',
  'atlasivs_municipios_2010.csv'
);

/** Source column header holding the 7-digit IBGE municipality code. */
const CODE_COLUMN = 'municipio';
/** Source column header holding the município display name (with UF). */
const NAME_COLUMN = 'nome_municipio_uf';
/** Source column header holding the overall IVS score. */
const IVS_COLUMN = 'ivs';
/** Source column header holding the IVS Infraestrutura Urbana sub-index. */
const IVS_INFRA_COLUMN = 'ivs_infraestrutura_urbana';
/** Source column header holding the IVS Capital Humano sub-index. */
const IVS_CAPITAL_COLUMN = 'ivs_capital_humano';
/** Source column header holding the IVS Renda e Trabalho sub-index. */
const IVS_RENDA_COLUMN = 'ivs_renda_e_trabalho';

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
 * fields with embedded commas (the `nivel` column carries commas), newlines and
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

  // Flush the trailing field/row when the file does not end with a newline.
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
      `[data-source-static] IVS CSV is missing the "${name}" column.`
    );
  }
  return index;
};

/**
 * Parses and validates the raw Atlas IVS CSV text into typed records. Pure (no
 * I/O): the disk read lives in {@link readStaticIvs}. Columns are located by
 * header name (not position), so the reader survives the extra columns in the
 * full raw file.
 *
 * @param text - Raw CSV text (a leading UTF-8 BOM is tolerated and stripped).
 * @returns One record per município row, in file order.
 * @throws If the CSV is empty, a required column is missing, or any IVS-family
 * cell (`ivs` or a sub-index) is not a finite number.
 *
 * @example
 * parseIvsCsv(
 *   'municipio,nome_municipio_uf,ivs,ivs_infraestrutura_urbana,ivs_capital_humano,ivs_renda_e_trabalho\n' +
 *     '5300108,Brasília (DF),0.294,"0,412","0,265","0,204"'
 * );
 * // [{ codigoIbge: '5300108', municipio: 'Brasília (DF)', ivs: 0.294,
 * //    ivsInfraestruturaUrbana: 0.412, ivsCapitalHumano: 0.265, ivsRendaETrabalho: 0.204 }]
 */
export const parseIvsCsv = (text: string): StaticIvsSource[] => {
  // Strip the UTF-8 BOM so the first header matches exactly.
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows = parseCsv(clean);

  if (rows.length === 0) {
    throw new Error('[data-source-static] IVS CSV is empty.');
  }

  const [header, ...dataRows] = rows;
  const codeIndex = columnIndex(header, CODE_COLUMN);
  const nameIndex = columnIndex(header, NAME_COLUMN);
  const ivsIndex = columnIndex(header, IVS_COLUMN);
  const infraIndex = columnIndex(header, IVS_INFRA_COLUMN);
  const capitalIndex = columnIndex(header, IVS_CAPITAL_COLUMN);
  const rendaIndex = columnIndex(header, IVS_RENDA_COLUMN);

  return dataRows
    .filter((cells) => {
      return cells.some((cell) => {
        return cell.trim() !== '';
      });
    })
    .map((cells) => {
      const codigoIbge = (cells[codeIndex] ?? '').trim();
      const municipio = (cells[nameIndex] ?? '').trim();

      // The raw file mixes decimal separators (dot for `ivs`, comma for the
      // sub-indices); normalize to a dot before coercing so either survives.
      const numericCell = (index: number, column: string): number => {
        const raw = (cells[index] ?? '').trim().replace(/,/g, '.');
        const value = Number(raw);
        if (!Number.isFinite(value)) {
          throw new Error(
            `[data-source-static] município ${codigoIbge} has a non-numeric ${column}: "${cells[index]}".`
          );
        }
        return value;
      };

      return {
        codigoIbge,
        municipio,
        ivs: numericCell(ivsIndex, IVS_COLUMN),
        ivsInfraestruturaUrbana: numericCell(infraIndex, IVS_INFRA_COLUMN),
        ivsCapitalHumano: numericCell(capitalIndex, IVS_CAPITAL_COLUMN),
        ivsRendaETrabalho: numericCell(rendaIndex, IVS_RENDA_COLUMN),
      };
    });
};

let cache: StaticIvsSource[] | null = null;

/**
 * Reads, parses and validates the static Atlas IVS snapshot (IPEA, per
 * município): every one of Brazil's 5,565 municípios, extracted from the 2010
 * raw file (ano 2010, município level, cor/sexo/situação totals).
 *
 * Server-only: it reads the CSV from disk with `fs`, so it must be called from a
 * Server Component, route handler or other server context. The parsed result is
 * memoized for the lifetime of the process.
 *
 * @returns The list of IVS records from `data/atlasivs_municipios_2010.csv`.
 * @throws If the CSV is malformed (see {@link parseIvsCsv}).
 *
 * @example
 * const ivs = await readStaticIvs();
 * ivs[0]; // { codigoIbge: '5300108', municipio: 'Brasília (DF)', ivs: 0.294 }
 */
export const readStaticIvs = async (): Promise<StaticIvsSource[]> => {
  if (cache) {
    return cache;
  }

  const raw = await readFile(CSV_PATH, 'utf8');
  cache = parseIvsCsv(raw);

  return cache;
};
