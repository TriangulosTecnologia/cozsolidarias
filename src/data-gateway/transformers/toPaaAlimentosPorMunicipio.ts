import type { StaticPaaProdutoSource } from '../../data-source-static/types';
import type { PaaAlimentosByCity } from '../schema';

/**
 * Aggregates the CONAB PAA product rows into one row per supplier município:
 * the summed planned quantity (kg) and its share (%) of Brazil's total, plus
 * how many distinct products and supplier organizations (by CNPJ) make it up. Grouped by IBGE code, never by
 * name — homonyms such as Cascavel (PR) and Cascavel (CE) stay apart.
 *
 * @param sources - Product rows from {@link StaticPaaProdutoSource}
 * (`readStaticPaaProdutos`).
 * @returns One {@link PaaAlimentosByCity} per município with ≥1 product row,
 * in first-appearance order.
 *
 * @example
 * toPaaAlimentosPorMunicipio([
 *   { tpaf: 'AC/2025/02/0210', codigoIbge: '1200807', municipio: 'PORTO ACRE', cnpjProponente: 'A', produto: 'ABOBORA', quantidadeKg: 1000 },
 *   { tpaf: 'AC/2025/02/0210', codigoIbge: '1200807', municipio: 'PORTO ACRE', cnpjProponente: 'A', produto: 'COUVE', quantidadeKg: 350 },
 * ]);
 * // [{ codigoIbge: '1200807', municipio: 'PORTO ACRE', quantidadeKg: 1350, percentualDoBrasil: 100, produtos: 2, fornecedores: 1 }]
 */
export const toPaaAlimentosPorMunicipio = (
  sources: StaticPaaProdutoSource[]
): PaaAlimentosByCity[] => {
  const byCode = new Map<
    string,
    {
      municipio: string;
      quantidadeKg: number;
      produtos: Set<string>;
      fornecedores: Set<string>;
    }
  >();

  for (const source of sources) {
    const entry = byCode.get(source.codigoIbge) ?? {
      municipio: source.municipio,
      quantidadeKg: 0,
      produtos: new Set<string>(),
      fornecedores: new Set<string>(),
    };
    entry.quantidadeKg += source.quantidadeKg;
    entry.produtos.add(source.produto);
    entry.fornecedores.add(source.cnpjProponente);
    byCode.set(source.codigoIbge, entry);
  }

  const totalKg = sources.reduce((sum, source) => {
    return sum + source.quantidadeKg;
  }, 0);

  return [...byCode].map(([codigoIbge, entry]) => {
    return {
      codigoIbge,
      municipio: entry.municipio,
      quantidadeKg: entry.quantidadeKg,
      percentualDoBrasil:
        Math.round((entry.quantidadeKg / totalKg) * 100 * 10_000) / 10_000,
      produtos: entry.produtos.size,
      fornecedores: entry.fornecedores.size,
    };
  });
};
