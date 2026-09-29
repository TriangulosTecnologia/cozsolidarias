/**
 * The choropleth colour scales: one threshold/colour/label triple per variant,
 * plus the `colorFor*` lookups the map and the tooltips share.
 *
 * Split from `geovisScales`, which assembles these into the legend specs. The
 * seam is deliberate: a scale is a pure value->colour decision, while a legend
 * adds the copy, the id and the mode that positions it.
 */

import { mapTokens } from '@/config/mapTokens';

import { rampPalette } from './mapaColorRamp';

const sampleRamp = (ramp: readonly string[], count: number): string[] => {
  return Array.from({ length: count }, (_, index) => {
    const position = Math.round((index * (ramp.length - 1)) / (count - 1));
    return ramp[position];
  });
};

export const THRESHOLDS = [1, 3, 6, 11, 26];

export const COLORS = sampleRamp(
  mapTokens.dataviz.color.sequential[1],
  THRESHOLDS.length + 1
);

export const WITHOUT_KITCHEN_COLOR = mapTokens.dataviz.color.status.masked;

/**
 * Resolves the choropleth band color for a kitchen count, mirroring the
 * `threshold` scale that paints the fill (`THRESHOLDS`/`COLORS`). Municípios with
 * no kitchens (`<= 0`) resolve to `WITHOUT_KITCHEN_COLOR` — the same flat fill the
 * map uses — so the hover-tooltip swatch always matches what's on the map.
 *
 * @param quantidade - Kitchen count in the município.
 * @returns The hex color for the count's band.
 *
 * @example
 * colorForQuantidade(0); // WITHOUT_KITCHEN_COLOR (grey "sem cozinha")
 * colorForQuantidade(4); // a mid blue band
 */
export const colorForQuantidade = (
  quantidade: number,
  rampId?: string
): string => {
  if (quantidade <= 0) {
    return WITHOUT_KITCHEN_COLOR;
  }
  const colors = rampPalette({ rampId, count: COLORS.length }) ?? COLORS;
  const index = THRESHOLDS.findIndex((threshold) => {
    return quantidade < threshold;
  });
  return index === -1 ? colors[colors.length - 1] : colors[index];
};

/**
 * Break points (in %) for the "share of Brazil's cozinhas" choropleth. The
 * meaningful cutpoints are `0.05 / 0.1 / 0.3 / 1 / 3`, chosen from the real
 * distribution of the 870 municípios with ≥1 cozinha (shares are tiny and
 * heavily skewed — one cozinha is ≈ 0.02%, the median município sits at ≈ 0.02%
 * and only a handful of capitais exceed 3%).
 *
 * The leading `0.01` is a **floor, not a real cutpoint**: geovis' `step`
 * expression paints every value *below the first break* with the legend's
 * `defaultColor` (the grey "sem cozinha" fill), so the first break must sit
 * below the smallest real share (≈ 0.02%). Without it, municípios like Ourinhos
 * (0.04%) would fall below `0.05` and render grey as if they had no cozinha.
 * With the floor, only the coalesced `0` of municípios with no cozinha lands in
 * that grey bin; every município with ≥1 cozinha gets a visible blue band.
 */
export const PERCENT_THRESHOLDS = [0.01, 0.05, 0.1, 0.3, 1, 3];

/**
 * Color ramp for the share choropleth — `PERCENT_THRESHOLDS.length + 1` steps
 * sampled from the same sequential ramp as `COLORS`. Only `PERCENT_COLORS[1..]`
 * are ever painted: geovis maps the below-first-break bin to `defaultColor`, so
 * `PERCENT_COLORS[0]` is vestigial (the count scale wastes its first step the
 * same way). `PERCENT_COLORS[1]` — the lowest painted band (`< 0.05%`, where the
 * bulk of municípios sit) — is a light but visibly blue step.
 */
export const PERCENT_COLORS = sampleRamp(
  mapTokens.dataviz.color.sequential[1],
  PERCENT_THRESHOLDS.length + 1
);

