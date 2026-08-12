import {
  parseCadinsanMunicipal,
  readStaticCadinsanMunicipal,
} from 'src/data-source-static/readStaticCadinsanMunicipal';

const HEADER =
  'Cod_IBGE,Região,UF,Município,Cadinsan_absoluto_com_PBF,Cadinsan_absoluto_sem_PBF,Cadastros_Cadunico,Cadinsan_proporcional_com_PBF,Cadinsan_proporcional_sem_PBF';

describe('parseCadinsanMunicipal', () => {
  test('parses a valid row, reading the counts and ignoring the % columns', () => {
    const text = `${HEADER}\n1500602,Norte,Pará,Altamira,2616,5779,14656,"17,8%","39,4%"`;

    expect(parseCadinsanMunicipal(text)).toEqual([
      {
        codigoIbge: '1500602',
        regiao: 'Norte',
        uf: 'Pará',
        municipio: 'Altamira',
        absolutoComPbf: 2616,
        absolutoSemPbf: 5779,
        cadastrosCadunico: 14656,
      },
    ]);
  });

  test('keeps columns aligned despite quoted commas in the % fields', () => {
    // `"18,7%"` must be one field — a naive comma split would shift the counts.
    const text = `${HEADER}\n3304557,Sudeste,Rio de Janeiro,Rio de Janeiro,97708,144648,521373,"18,7%","27,7%"`;
    const [row] = parseCadinsanMunicipal(text);

    expect(row.absolutoSemPbf).toBe(144648);
    expect(row.cadastrosCadunico).toBe(521373);
  });

  test('unescapes a doubled double-quote inside a quoted field', () => {
    const text = `${HEADER}\n1500602,Norte,Pará,"Alta""mira",2616,5779,14656,"17,8%","39,4%"`;

    expect(parseCadinsanMunicipal(text)[0].municipio).toBe('Alta"mira');
  });

  test('handles CRLF line endings', () => {
    const text = `${HEADER}\r\n1500602,Norte,Pará,Altamira,2616,5779,14656,"17,8%","39,4%"\r\n`;
    const rows = parseCadinsanMunicipal(text);

    expect(rows).toHaveLength(1);
    expect(rows[0].municipio).toBe('Altamira');
  });

  test('a row shorter than the header defaults its string cells and throws on the empty count', () => {
    // Only the code cell present: the string columns default via `at`, then the
    // absent count column throws.
    expect(() => {
      return parseCadinsanMunicipal(`${HEADER}\n1500602`);
    }).toThrow(/non-numeric Cadinsan_absoluto_com_PBF/);
  });

  test('strips a leading UTF-8 BOM so the first header matches', () => {
    const text = `\uFEFF${HEADER}\n1,R,U,M,0,0,10,"0,0%","0,0%"`;

    expect(parseCadinsanMunicipal(text)[0].codigoIbge).toBe('1');
  });

  test('keeps a município with zero counts (0% is a real value, not "sem dado")', () => {
    const text = `${HEADER}\n4318051,Sul,Rio Grande do Sul,São Domingos do Sul,0,0,132,"0,0%","0,0%"`;

    expect(parseCadinsanMunicipal(text)[0]).toMatchObject({
      absolutoComPbf: 0,
      absolutoSemPbf: 0,
      cadastrosCadunico: 132,
    });
  });

  test('skips fully-blank lines', () => {
    const text = `${HEADER}\n\n1500602,Norte,Pará,Altamira,2616,5779,14656,"17,8%","39,4%"\n`;

    expect(parseCadinsanMunicipal(text)).toHaveLength(1);
  });

  test('throws when a required column is missing', () => {
    const text = 'Cod_IBGE,Região,UF,Município\n1,R,U,M';

    expect(() => {
      return parseCadinsanMunicipal(text);
    }).toThrow(/missing the "Cadinsan_absoluto_com_PBF" column/);
  });

  test('throws on a non-numeric count cell', () => {
    const text = `${HEADER}\n1500602,Norte,Pará,Altamira,x,5779,14656,"17,8%","39,4%"`;

    expect(() => {
      return parseCadinsanMunicipal(text);
    }).toThrow(/non-numeric Cadinsan_absoluto_com_PBF/);
  });

  test('throws when the CSV is empty', () => {
    expect(() => {
      return parseCadinsanMunicipal('');
    }).toThrow(/CADINSAN CSV is empty/);
  });
});

describe('readStaticCadinsanMunicipal', () => {
  test('reads the real snapshot (all municípios) and memoizes across calls', async () => {
    const first = await readStaticCadinsanMunicipal();

    expect(Array.isArray(first)).toBe(true);
    expect(first.length).toBeGreaterThan(5000);
    expect(typeof first[0].codigoIbge).toBe('string');
    expect(typeof first[0].cadastrosCadunico).toBe('number');

    // Second call returns the same cached array (memoized for the process).
    const second = await readStaticCadinsanMunicipal();
    expect(second).toBe(first);
  });
});
