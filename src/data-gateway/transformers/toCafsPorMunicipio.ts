import type { StaticCafPorMunicipioSource } from '../../data-source-static/types';
import type { cafByCity } from '../schema';

/**
 * Share (%) of all Brazilian CAFs counted in a single município:
 * `(quantidade / total) * 100`, rounded to six decimals.
 *
 * Unlike the cozinha share (two decimals), CAF shares are tiny — the median
 * município sits at ≈ 0.0085% and one CAF is ≈ 0.000025% — so two decimals would
 * collapse most municípios to `0.00%`, which the choropleth would then paint as
 * the grey "sem CAF" fill. Six decimals keeps every município with ≥1 CAF above
 * the scale's floor and preserves the ordering the color bands read.
 *
 * @param params.quantidade - Distinct-CAF count in the município (≥ 0).
 * @param params.total - National total (sum of `quantidade` across every
 * município).
 * @returns The rounded share, or `0` when `total` is non-positive (no CAFs to
 * take a share of).
 *
 * @example
 * cafsPercentualDoBrasil({ quantidade: 3910, total: 3910434 }); // 0.099989
 * cafsPercentualDoBrasil({ quantidade: 2, total: 0 }); // 0
 */
export const cafsPercentualDoBrasil = ({
  quantidade,
  total,
}: {
  quantidade: number;
  total: number;
}): number => {
  if (total <= 0) {
    return 0;
  }

  return Math.round((quantidade / total) * 100 * 1_000_000) / 1_000_000;
};

/**
 * Projects the pre-aggregated CAF-per-município snapshot into the canonical
 * contract, deriving each município's share (%) of Brazil's CAFs. The national
 * total (the share denominator) is the sum of the snapshot's counts, so the
 * shares add up to 100% of what the choropleth paints.
 *
 * The heavy aggregation (parsing the ~4.2M-row `caf-area.csv` and deduplicating
 * CAFs per município) is done offline by `scripts/generateCafPorMunicipio.ts`;
 * this transformer only does the cheap projection over the ~5.5k-row snapshot.
 *
 * @param sources - Per-município CAF counts from
 * {@link StaticCafPorMunicipioSource} (`readStaticCafsPorMunicipio`).
 * @returns One {@link cafByCity} per município in the snapshot.
 *
 * @example
 * toCafsPorMunicipio([{ cdMunicipio: '3550308', nmMunicipio: 'São Paulo', quantidade: 42 }]);
 * // [{ codigoIbge: '3550308', municipio: 'São Paulo', quantidade: 42, percentualDoBrasil: ... }]
 */
export const toCafsPorMunicipio = (
  sources: StaticCafPorMunicipioSource[]
): cafByCity[] => {
  const total = sources.reduce((sum, { quantidade }) => {
    return sum + quantidade;
  }, 0);

  return sources.map(({ cdMunicipio, nmMunicipio, quantidade }) => {
    return {
      codigoIbge: cdMunicipio,
      municipio: nmMunicipio,
      quantidade,
      percentualDoBrasil: cafsPercentualDoBrasil({ quantidade, total }),
    };
  });
};