/**
 * Shared "floored step scale" resolver for the share / CadÚnico / coverage
 * choropleths, mirroring geovis' `step` fill exactly: a `null` value and any
 * value below the first break (a município with no cozinha / no data) resolve to
 * `WITHOUT_KITCHEN_COLOR`; every band `[break[i-1], break[i])` resolves to
 * `colors[i]`. Any value at or above the first break gets a visible band.
 */
const colorForFlooredScale = (
  value: number | null,
  thresholds: readonly number[],
  colors: readonly string[]
): string => {
  if (value === null) {
    return WITHOUT_KITCHEN_COLOR;
  }
  const index = thresholds.findIndex((threshold) => {
    return value < threshold;
  });
  if (index === 0) {
    return WITHOUT_KITCHEN_COLOR;
  }
  return index === -1 ? colors[colors.length - 1] : colors[index];
};

/**
 * Builds a floored-scale legend's swatch labels: the grey below-floor bin
 * `firstLabel`, then `< thresholds[1]` and one `a – b` range per meaningful
 * cutpoint (the `thresholds` without their floor). `suffix` (e.g. `%`) is
 * appended to the upper bound of each bin, matching the source formatting.
 */
export const flooredBinLabels = (
  firstLabel: string,
  thresholds: readonly number[],
  suffix = ''
): string[] => {
  return [
    firstLabel,
    `< ${thresholds[1].toLocaleString('pt-BR')}${suffix}`,
    ...thresholds.slice(1).map((lower, index) => {
      const upper = thresholds[index + 2];
      return upper === undefined
        ? `${lower.toLocaleString('pt-BR')}${suffix}+`
        : `${lower.toLocaleString('pt-BR')} – ${upper.toLocaleString('pt-BR')}${suffix}`;
    }),
  ];
};

/**
 * Break points for the "cozinhas per 100k inhabitants" rate choropleth, chosen
 * from the real distribution of the 870 municípios with ≥1 cozinha (median
 * ≈ 4.6, p90 ≈ 19).
 *
 * The leading `0.001` is a **floor, not a real cutpoint** (see
 * {@link PERCENT_THRESHOLDS}): geovis' `step` paints every value *below the
 * first break* with the grey `defaultColor`, so the floor must sit below the
 * smallest real rate — even a município as large as São Paulo (~11.5M hab.)
 * with a single cozinha rates ≈ 0.009 per 100k. With the floor, only municípios
 * with no cozinha / no population data land in the grey bin; every município
 * with ≥1 cozinha gets a visible blue band — including the `< 1` band, where a
 * município like Araraquara (~1 cozinha for ~230k hab., ≈ 0.43) sits.
 */
export const RATE_THRESHOLDS = [0.001, 1, 3, 6, 12, 24];

/**
 * Color ramp for the rate choropleth — `RATE_THRESHOLDS.length + 1` steps from
 * the shared sequential ramp. Only `RATE_COLORS[1..]` are painted: geovis maps
 * the below-floor bin to `defaultColor`, so `RATE_COLORS[0]` is vestigial (the
 * count scale wastes its first step the same way).
 */
export const RATE_COLORS = sampleRamp(
  mapTokens.dataviz.color.sequential[1],
  RATE_THRESHOLDS.length + 1
);

/**
 * Resolves the rate-choropleth band color for a cozinhas-per-100k rate,
 * mirroring the floored `step` fill (see {@link colorForFlooredScale}). A `null`
 * rate (município missing from the population snapshot) and any value below the
 * floor resolve to `WITHOUT_KITCHEN_COLOR`; every positive rate gets a visible
 * band, so the hover-tooltip swatch always matches the map.
 *
 * @param taxa - Cozinhas-per-100k rate, or `null` when unknown.
 * @returns The hex color for the rate's band.
 *
 * @example
 * colorForTaxa(null); // WITHOUT_KITCHEN_COLOR
 * colorForTaxa(0.5); // the lightest painted band (Araraquara sits here)
 */
