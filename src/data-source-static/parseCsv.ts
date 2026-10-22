/** Mutable cursor threaded through {@link parseCsv} as it scans the text. */
type CsvParseState = {
  rows: string[][];
  row: string[];
  field: string;
  inQuotes: boolean;
};

/**
 * Consumes one character inside a quoted field. Returns `true` when it also
 * consumed the next character (an escaped `""`).
 */
const consumeQuoted = (
  state: CsvParseState,
  char: string,
  nextChar: string | undefined
): boolean => {
  if (char !== '"') {
    state.field += char;
  } else if (nextChar === '"') {
    state.field += '"';
    return true;
  } else {
    state.inQuotes = false;
  }
  return false;
};

/** Consumes one character outside a quoted field. */
const consumeUnquoted = (state: CsvParseState, char: string): void => {
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
    return consumeQuoted(state, char, nextChar);
  }
  consumeUnquoted(state, char);
  return false;
};

/**
 * Parses RFC 4180 CSV text into an array of string-cell rows. Handles quoted
 * fields with embedded commas (e.g. `"R$ 15.000,00"`), newlines and escaped
 * (doubled) double-quotes; `\r` is dropped, so CRLF files parse like LF ones.
 *
 * @param text - Raw CSV text. A leading BOM is not stripped here.
 * @returns Every row, in file order, as raw (untrimmed) cells.
 *
 * @example
 * parseCsv('a,"b,c"\n1,2\n'); // [['a', 'b,c'], ['1', '2']]
 */
export const parseCsv = (text: string): string[][] => {
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
