import { toPaaKgPorPessoaPorMunicipio } from 'src/data-gateway/transformers/toPaaKgPorPessoaPorMunicipio';
import type {
  StaticPaaProdutoSource,
  StaticPaaUnidadeRecebedoraSource,
} from 'src/data-source-static/types';

const produto = (
  overrides: Partial<StaticPaaProdutoSource>
): StaticPaaProdutoSource => {
  return {
    tpaf: 'T1',
    codigoIbge: '1200807',
    municipio: 'PORTO ACRE',
    cnpjProponente: 'A',
    produto: 'COUVE',
    quantidadeKg: 0,
    ...overrides,
  };
};

const unidade = (
  overrides: Partial<StaticPaaUnidadeRecebedoraSource>
): StaticPaaUnidadeRecebedoraSource => {
  return {
    tpaf: 'T1',
    codigoIbge: '1200401',
    municipio: 'RIO BRANCO',
    codigoCozinha: 'CS1',
    pessoasAtendidas: 0,
    ...overrides,
  };
};

describe('toPaaKgPorPessoaPorMunicipio', () => {
  test("splits a proposal's kg among its cozinhas by people served, counted where the cozinhas are", () => {
    const rows = toPaaKgPorPessoaPorMunicipio({
      // The supplier sits in Porto Acre, but the food is counted where it is eaten.
      produtos: [
        produto({ quantidadeKg: 600 }),
        produto({ quantidadeKg: 300 }),
      ],
      unidades: [
        unidade({ pessoasAtendidas: 200 }),
        unidade({
          codigoIbge: '1200104',
          municipio: 'BRASILÉIA',
          codigoCozinha: 'CS2',
          pessoasAtendidas: 100,
        }),
      ],
    });

    expect(rows).toEqual([
      {
        codigoIbge: '1200401',
        municipio: 'RIO BRANCO',
        kgPrevistos: 600,
        pessoasAtendidas: 200,
        cozinhas: 1,
        kgPorPessoa: 3,
      },
      {
        codigoIbge: '1200104',
        municipio: 'BRASILÉIA',
        kgPrevistos: 300,
        pessoasAtendidas: 100,
        cozinhas: 1,
        kgPorPessoa: 3,
      },
    ]);
  });

  test('sums several proposals in one município and counts a cozinha once', () => {
    const [rioBranco] = toPaaKgPorPessoaPorMunicipio({
      produtos: [
        produto({ tpaf: 'T1', quantidadeKg: 1000 }),
        produto({ tpaf: 'T2', quantidadeKg: 500 }),
      ],
      unidades: [
        unidade({ tpaf: 'T1', pessoasAtendidas: 100 }),
        unidade({ tpaf: 'T2', pessoasAtendidas: 50 }),
      ],
    });

    expect(rioBranco).toMatchObject({
      kgPrevistos: 1500,
      pessoasAtendidas: 150,
      cozinhas: 1,
      kgPorPessoa: 10,
    });
  });

  test('leaves out proposals with no receiving cozinha', () => {
    const rows = toPaaKgPorPessoaPorMunicipio({
      produtos: [
        produto({ tpaf: 'T1', quantidadeKg: 100 }),
        produto({ tpaf: 'SEM-COZINHA', quantidadeKg: 9999 }),
      ],
      unidades: [unidade({ tpaf: 'T1', pessoasAtendidas: 10 })],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].kgPrevistos).toBe(100);
  });

  test('allocates 0 kg to a proposal listed with cozinhas but no products', () => {
    const [row] = toPaaKgPorPessoaPorMunicipio({
      produtos: [],
      unidades: [unidade({ tpaf: 'SEM-PRODUTO', pessoasAtendidas: 10 })],
    });

    expect(row).toMatchObject({ kgPrevistos: 0, kgPorPessoa: 0 });
  });

  test('gives null, not 0, when no one is declared served', () => {
    const [row] = toPaaKgPorPessoaPorMunicipio({
      produtos: [produto({ quantidadeKg: 100 })],
      unidades: [unidade({ pessoasAtendidas: 0 })],
    });

    expect(row.kgPrevistos).toBe(0);
    expect(row.kgPorPessoa).toBeNull();
  });
});