export const colorForTaxa = (taxa: number | null, rampId?: string): string => {
  return colorForFlooredScale(
    taxa,
    RATE_THRESHOLDS,
    rampPalette({ rampId, count: RATE_COLORS.length }) ?? RATE_COLORS
  );
};

/**
 * Labels for the rate legend, one per rendered swatch
 * (`RATE_THRESHOLDS.length + 1`). The first swatch is the grey `defaultColor`
 * bin geovis paints below the floor, labelled "Sem dado"; the rest derive from
 * the meaningful cutpoints (`RATE_THRESHOLDS` without the floor) so they can't
 * drift.
 */
export const RATE_LEGEND_LABELS = flooredBinLabels('Sem dado', RATE_THRESHOLDS);

/**
 * Resolves the share-choropleth band color for a município's % of Brazil's
 * cozinhas (see {@link colorForFlooredScale}). Any positive share, however
 * small, gets a visible blue band; only a município with no cozinha (share
 * below the `PERCENT_THRESHOLDS[0]` floor) is grey.
 *
 * @param percentual - Município's share (%) of Brazil's cozinhas.
 * @returns The hex color for the share's band.
 *
 * @example
 * colorForPercentual(0); // WITHOUT_KITCHEN_COLOR
 * colorForPercentual(0.04); // a visible blue band
 */
export const colorForPercentual = (
  percentual: number,
  rampId?: string
): string => {
  return colorForFlooredScale(
    percentual,
    PERCENT_THRESHOLDS,
    rampPalette({ rampId, count: PERCENT_COLORS.length }) ?? PERCENT_COLORS
  );
};

/**
 * Labels for the share legend, one per rendered swatch
 * (`PERCENT_THRESHOLDS.length + 1`). The first swatch is the `defaultColor`
 * (grey) bin geovis paints below the first break, so it's labelled "Sem
 * cozinha"; the rest are derived from the meaningful cutpoints
 * (`PERCENT_THRESHOLDS` without the `0.01` floor) so they can't drift.
 */
export const PERCENT_LEGEND_LABELS = flooredBinLabels(
  'Sem cozinha',
  PERCENT_THRESHOLDS,
  '%'
);

/**
 * Break points (in %) for the "share of Brazil's CAFs" choropleth. CAF shares
 * are far tinier and more skewed than the cozinha shares: one CAF is ≈ 0.000025%,
 * the median município sits at ≈ 0.0085%, and the largest (Cametá, ~14.4k CAFs)
 * reaches ≈ 0.37%. Reusing {@link PERCENT_THRESHOLDS} (floor `0.01`) would push
 * every município below 0.01% — more than half of them — into the grey "sem CAF"
 * bin, so this scale uses its own, much smaller cutpoints spanning below-median
 * (`0.005`) to the top município (`0.3`).
 *
 * The leading `0.00001` is a **floor, not a real cutpoint** (see
 * {@link PERCENT_THRESHOLDS}): it sits below the smallest real share (one CAF ≈
 * 0.000025%), so geovis paints only municípios with no CAF (coalesced `0`) in the
 * grey `defaultColor` bin; every município with ≥1 CAF gets a visible band.
 */
export const CAF_PERCENT_THRESHOLDS = [0.00001, 0.005, 0.02, 0.05, 0.15, 0.3];

/**
 * Resolves the CAF-share-choropleth band color for a município's % of Brazil's
 * CAFs (see {@link colorForFlooredScale}), reusing the shared {@link PERCENT_COLORS}
 * ramp over the CAF-specific {@link CAF_PERCENT_THRESHOLDS}. Any positive share,
 * however small, gets a visible band; only a município with no CAF (share below
 * the floor) is grey.
 *
 * @param percentual - Município's share (%) of Brazil's CAFs.
 * @returns The hex color for the share's band.
 *
 * @example
 * colorForCafPercentual(0); // WITHOUT_KITCHEN_COLOR ("sem CAF")
 * colorForCafPercentual(0.01); // a visible blue band
 */
