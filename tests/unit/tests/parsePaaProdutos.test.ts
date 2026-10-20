import {
  parsePaaProdutos,
  readStaticPaaProdutos,
} from 'src/data-source-static/readStaticPaaProdutos';

const PREAMBLE = 'CONAB - Companhia Nacional de Abastecimento,,,,,,\n,,,,,,\n';
const HEADER =
  'ANO ORÇAMENTO,TPAF,IBGE,MUNICÍPIO,CNPJ PROPONENTE,PRODUTO,QUANTIDADE (KG)';

describe('parsePaaProdutos', () => {
  test('skips the CONAB preamble and the grand-total footer, reading pt-BR quantities', () => {
    const text = `${PREAMBLE}${HEADER}\n2025,AC/2025/02/0208,1200104,BRASILÉIA,09.197.432/0001-09,FEIJAO,1.250\n,,,,,,"R$ 119.207.476,14"`;

    expect(parsePaaProdutos(text)).toEqual([
      {
        tpaf: 'AC/2025/02/0208',
        codigoIbge: '1200104',
        municipio: 'BRASILÉIA',
        cnpjProponente: '09.197.432/0001-09',
        produto: 'FEIJAO',
        quantidadeKg: 1250,
      },
    ]);
  });

  test('tolerates a BOM and drops short rows that carry no IBGE code', () => {
    const text = `\uFEFF${HEADER}\nx\n2025,T,1200104,B,C,FEIJAO,10`;

    expect(parsePaaProdutos(text)).toHaveLength(1);
  });

  test('throws on a row cut short before its quantity', () => {
    expect(() => {
      return parsePaaProdutos(`${HEADER}\n2025,T,1200104`);
    }).toThrow('non-numeric QUANTIDADE (KG): ""');
  });

  test('throws when the header row is absent', () => {
    expect(() => {
      return parsePaaProdutos(PREAMBLE);
    }).toThrow('has no "ANO ORÇAMENTO" header row');
  });

  test('throws when a required column is missing', () => {
    expect(() => {
      return parsePaaProdutos('ANO ORÇAMENTO,TPAF,IBGE\n2025,T,1');
    }).toThrow('missing the "MUNICÍPIO" column');
  });

  test('throws on a non-numeric quantity instead of reading it as 0', () => {
    expect(() => {
      return parsePaaProdutos(`${HEADER}\n2025,T,1200104,B,C,FEIJAO,abc`);
    }).toThrow('non-numeric QUANTIDADE (KG): "abc"');
  });
});

describe('readStaticPaaProdutos', () => {
  test('reads the real CONAB snapshot: 1.995 rows across 197 municípios', async () => {
    const produtos = await readStaticPaaProdutos();

    expect(produtos).toHaveLength(1995);
    // Memoized: a second read returns the same parsed array.
    expect(await readStaticPaaProdutos()).toBe(produtos);
    expect(
      new Set(
        produtos.map((produto) => {
          return produto.codigoIbge;
        })
      ).size
    ).toBe(197);
  });
});
