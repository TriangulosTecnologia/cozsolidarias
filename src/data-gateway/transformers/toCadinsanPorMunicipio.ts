import type { StaticCadinsanMunicipioSource } from '../../data-source-static/types';
import type { cadinsanByCity } from '../schema';

/**
 * Share (%) of a município's CadÚnico families in food insecurity:
 * `(absoluto / cadastrosCadunico) * 100`, rounded to two decimals.
 *
 * Computed from the raw counts rather than parsing the source's own `"18,7%"`
 * proportion strings — it avoids the comma-decimal parsing and keeps full
 * precision for the color bands.
 *
 * @param params.absoluto - Food-insecurity headcount (com or sem PBF).
 * @param params.cadunico - Total CadÚnico registrations (the denominator).
 * @returns The rounded share, or `null` when `cadunico <= 0` (no denominator to
 * take a share of — the choropleth paints these "sem dado").
 *
 * @example
 * cadinsanProporcao({ absoluto: 97708, cadunico: 521373 }); // 18.74
 * cadinsanProporcao({ absoluto: 0, cadunico: 0 }); // null
 */
export const cadinsanProporcao = ({
  absoluto,
  cadunico,
}: {
  absoluto: number;
  cadunico: number;
}): number | null => {
  if (cadunico <= 0) {
    return null;
  }

  return Math.round((absoluto / cadunico) * 100 * 100) / 100;
};

/**
 * Projects the per-município CADINSAN snapshot into the canonical contract,
 * deriving each município's food-insecurity share (%) with and without PBF from
 * the absolute counts and the CadÚnico total. The source rows are already at
 * município granularity (one per município), so this is a cheap 1:1 projection —
 * no aggregation.
 *
 * @param sources - Per-município CADINSAN rows from
 * {@link StaticCadinsanMunicipioSource} (`readStaticCadinsanMunicipal`).
 * @returns One {@link cadinsanByCity} per município in the snapshot.
 *
 * @example
 * toCadinsanPorMunicipio([{
 *   codigoIbge: '3304557', regiao: 'Sudeste', uf: 'Rio de Janeiro',
 *   municipio: 'Rio de Janeiro', absolutoComPbf: 97708, absolutoSemPbf: 144648,
 *   cadastrosCadunico: 521373,
 * }]);
 * // [{ codigoIbge: '3304557', ..., proporcaoComPbf: 18.74, proporcaoSemPbf: 27.74 }]
 */
export const toCadinsanPorMunicipio = (
  sources: StaticCadinsanMunicipioSource[]
): cadinsanByCity[] => {
  return sources.map((source) => {
    return {
      codigoIbge: source.codigoIbge,
      municipio: source.municipio,
      uf: source.uf,
      regiao: source.regiao,
      absolutoComPbf: source.absolutoComPbf,
      absolutoSemPbf: source.absolutoSemPbf,
      cadastrosCadunico: source.cadastrosCadunico,
      proporcaoComPbf: cadinsanProporcao({
        absoluto: source.absolutoComPbf,
        cadunico: source.cadastrosCadunico,
      }),
      proporcaoSemPbf: cadinsanProporcao({
        absoluto: source.absolutoSemPbf,
        cadunico: source.cadastrosCadunico,
      }),
    };
  });
};