export const colorForCafPercentual = (
  percentual: number,
  rampId?: string
): string => {
  return colorForFlooredScale(
    percentual,
    CAF_PERCENT_THRESHOLDS,
    rampPalette({ rampId, count: PERCENT_COLORS.length }) ?? PERCENT_COLORS
  );
};

/**
 * Labels for the CAF-share legend, one per rendered swatch
 * (`CAF_PERCENT_THRESHOLDS.length + 1`). The first swatch is the grey
 * `defaultColor` bin geovis paints below the floor, labelled "Sem CAF"; the rest
 * derive from the meaningful cutpoints (`CAF_PERCENT_THRESHOLDS` without the
 * `0.00001` floor) so they can't drift.
 */
export const CAF_PERCENT_LEGEND_LABELS = flooredBinLabels(
  'Sem CAF',
  CAF_PERCENT_THRESHOLDS,
  '%'
);

/**
 * Break points (in %) for the CADINSAN food-insecurity choropleths — the share
 * of a município's CadÚnico families in food insecurity. Fixed, interpretable
 * cutpoints (`10 / 20 / 30 / 40`) shared by the "com PBF" and "sem PBF" modes so
 * the two are read on the same ruler ("acima de 30%" means the same in both).
 *
 * Unlike the other floored scales, the leading break is **`0`, a real cutpoint**,
 * not a positive floor: `0%` is a meaningful value (a município with CadÚnico
 * families but none in food insecurity) that must paint the lightest band, so
 * geovis' `step` (which paints `value >= thresholds[0]`) keeps `0` visible.
 * Only a município with no CadÚnico denominator resolves to `null` upstream and
 * lands in the grey "sem dado" bin.
 */
export const CADINSAN_THRESHOLDS = [0, 10, 20, 30, 40];

/**
 * Color ramp for the CADINSAN choropleths — `CADINSAN_THRESHOLDS.length + 1`
 * steps from the shared sequential ramp. As with the other floored scales,
 * `CADINSAN_COLORS[0]` is vestigial (geovis maps the below-first-break bin to
 * `defaultColor`); `CADINSAN_COLORS[1]` is the lightest painted band (`< 10%`).
 */
export const CADINSAN_COLORS = sampleRamp(
  mapTokens.dataviz.color.sequential[1],
  CADINSAN_THRESHOLDS.length + 1
);

/**
 * Resolves the CADINSAN-choropleth band color for a food-insecurity share (%),
 * mirroring the floored `step` fill (see {@link colorForFlooredScale}). A `null`
 * share (município with no CadÚnico denominator) resolves to
 * `WITHOUT_KITCHEN_COLOR` ("sem dado"); every real share `>= 0` gets a visible
 * band, so the hover-tooltip swatch always matches the map.
 *
 * @param proporcao - Food-insecurity share (%), or `null` when unknown.
 * @returns The hex color for the share's band.
 *
 * @example
 * colorForCadinsan(null); // WITHOUT_KITCHEN_COLOR ("sem dado")
 * colorForCadinsan(0); // the lightest painted band
 * colorForCadinsan(35); // the "30 – 40%" band
 */
export const colorForCadinsan = (
  proporcao: number | null,
  rampId?: string
): string => {
  return colorForFlooredScale(
    proporcao,
    CADINSAN_THRESHOLDS,
    rampPalette({ rampId, count: CADINSAN_COLORS.length }) ?? CADINSAN_COLORS
  );
};

/**
 * Labels for the CADINSAN legends, one per rendered swatch
 * (`CADINSAN_THRESHOLDS.length + 1`). The first swatch is the grey `defaultColor`
 * bin (municípios with no CadÚnico denominator), labelled "Sem dado"; the rest
 * derive from the cutpoints so they can't drift.
 */
export const CADINSAN_LEGEND_LABELS = flooredBinLabels(
  'Sem dado',
  CADINSAN_THRESHOLDS,
  '%'
);

