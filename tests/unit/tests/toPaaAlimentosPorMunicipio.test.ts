import { toPaaAlimentosPorMunicipio } from 'src/data-gateway/transformers/toPaaAlimentosPorMunicipio';
import type { StaticPaaProdutoSource } from 'src/data-source-static/types';

const row = (
  overrides: Partial<StaticPaaProdutoSource>
): StaticPaaProdutoSource => {
  return {
    tpaf: 'T1',
    codigoIbge: '1200807',
    municipio: 'PORTO ACRE',
    cnpjProponente: 'A',
    produto: 'ABOBORA',
    quantidadeKg: 0,
    ...overrides,
  };
};

describe('toPaaAlimentosPorMunicipio', () => {
  test('sums kg per IBGE code, derives the share of Brazil and counts distinct products and suppliers', () => {
    expect(
      toPaaAlimentosPorMunicipio([
        row({ produto: 'ABOBORA', quantidadeKg: 1000 }),
        row({ produto: 'COUVE', quantidadeKg: 500 }),
        row({ produto: 'COUVE', cnpjProponente: 'B', quantidadeKg: 1500 }),
        row({
          codigoIbge: '1200104',
          municipio: 'BRASILÉIA',
          quantidadeKg: 1000,
        }),
      ])
    ).toEqual([
      {
        codigoIbge: '1200807',
        municipio: 'PORTO ACRE',
        quantidadeKg: 3000,
        percentualDoBrasil: 75,
        produtos: 2,
        fornecedores: 2,
      },
      {
        codigoIbge: '1200104',
        municipio: 'BRASILÉIA',
        quantidadeKg: 1000,
        percentualDoBrasil: 25,
        produtos: 1,
        fornecedores: 1,
      },
    ]);
  });

  test('keeps homonym municípios apart: it groups by IBGE code, never by name', () => {
    const rows = toPaaAlimentosPorMunicipio([
      row({ codigoIbge: '4104808', municipio: 'CASCAVEL', quantidadeKg: 1 }),
      row({ codigoIbge: '2303501', municipio: 'CASCAVEL', quantidadeKg: 1 }),
    ]);

    expect(rows).toHaveLength(2);
  });
});
