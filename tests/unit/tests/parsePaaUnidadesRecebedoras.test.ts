import {
  parsePaaUnidadesRecebedoras,
  readStaticPaaUnidadesRecebedoras,
} from 'src/data-source-static/readStaticPaaUnidadesRecebedoras';

const PREAMBLE = 'CONAB - Companhia Nacional de Abastecimento,,,,,\n,,,,,\n';
const HEADER =
  'ANO,Num TPAF,Cod IBGE Consumidor,Municipio Consumidor,Qtd Total Atendidos,Código da Cozinha';

describe('parsePaaUnidadesRecebedoras', () => {
  test('skips the CONAB preamble and reads one record per receiving unit', () => {
    const text = `${PREAMBLE}${HEADER}\n2025,AC/2025/02/0208,1200401,RIO BRANCO,1.350,CS023192\n,,,,,`;

    expect(parsePaaUnidadesRecebedoras(text)).toEqual([
      {
        tpaf: 'AC/2025/02/0208',
        codigoIbge: '1200401',
        municipio: 'RIO BRANCO',
        codigoCozinha: 'CS023192',
        pessoasAtendidas: 1350,
      },
    ]);
  });

  test('tolerates a BOM and drops short rows that carry no IBGE code', () => {
    const text = `\uFEFF${HEADER}\nx\n2025,T,1200401,RIO BRANCO,10,CS1`;

    expect(parsePaaUnidadesRecebedoras(text)).toHaveLength(1);
  });

  test('throws on a row cut short before its people count', () => {
    expect(() => {
      return parsePaaUnidadesRecebedoras(`${HEADER}\n2025,T,1200401`);
    }).toThrow('invalid Qtd Total Atendidos: ""');
  });

  test('throws when the header row is absent', () => {
    expect(() => {
      return parsePaaUnidadesRecebedoras(PREAMBLE);
    }).toThrow('has no "ANO" header row');
  });

  test('throws when a required column is missing', () => {
    expect(() => {
      return parsePaaUnidadesRecebedoras('ANO,Num TPAF\n2025,T');
    }).toThrow('missing the "Cod IBGE Consumidor" column');
  });

  test('throws on a people count that is not a whole number', () => {
    expect(() => {
      return parsePaaUnidadesRecebedoras(
        `${HEADER}\n2025,T,1200401,RIO BRANCO,,CS1`
      );
    }).toThrow('invalid Qtd Total Atendidos: ""');
  });
});

describe('readStaticPaaUnidadesRecebedoras', () => {
  test('reads the real CONAB snapshot: 1.116 rows across 152 municípios', async () => {
    const unidades = await readStaticPaaUnidadesRecebedoras();

    expect(unidades).toHaveLength(1116);
    expect(await readStaticPaaUnidadesRecebedoras()).toBe(unidades);
    expect(
      new Set(
        unidades.map((unidade) => {
          return unidade.codigoIbge;
        })
      ).size
    ).toBe(152);
  });
});