/**
 * Break points for the "cozinhas per 10k CadÚnico people" choropleth — the rate
 * `(cozinhas / pessoas) * 10_000`. The meaningful cutpoints are
 * `0.2 / 0.5 / 1 / 2 / 4`, chosen from the real distribution of the 870
 * municípios with ≥1 cozinha (median ≈ 0.75, p90 ≈ 2.8).
 *
 * The leading `0.01` is a **floor, not a real cutpoint** (see
 * {@link PERCENT_THRESHOLDS}): geovis paints values below the first break with
 * the grey `defaultColor`, so the floor keeps the ~66 municípios whose rate sits
 * between the real minimum (≈ 0.04) and `0.2` painted blue instead of grey. Only
 * municípios with no cozinha (or, defensively, unknown CadÚnico) stay grey.
 */
export const CADUNICO_THRESHOLDS = [0.01, 0.2, 0.5, 1, 2, 4];

/**
 * Color ramp for the CadÚnico choropleth — `CADUNICO_THRESHOLDS.length + 1`
 * steps. As with {@link PERCENT_COLORS}, only `CADUNICO_COLORS[1..]` are painted
 * (the below-first-break bin uses `defaultColor`), so index `0` is vestigial and
 * index `1` is the lightest visible band.
 */
export const CADUNICO_COLORS = sampleRamp(
  mapTokens.dataviz.color.sequential[1],
  CADUNICO_THRESHOLDS.length + 1
);

/**
 * Resolves the CadÚnico-choropleth band color for a cozinhas-per-10k-CadÚnico
 * rate (see {@link colorForFlooredScale}). A `null` rate (município missing from
 * the CadÚnico snapshot) or a município with no cozinha is grey.
 *
 * @param taxa - Cozinhas-per-10k-CadÚnico rate, or `null` when unknown.
 * @returns The hex color for the rate's band.
 *
 * @example
 * colorForCadUnico(null); // WITHOUT_KITCHEN_COLOR
 * colorForCadUnico(1); // a mid blue band
 */
export const colorForCadUnico = (
  taxa: number | null,
  rampId?: string
): string => {
  return colorForFlooredScale(
    taxa,
    CADUNICO_THRESHOLDS,
    rampPalette({ rampId, count: CADUNICO_COLORS.length }) ?? CADUNICO_COLORS
  );
};

/**
 * Labels for the CadÚnico legend, one per rendered swatch
 * (`CADUNICO_THRESHOLDS.length + 1`). The first swatch is the grey `defaultColor`
 * bin, labelled "Sem cozinha"; the rest derive from the meaningful cutpoints
 * (`CADUNICO_THRESHOLDS` without the `0.01` floor) so they can't drift.
 */
export const CADUNICO_LEGEND_LABELS = flooredBinLabels(
  'Sem cozinha',
  CADUNICO_THRESHOLDS
);

/**
 * Break points for the "CadÚnico people per cozinha" (coverage) choropleth — the
 * inverse ratio `pessoas / cozinhas`. The meaningful cutpoints are
 * `5.000 / 10.000 / 20.000 / 40.000 / 80.000`, chosen from the real distribution
 * of the 870 municípios with ≥1 cozinha (median ≈ 13k, p90 ≈ 45k). Darker = more
 * people per cozinha = thinner coverage.
 *
 * The leading `1` is a **floor, not a real cutpoint** (see
 * {@link PERCENT_THRESHOLDS}): it keeps every município with a cozinha (minimum
 * ≈ 7 people/cozinha) out of the grey below-first-break bin, so only municípios
 * with no cozinha (or, defensively, unknown CadÚnico) stay grey.
 */
export const PESSOAS_COZINHA_THRESHOLDS = [1, 5000, 10000, 20000, 40000, 80000];

/**
 * Color ramp for the coverage choropleth — `PESSOAS_COZINHA_THRESHOLDS.length +
 * 1` steps. As with {@link CADUNICO_COLORS}, only index `1..` are painted (the
 * below-first-break bin uses `defaultColor`), so index `0` is vestigial.
 */
