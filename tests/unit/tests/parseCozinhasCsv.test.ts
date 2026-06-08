import { parseCozinhasCsv } from 'src/data-source-static/readStaticCozinhas';

/**
 * The 29 CSV headers, in order, exactly as `readStaticCozinhas` expects them.
 * Kept here (not imported) so the test fails loudly if the source columns drift.
 */
const HEADERS = [
  'Código da Cozinha',
  'Nome da Cozinha',
  'Endereço da Cozinha',
  'Bairro da Cozinha',
  'CEP',
  'Município da Cozinha',
  'UF',
  'Email',
  'Telefone',
  'CNPJ',
  'A cozinha está em funcionamento atualmente?',
  'Em quantos dias da semana a Cozinha Solidária funciona?',
  'Situação',
  'Data Envio para Análise',
  'É Reanálise?',
  'Avaliador',
  'Data Avaliação',
  'Homologador',
  'Data Homologação',
  'Público Atendido',
  'Público Total Atendido',
  'Dados da Cozinha atualizados?',
  'Data da última atualização',
  'Fez atualização GEO e Fotos?',
  'Link geolocalização',
  'Latitude',
  'Longitude',
  'Status Foto/Geo',
  'Endereço Completo',
];

/** Column indices we assert against. */
const COL = {
  codigo: 0,
  nome: 1,
  endereco: 2,
  municipio: 5,
  latitude: 25,
  longitude: 26,
} as const;

const HEADER_LINE = HEADERS.join(',');

/** Builds a 29-cell row, with the given (already CSV-valid) cells overridden. */
const rawRow = (overrides: Record<number, string> = {}): string[] => {
  const cells = Array.from({ length: HEADERS.length }, () => {
    return '';
  });
  for (const [index, value] of Object.entries(overrides)) {
    cells[Number(index)] = value;
  }
  return cells;
};

/** Joins cells verbatim (caller supplies any needed quoting). */
const line = (cells: string[]): string => {
  return cells.join(',');
};

/** Assembles full CSV text: header line + the given data lines, `\n`-joined. */
const csv = (...lines: string[]): string => {
  return [HEADER_LINE, ...lines].join('\n');
};

describe('parseCozinhasCsv', () => {
  test('parses a single data row into a typed record', () => {
    const text = csv(
      line(
        rawRow({
          [COL.codigo]: 'C1',
          [COL.nome]: 'Kitchen One',
          [COL.municipio]: 'São Paulo',
          [COL.latitude]: '-23.55',
          [COL.longitude]: '-46.63',
        })
      )
    );

    const records = parseCozinhasCsv(text);

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      codigo: 'C1',
      nome: 'Kitchen One',
      municipio: 'São Paulo',
      latitude: -23.55,
      longitude: -46.63,
    });
    expect(typeof records[0].latitude).toBe('number');
  });

  test('keeps commas inside a quoted field', () => {
    const text = csv(
      line(rawRow({ [COL.endereco]: '"Street A, 123, room 4"' }))
    );

    const [record] = parseCozinhasCsv(text);

    expect(record.endereco).toBe('Street A, 123, room 4');
  });

  test('unescapes doubled double-quotes inside a quoted field', () => {
    const text = csv(line(rawRow({ [COL.nome]: '"ACME ""Foods"" Ltda"' })));

    const [record] = parseCozinhasCsv(text);

    expect(record.nome).toBe('ACME "Foods" Ltda');
  });

  test('keeps newlines inside a quoted field without splitting the row', () => {
    const text = csv(line(rawRow({ [COL.endereco]: '"Line 1\nLine 2"' })));

    const records = parseCozinhasCsv(text);

    expect(records).toHaveLength(1);
    expect(records[0].endereco).toBe('Line 1\nLine 2');
  });

  test('handles CRLF line endings', () => {
    const text = [
      HEADER_LINE,
      line(rawRow({ [COL.codigo]: 'C1', [COL.municipio]: 'Santos' })),
    ].join('\r\n');

    const records = parseCozinhasCsv(text);

    expect(records).toHaveLength(1);
    expect(records[0].municipio).toBe('Santos');
  });

  test('coerces blank, "---" and non-numeric coordinates to null', () => {
    // Each row carries a code so none is dropped as a fully-empty line.
    const text = csv(
      line(
        rawRow({
          [COL.codigo]: 'A',
          [COL.latitude]: '-23.5',
          [COL.longitude]: '-46.6',
        })
      ),
      line(
        rawRow({
          [COL.codigo]: 'B',
          [COL.latitude]: '---',
          [COL.longitude]: '---',
        })
      ),
      line(
        rawRow({ [COL.codigo]: 'C', [COL.latitude]: '', [COL.longitude]: '' })
      ),
      line(
        rawRow({
          [COL.codigo]: 'D',
          [COL.latitude]: 'abc',
          [COL.longitude]: 'xyz',
        })
      )
    );

    const records = parseCozinhasCsv(text);

    expect(records[0].latitude).toBe(-23.5);
    expect(records[1].latitude).toBeNull();
    expect(records[2].latitude).toBeNull();
    expect(records[3].latitude).toBeNull();
    expect(records[3].longitude).toBeNull();
  });

  test('normalizes "---" in a non-numeric field to an empty string', () => {
    const text = csv(line(rawRow({ [COL.municipio]: '---' })));

    const [record] = parseCozinhasCsv(text);

    expect(record.municipio).toBe('');
  });

  test('drops fully empty trailing lines', () => {
    const text = `${csv(line(rawRow({ [COL.codigo]: 'C1' })))}\n\n`;

    const records = parseCozinhasCsv(text);

    expect(records).toHaveLength(1);
  });

  test('strips a leading UTF-8 BOM from the header', () => {
    const text = `${String.fromCharCode(0xfeff)}${csv(line(rawRow({ [COL.codigo]: 'C1' })))}`;

    const records = parseCozinhasCsv(text);

    expect(records).toHaveLength(1);
    expect(records[0].codigo).toBe('C1');
  });

  test('throws when the column count does not match', () => {
    expect(() => {
      return parseCozinhasCsv('a,b,c\n1,2,3');
    }).toThrow(/columns/);
  });

  test('throws when a header name does not match', () => {
    const wrongHeader = ['WRONG', ...HEADERS.slice(1)].join(',');

    expect(() => {
      return parseCozinhasCsv(wrongHeader);
    }).toThrow(/column 0 mismatch/);
  });

  test('throws when the CSV is empty', () => {
    expect(() => {
      return parseCozinhasCsv('');
    }).toThrow(/empty/);
  });
});
