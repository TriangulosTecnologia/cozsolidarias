import type {
  StaticPaaProdutoSource,
  StaticPaaUnidadeRecebedoraSource,
} from '../../data-source-static/types';
import type { PaaKgPorPessoaByCity } from '../schema';

/** Sums `value` per proposal (TPAF). */
const sumPorProposta = <T extends { tpaf: string }>(
  rows: T[],
  value: (row: T) => number
): Map<string, number> => {
  const sums = new Map<string, number>();
  for (const row of rows) {
    sums.set(row.tpaf, (sums.get(row.tpaf) ?? 0) + value(row));
  }
  return sums;
};

/**
 * Each proposal's kg per person, uniform across its cozinhas. A proposal whose
 * units declare no one has nothing to divide by and gets no entry.
 */
const kgPorPessoaPorProposta = ({
  produtos,
  unidades,
}: {
  produtos: StaticPaaProdutoSource[];
  unidades: StaticPaaUnidadeRecebedoraSource[];
}): Map<string, number> => {
  const kgPorProposta = sumPorProposta(produtos, (produto) => {
    return produto.quantidadeKg;
  });
  const pessoasPorProposta = sumPorProposta(unidades, (unidade) => {
    return unidade.pessoasAtendidas;
  });

  const ratios = new Map<string, number>();
  for (const [tpaf, pessoas] of pessoasPorProposta) {
    if (pessoas > 0) {
      ratios.set(tpaf, (kgPorProposta.get(tpaf) ?? 0) / pessoas);
    }
  }
  return ratios;
};

/** What one município accumulates while the receiving units are walked. */
type MunicipioAcumulado = {
  municipio: string;
  kgPrevistos: number;
  pessoasAtendidas: number;
  cozinhas: Set<string>;
};

/** Projects one município's accumulation into the canonical row. */
const toRow = (
  codigoIbge: string,
  entry: MunicipioAcumulado
): PaaKgPorPessoaByCity => {
  return {
    codigoIbge,
    municipio: entry.municipio,
    kgPrevistos: Math.round(entry.kgPrevistos),
    pessoasAtendidas: entry.pessoasAtendidas,
    cozinhas: entry.cozinhas.size,
    kgPorPessoa:
      entry.pessoasAtendidas > 0
        ? Math.round((entry.kgPrevistos / entry.pessoasAtendidas) * 10) / 10
        : null,
  };
};

/**
 * Derives the planned kg per person served, per cozinha município, by joining
 * the PAA product rows to the receiving units through the proposal (TPAF).
 *
 * Each proposal's kg are split among its cozinhas in proportion to the people
 * each one serves — the proposal's kg-per-person is uniform across its
 * cozinhas — and the shares are summed in each cozinha's município. A proposal
 * with no receiving unit has no one to split among and is left out; one whose
 * units declare 0 people contributes its people (0) but no kg.
 *
 * @param params.produtos - Product rows (`readStaticPaaProdutos`).
 * @param params.unidades - Receiving-unit rows (`readStaticPaaUnidadesRecebedoras`).
 * @returns One {@link PaaKgPorPessoaByCity} per município with ≥1 receiving
 * unit, in first-appearance order.
 *
 * @example
 * toPaaKgPorPessoaPorMunicipio({
 *   produtos: [{ tpaf: 'T1', codigoIbge: '1200807', municipio: 'PORTO ACRE', cnpjProponente: 'A', produto: 'COUVE', quantidadeKg: 900 }],
 *   unidades: [
 *     { tpaf: 'T1', codigoIbge: '1200401', municipio: 'RIO BRANCO', codigoCozinha: 'CS1', pessoasAtendidas: 200 },
 *     { tpaf: 'T1', codigoIbge: '1200104', municipio: 'BRASILÉIA', codigoCozinha: 'CS2', pessoasAtendidas: 100 },
 *   ],
 * });
 * // [{ codigoIbge: '1200401', kgPrevistos: 600, pessoasAtendidas: 200, cozinhas: 1, kgPorPessoa: 3, ... },
 * //  { codigoIbge: '1200104', kgPrevistos: 300, pessoasAtendidas: 100, cozinhas: 1, kgPorPessoa: 3, ... }]
 */
export const toPaaKgPorPessoaPorMunicipio = ({
  produtos,
  unidades,
}: {
  produtos: StaticPaaProdutoSource[];
  unidades: StaticPaaUnidadeRecebedoraSource[];
}): PaaKgPorPessoaByCity[] => {
  const kgPorPessoaDaProposta = kgPorPessoaPorProposta({ produtos, unidades });

  const byCode = new Map<string, MunicipioAcumulado>();

  for (const unidade of unidades) {
    const entry = byCode.get(unidade.codigoIbge) ?? {
      municipio: unidade.municipio,
      kgPrevistos: 0,
      pessoasAtendidas: 0,
      cozinhas: new Set<string>(),
    };
    entry.kgPrevistos +=
      (kgPorPessoaDaProposta.get(unidade.tpaf) ?? 0) * unidade.pessoasAtendidas;
    entry.pessoasAtendidas += unidade.pessoasAtendidas;
    entry.cozinhas.add(unidade.codigoCozinha);
    byCode.set(unidade.codigoIbge, entry);
  }

  return [...byCode].map(([codigoIbge, entry]) => {
    return toRow(codigoIbge, entry);
  });
};