export const PESSOAS_COZINHA_COLORS = sampleRamp(
  mapTokens.dataviz.color.sequential[1],
  PESSOAS_COZINHA_THRESHOLDS.length + 1
);

/**
 * Resolves the coverage-choropleth band color for a people-per-cozinha value
 * (see {@link colorForFlooredScale}). A `null` value (município missing from the
 * CadÚnico snapshot) or a município with no cozinha is grey.
 *
 * @param valor - CadÚnico people per cozinha, or `null` when unknown.
 * @returns The hex color for the value's band.
 *
 * @example
 * colorForPessoasPorCozinha(null); // WITHOUT_KITCHEN_COLOR
 * colorForPessoasPorCozinha(15000); // a mid blue band
 */
export const colorForPessoasPorCozinha = (
  valor: number | null,
  rampId?: string
): string => {
  return colorForFlooredScale(
    valor,
    PESSOAS_COZINHA_THRESHOLDS,
    rampPalette({ rampId, count: PESSOAS_COZINHA_COLORS.length }) ??
      PESSOAS_COZINHA_COLORS
  );
};

/**
 * Labels for the coverage legend, one per rendered swatch
 * (`PESSOAS_COZINHA_THRESHOLDS.length + 1`). The first swatch is the grey
 * `defaultColor` bin, labelled "Sem cozinha"; the rest derive from the
 * meaningful cutpoints (`PESSOAS_COZINHA_THRESHOLDS` without the `1` floor).
 */
export const PESSOAS_COZINHA_LEGEND_LABELS = flooredBinLabels(
  'Sem cozinha',
  PESSOAS_COZINHA_THRESHOLDS
);

/** A single swatch for the workspace's right-sidebar legend. */
export type LegendItem = { color: string; label: string };

/**
 * Legend swatches for the right sidebar, derived from the same `THRESHOLDS` and
 * `COLORS` that drive the choropleth — so the sidebar legend can never drift
 * from the map coloring.
 *
 * `COLORS[0]` (values `< 1`, i.e. zero) is folded into the "Sem cozinha" swatch
 * (the `defaultColor` used by municípios with no data), so the visible count
 * ranges start at `COLORS[1]`.
 *
 * @returns The ordered swatches: "Sem cozinha" first, then one per count range.
 *
 * @example
 * buildLegendItems()[0]; // { color: WITHOUT_KITCHEN_COLOR, label: 'Sem cozinha' }
 */
/**
 * Builds the integer-count legend labels from a threshold array: the grey "Sem
 * cozinha" bin first, then one label per count range — a single value when the
 * range spans one integer (`upper - lower === 1`), a closed `a–b` range
 * otherwise, and an open `n+` for the top band. Shared by {@link buildLegendItems}
 * and the count choropleth so the count labels can be rebuilt from data-driven
 * (Jenks) breaks without duplicating the range formatting.
 *
 * @param thresholds - The count scale's thresholds (floor first).
 * @returns The ordered labels: "Sem cozinha", then one per count range.
 *
 * @example
 * buildCountLabels([1, 3, 6]); // ['Sem cozinha', '1–2', '3–5', '6+']
 */
export const buildCountLabels = (thresholds: readonly number[]): string[] => {
  const ranges = thresholds.map((lower, index) => {
    const upper = thresholds[index + 1];
    if (upper === undefined) {
      return `${lower}+`;
    }
    if (upper - lower === 1) {
      return `${lower}`;
    }
    return `${lower}–${upper - 1}`;
  });
  return ['Sem cozinha', ...ranges];
};

export const buildLegendItems = (): LegendItem[] => {
  return buildCountLabels(THRESHOLDS).map((label, index): LegendItem => {
    return {
      color: index === 0 ? WITHOUT_KITCHEN_COLOR : COLORS[index],
      label,
    };
  });
};
