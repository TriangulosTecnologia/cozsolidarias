/* eslint-disable max-lines -- Cohesive choropleth-scale registry: one
   threshold/color/label/legend set per map variant. Splitting would need a
   shared-primitives module (sampleRamp, colorForFlooredScale, flooredBinLabels)
   to avoid a circular import with the extracted scale files. Tracked as a
   follow-up. */
import type { LegendSpec } from '@ttoss/geovis';

import { mapTokens } from '@/config/theme';

import { buildAssentamentoLegend } from './geovisAssentamentosScales';
import {
  IDHM_FAMILY_COLORS,
  IDHM_FAMILY_REFERENCE,
  IDHM_FAMILY_THRESHOLDS,
  IDHM_LEGEND_LABELS,
  IVS_FAMILY_COLORS,
  IVS_FAMILY_REFERENCE,
  IVS_FAMILY_THRESHOLDS,
  IVS_LEGEND_LABELS,
} from './geovisScoreScales';

const sampleRamp = (ramp: readonly string[], count: number): string[] => {
  return Array.from({ length: count }, (_, index) => {
    const position = Math.round((index * (ramp.length - 1)) / (count - 1));
    return ramp[position];
  });
};

const THRESHOLDS = [1, 3, 6, 11, 26];

const COLORS = sampleRamp(
  mapTokens.dataviz.color.sequential[1],
  THRESHOLDS.length + 1
);

const WITHOUT_KITCHEN_COLOR = mapTokens.dataviz.color.status.masked;

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
export const colorForQuantidade = (quantidade: number): string => {
  if (quantidade <= 0) {
    return WITHOUT_KITCHEN_COLOR;
  }
  const index = THRESHOLDS.findIndex((threshold) => {
    return quantidade < threshold;
  });
  return index === -1 ? COLORS[COLORS.length - 1] : COLORS[index];
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
const PERCENT_THRESHOLDS = [0.01, 0.05, 0.1, 0.3, 1, 3];

/**
 * Color ramp for the share choropleth — `PERCENT_THRESHOLDS.length + 1` steps
 * sampled from the same sequential ramp as `COLORS`. Only `PERCENT_COLORS[1..]`
 * are ever painted: geovis maps the below-first-break bin to `defaultColor`, so
 * `PERCENT_COLORS[0]` is vestigial (the count scale wastes its first step the
 * same way). `PERCENT_COLORS[1]` — the lowest painted band (`< 0.05%`, where the
 * bulk of municípios sit) — is a light but visibly blue step.
 */
const PERCENT_COLORS = sampleRamp(
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
const flooredBinLabels = (
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
const RATE_THRESHOLDS = [0.001, 1, 3, 6, 12, 24];

/**
 * Color ramp for the rate choropleth — `RATE_THRESHOLDS.length + 1` steps from
 * the shared sequential ramp. Only `RATE_COLORS[1..]` are painted: geovis maps
 * the below-floor bin to `defaultColor`, so `RATE_COLORS[0]` is vestigial (the
 * count scale wastes its first step the same way).
 */
const RATE_COLORS = sampleRamp(
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
export const colorForTaxa = (taxa: number | null): string => {
  return colorForFlooredScale(taxa, RATE_THRESHOLDS, RATE_COLORS);
};

/**
 * Labels for the rate legend, one per rendered swatch
 * (`RATE_THRESHOLDS.length + 1`). The first swatch is the grey `defaultColor`
 * bin geovis paints below the floor, labelled "Sem dado"; the rest derive from
 * the meaningful cutpoints (`RATE_THRESHOLDS` without the floor) so they can't
 * drift.
 */
const RATE_LEGEND_LABELS = flooredBinLabels('Sem dado', RATE_THRESHOLDS);

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
export const colorForPercentual = (percentual: number): string => {
  return colorForFlooredScale(percentual, PERCENT_THRESHOLDS, PERCENT_COLORS);
};

/**
 * Labels for the share legend, one per rendered swatch
 * (`PERCENT_THRESHOLDS.length + 1`). The first swatch is the `defaultColor`
 * (grey) bin geovis paints below the first break, so it's labelled "Sem
 * cozinha"; the rest are derived from the meaningful cutpoints
 * (`PERCENT_THRESHOLDS` without the `0.01` floor) so they can't drift.
 */
const PERCENT_LEGEND_LABELS = flooredBinLabels(
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
const CAF_PERCENT_THRESHOLDS = [0.00001, 0.005, 0.02, 0.05, 0.15, 0.3];

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
export const colorForCafPercentual = (percentual: number): string => {
  return colorForFlooredScale(
    percentual,
    CAF_PERCENT_THRESHOLDS,
    PERCENT_COLORS
  );
};

/**
 * Labels for the CAF-share legend, one per rendered swatch
 * (`CAF_PERCENT_THRESHOLDS.length + 1`). The first swatch is the grey
 * `defaultColor` bin geovis paints below the floor, labelled "Sem CAF"; the rest
 * derive from the meaningful cutpoints (`CAF_PERCENT_THRESHOLDS` without the
 * `0.00001` floor) so they can't drift.
 */
const CAF_PERCENT_LEGEND_LABELS = flooredBinLabels(
  'Sem CAF',
  CAF_PERCENT_THRESHOLDS,
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
const CADUNICO_THRESHOLDS = [0.01, 0.2, 0.5, 1, 2, 4];

/**
 * Color ramp for the CadÚnico choropleth — `CADUNICO_THRESHOLDS.length + 1`
 * steps. As with {@link PERCENT_COLORS}, only `CADUNICO_COLORS[1..]` are painted
 * (the below-first-break bin uses `defaultColor`), so index `0` is vestigial and
 * index `1` is the lightest visible band.
 */
const CADUNICO_COLORS = sampleRamp(
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
export const colorForCadUnico = (taxa: number | null): string => {
  return colorForFlooredScale(taxa, CADUNICO_THRESHOLDS, CADUNICO_COLORS);
};

/**
 * Labels for the CadÚnico legend, one per rendered swatch
 * (`CADUNICO_THRESHOLDS.length + 1`). The first swatch is the grey `defaultColor`
 * bin, labelled "Sem cozinha"; the rest derive from the meaningful cutpoints
 * (`CADUNICO_THRESHOLDS` without the `0.01` floor) so they can't drift.
 */
const CADUNICO_LEGEND_LABELS = flooredBinLabels(
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
const PESSOAS_COZINHA_THRESHOLDS = [1, 5000, 10000, 20000, 40000, 80000];

/**
 * Color ramp for the coverage choropleth — `PESSOAS_COZINHA_THRESHOLDS.length +
 * 1` steps. As with {@link CADUNICO_COLORS}, only index `1..` are painted (the
 * below-first-break bin uses `defaultColor`), so index `0` is vestigial.
 */
const PESSOAS_COZINHA_COLORS = sampleRamp(
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
export const colorForPessoasPorCozinha = (valor: number | null): string => {
  return colorForFlooredScale(
    valor,
    PESSOAS_COZINHA_THRESHOLDS,
    PESSOAS_COZINHA_COLORS
  );
};

/**
 * Labels for the coverage legend, one per rendered swatch
 * (`PESSOAS_COZINHA_THRESHOLDS.length + 1`). The first swatch is the grey
 * `defaultColor` bin, labelled "Sem cozinha"; the rest derive from the
 * meaningful cutpoints (`PESSOAS_COZINHA_THRESHOLDS` without the `1` floor).
 */
const PESSOAS_COZINHA_LEGEND_LABELS = flooredBinLabels(
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
export const buildLegendItems = (): LegendItem[] => {
  const ranges = THRESHOLDS.map((lower, index): LegendItem => {
    const upper = THRESHOLDS[index + 1];
    const color = COLORS[index + 1];

    if (upper === undefined) {
      return { color, label: `${lower}+` };
    }
    if (upper - lower === 1) {
      return { color, label: `${lower}` };
    }
    return { color, label: `${lower}–${upper - 1}` };
  });

  return [{ color: WITHOUT_KITCHEN_COLOR, label: 'Sem cozinha' }, ...ranges];
};

/**
 * What the municipality fill encodes:
 * - `coropletico`: data-driven choropleth (cozinhas por município, raw count);
 * - `coropletico-taxa`: data-driven choropleth of the cozinhas-per-100k-
 *   inhabitants rate (darker = higher density);
 * - `coropletico-percentual`: data-driven choropleth of each município's share
 *   (%) of all Brazilian cozinhas (darker = larger share);
 * - `coropletico-cafs-percentual`: data-driven choropleth of each município's
 *   share (%) of all Brazilian CAFs (darker = larger share);
 * - `coropletico-cadunico`: data-driven choropleth of the cozinhas-per-10k-
 *   CadÚnico-people rate (darker = better coverage of the vulnerable population);
 * - `coropletico-pessoas-cozinha`: data-driven choropleth of the CadÚnico-people-
 *   per-cozinha ratio (darker = more people per cozinha = thinner coverage);
 * - `coropletico-ivs`: data-driven choropleth of each município's overall Social
 *   Vulnerability Index (IPEA), colored by the official faixas (green = low,
 *   red = high vulnerability);
 * - `pontos`: flat background so the individual kitchen points stand out;
 * - `circulos`: flat background with one proportional circle per município
 *   (radius encodes the kitchen count);
 * - `assentamentos`: SICAR rural-settlement (AST) polygons of SP, filled and
 *   colored by registration status, with the kitchen points overlaid on top.
 *
 * The fill, the municipality/state borders and the background color stay the
 * same across modes — only the data coloring and the points/circles overlays
 * change.
 */
export type MapMode =
  | 'coropletico'
  | 'coropletico-taxa'
  | 'coropletico-percentual'
  | 'coropletico-cafs-percentual'
  | 'coropletico-cadunico'
  | 'coropletico-pessoas-cozinha'
  | 'coropletico-ivs'
  | 'coropletico-ivs-infraestrutura'
  | 'coropletico-ivs-capital-humano'
  | 'coropletico-ivs-renda-trabalho'
  | 'coropletico-idhm'
  | 'coropletico-idhm-longevidade'
  | 'coropletico-idhm-educacao'
  | 'coropletico-idhm-renda'
  | 'coropletico-idhm-educacao-escolaridade'
  | 'coropletico-idhm-educacao-frequencia'
  | 'pontos'
  | 'circulos'
  | 'assentamentos'
  | 'cafs';

const CHOROPLETH_LEGEND_ID = 'legenda-cozinhas';
const RATE_LEGEND_ID = 'legenda-taxa';
const PERCENT_LEGEND_ID = 'legenda-percentual';
const CAF_PERCENT_LEGEND_ID = 'legenda-cafs-percentual';
const CADUNICO_LEGEND_ID = 'legenda-cadunico';
const PESSOAS_COZINHA_LEGEND_ID = 'legenda-pessoas-cozinha';
const IVS_LEGEND_ID = 'legenda-ivs';
const IVS_INFRA_LEGEND_ID = 'legenda-ivs-infraestrutura';
const IVS_CAPITAL_LEGEND_ID = 'legenda-ivs-capital-humano';
const IVS_RENDA_LEGEND_ID = 'legenda-ivs-renda-trabalho';
const IDHM_LEGEND_ID = 'legenda-idhm';
const IDHM_LONG_LEGEND_ID = 'legenda-idhm-longevidade';
const IDHM_EDUC_LEGEND_ID = 'legenda-idhm-educacao';
const IDHM_RENDA_LEGEND_ID = 'legenda-idhm-renda';
const IDHM_EDUC_ESC_LEGEND_ID = 'legenda-idhm-educacao-escolaridade';
const IDHM_EDUC_FREQ_LEGEND_ID = 'legenda-idhm-educacao-frequencia';

/** Title of the rate legend; also the fill's `activeLegendId` in rate mode. */
const RATE_LEGEND_TITLE = 'nº coz. no município / 100.000 hab.';

/** Title of the share legend; also the fill's `activeLegendId` in share mode. */
const PERCENT_LEGEND_TITLE = '% das cozinhas do Brasil no município';

/** Title of the CAF-share legend; also the fill's `activeLegendId` in that mode. */
const CAF_PERCENT_LEGEND_TITLE = '% dos CAFs do Brasil no município';

/** Title of the CadÚnico legend; also the fill's `activeLegendId` in that mode. */
const CADUNICO_LEGEND_TITLE = 'nº coz. / 10 mil pessoas no CadÚnico';

/** Title of the coverage legend; also the fill's `activeLegendId` in that mode. */
const PESSOAS_COZINHA_LEGEND_TITLE = 'pessoas no CadÚnico por cozinha';

/** Title of the IVS legend; also the menu label for the IVS choropleth. */
const IVS_LEGEND_TITLE = 'Índice de vulnerabilidade social';

/** Titles of the three IVS sub-index legends; also their menu labels. */
const IVS_INFRA_LEGEND_TITLE = 'IVS Infraestrutura Urbana';
const IVS_CAPITAL_LEGEND_TITLE = 'IVS Capital Humano';
const IVS_RENDA_LEGEND_TITLE = 'IVS Renda e Trabalho';

/** Titles of the IDHM legends; also their menu labels. */
const IDHM_LEGEND_TITLE = 'Índice de Desenvolvimento Humano Municipal';
const IDHM_LONG_LEGEND_TITLE = 'IDHM Longevidade';
const IDHM_EDUC_LEGEND_TITLE = 'IDHM Educação';
const IDHM_RENDA_LEGEND_TITLE = 'IDHM Renda';
const IDHM_EDUC_ESC_LEGEND_TITLE = 'IDHM Educação — Escolaridade';
const IDHM_EDUC_FREQ_LEGEND_TITLE = 'IDHM Educação — Frequência Escolar';

/**
 * Per-variant legend config. `mode` is the {@link MapMode} that positions (and
 * therefore renders) this legend; every legend shares the same `colorBy`
 * skeleton and differs only in thresholds/colors/labels/copy.
 */
type LegendConfig = {
  id: string;
  mode: MapMode;
  title: string;
  subtitle: string;
  thresholds: number[];
  colors: string[];
  labels: string[];
  reference: string;
  noDataLabel?: string;
};

const LEGEND_CONFIGS: LegendConfig[] = [
  {
    id: CHOROPLETH_LEGEND_ID,
    mode: 'coropletico',
    title: 'Cozinhas por município',
    subtitle: 'Quanto mais escuro o município, mais cozinhas cadastradas ali.',
    thresholds: THRESHOLDS,
    colors: COLORS,
    labels: buildLegendItems().map((item) => {
      return item.label;
    }),
    reference: 'Fonte dos dados: © Cozinhas Solidárias',
  },
  {
    id: RATE_LEGEND_ID,
    mode: 'coropletico-taxa',
    title: RATE_LEGEND_TITLE,
    subtitle:
      'Quanto mais escuro o município, mais cozinhas por 100 mil habitantes.',
    thresholds: RATE_THRESHOLDS,
    colors: RATE_COLORS,
    labels: RATE_LEGEND_LABELS,
    reference: 'Fontes: © Cozinhas Solidárias · IBGE (Censo 2022)',
  },
  {
    id: PERCENT_LEGEND_ID,
    mode: 'coropletico-percentual',
    title: PERCENT_LEGEND_TITLE,
    subtitle:
      'Quanto mais escuro o município, maior a fatia das cozinhas do Brasil ali.',
    thresholds: PERCENT_THRESHOLDS,
    colors: PERCENT_COLORS,
    labels: PERCENT_LEGEND_LABELS,
    reference: 'Fonte dos dados: © Cozinhas Solidárias',
  },
  {
    id: CAF_PERCENT_LEGEND_ID,
    mode: 'coropletico-cafs-percentual',
    title: CAF_PERCENT_LEGEND_TITLE,
    subtitle:
      'Quanto mais escuro o município, maior a fatia dos CAFs do Brasil ali.',
    thresholds: CAF_PERCENT_THRESHOLDS,
    colors: PERCENT_COLORS,
    labels: CAF_PERCENT_LEGEND_LABELS,
    reference:
      'Fonte dos dados: Cadastro Nacional da Agricultura Familiar (CAF)',
  },
  {
    id: CADUNICO_LEGEND_ID,
    mode: 'coropletico-cadunico',
    title: CADUNICO_LEGEND_TITLE,
    subtitle:
      'Quanto mais escuro o município, mais cozinhas por 10 mil pessoas no CadÚnico.',
    thresholds: CADUNICO_THRESHOLDS,
    colors: CADUNICO_COLORS,
    labels: CADUNICO_LEGEND_LABELS,
    reference: 'Fontes: © Cozinhas Solidárias · MDS/SAGI (CadÚnico, jun/2026)',
  },
  {
    id: PESSOAS_COZINHA_LEGEND_ID,
    mode: 'coropletico-pessoas-cozinha',
    title: PESSOAS_COZINHA_LEGEND_TITLE,
    subtitle:
      'Quanto mais escuro o município, mais pessoas do CadÚnico para cada cozinha.',
    thresholds: PESSOAS_COZINHA_THRESHOLDS,
    colors: PESSOAS_COZINHA_COLORS,
    labels: PESSOAS_COZINHA_LEGEND_LABELS,
    reference: 'Fontes: © Cozinhas Solidárias · MDS/SAGI (CadÚnico, jun/2026)',
  },
  {
    id: IVS_LEGEND_ID,
    mode: 'coropletico-ivs',
    title: IVS_LEGEND_TITLE,
    subtitle:
      'Quanto mais avermelhado o município, maior a vulnerabilidade social (IVS).',
    // Floor-prefixed so geovis paints all five faixas: the base bin (`< SCORE_FLOOR`)
    // is the grey "sem dado" swatch, and `[SCORE_FLOOR, 0.2)` → the muito-baixa color.
    thresholds: IVS_FAMILY_THRESHOLDS,
    colors: IVS_FAMILY_COLORS,
    labels: IVS_LEGEND_LABELS,
    reference: IVS_FAMILY_REFERENCE,
  },
  {
    id: IVS_INFRA_LEGEND_ID,
    mode: 'coropletico-ivs-infraestrutura',
    title: IVS_INFRA_LEGEND_TITLE,
    subtitle:
      'Quanto mais avermelhado o município, maior a vulnerabilidade de infraestrutura urbana.',
    thresholds: IVS_FAMILY_THRESHOLDS,
    colors: IVS_FAMILY_COLORS,
    labels: IVS_LEGEND_LABELS,
    reference: IVS_FAMILY_REFERENCE,
  },
  {
    id: IVS_CAPITAL_LEGEND_ID,
    mode: 'coropletico-ivs-capital-humano',
    title: IVS_CAPITAL_LEGEND_TITLE,
    subtitle:
      'Quanto mais avermelhado o município, maior a vulnerabilidade de capital humano.',
    thresholds: IVS_FAMILY_THRESHOLDS,
    colors: IVS_FAMILY_COLORS,
    labels: IVS_LEGEND_LABELS,
    reference: IVS_FAMILY_REFERENCE,
  },
  {
    id: IVS_RENDA_LEGEND_ID,
    mode: 'coropletico-ivs-renda-trabalho',
    title: IVS_RENDA_LEGEND_TITLE,
    subtitle:
      'Quanto mais avermelhado o município, maior a vulnerabilidade de renda e trabalho.',
    thresholds: IVS_FAMILY_THRESHOLDS,
    colors: IVS_FAMILY_COLORS,
    labels: IVS_LEGEND_LABELS,
    reference: IVS_FAMILY_REFERENCE,
  },
  {
    id: IDHM_LEGEND_ID,
    mode: 'coropletico-idhm',
    title: IDHM_LEGEND_TITLE,
    subtitle:
      'Quanto mais escuro (verde) o município, maior o desenvolvimento humano (IDHM).',
    // Floor-prefixed so geovis paints all five faixas: the base bin (`< SCORE_FLOOR`)
    // is the grey "sem dado" swatch, and `[SCORE_FLOOR, 0.5)` → the muito-baixo color.
    thresholds: IDHM_FAMILY_THRESHOLDS,
    colors: IDHM_FAMILY_COLORS,
    labels: IDHM_LEGEND_LABELS,
    reference: IDHM_FAMILY_REFERENCE,
  },
  {
    id: IDHM_LONG_LEGEND_ID,
    mode: 'coropletico-idhm-longevidade',
    title: IDHM_LONG_LEGEND_TITLE,
    subtitle:
      'Quanto mais escuro (verde) o município, maior o desenvolvimento em longevidade.',
    thresholds: IDHM_FAMILY_THRESHOLDS,
    colors: IDHM_FAMILY_COLORS,
    labels: IDHM_LEGEND_LABELS,
    reference: IDHM_FAMILY_REFERENCE,
  },
  {
    id: IDHM_EDUC_LEGEND_ID,
    mode: 'coropletico-idhm-educacao',
    title: IDHM_EDUC_LEGEND_TITLE,
    subtitle:
      'Quanto mais escuro (verde) o município, maior o desenvolvimento em educação.',
    thresholds: IDHM_FAMILY_THRESHOLDS,
    colors: IDHM_FAMILY_COLORS,
    labels: IDHM_LEGEND_LABELS,
    reference: IDHM_FAMILY_REFERENCE,
  },
  {
    id: IDHM_RENDA_LEGEND_ID,
    mode: 'coropletico-idhm-renda',
    title: IDHM_RENDA_LEGEND_TITLE,
    subtitle:
      'Quanto mais escuro (verde) o município, maior o desenvolvimento em renda.',
    thresholds: IDHM_FAMILY_THRESHOLDS,
    colors: IDHM_FAMILY_COLORS,
    labels: IDHM_LEGEND_LABELS,
    reference: IDHM_FAMILY_REFERENCE,
  },
  {
    id: IDHM_EDUC_ESC_LEGEND_ID,
    mode: 'coropletico-idhm-educacao-escolaridade',
    title: IDHM_EDUC_ESC_LEGEND_TITLE,
    subtitle:
      'Quanto mais escuro (verde) o município, maior o subíndice de escolaridade da educação.',
    thresholds: IDHM_FAMILY_THRESHOLDS,
    colors: IDHM_FAMILY_COLORS,
    labels: IDHM_LEGEND_LABELS,
    reference: IDHM_FAMILY_REFERENCE,
  },
  {
    id: IDHM_EDUC_FREQ_LEGEND_ID,
    mode: 'coropletico-idhm-educacao-frequencia',
    title: IDHM_EDUC_FREQ_LEGEND_TITLE,
    subtitle:
      'Quanto mais escuro (verde) o município, maior o subíndice de frequência escolar da educação.',
    thresholds: IDHM_FAMILY_THRESHOLDS,
    colors: IDHM_FAMILY_COLORS,
    labels: IDHM_LEGEND_LABELS,
    reference: IDHM_FAMILY_REFERENCE,
  },
];

/**
 * Builds every choropleth legend from {@link LEGEND_CONFIGS}. `geovis`'
 * `GeoVisProvider` auto-renders any legend that carries a `position`, so only
 * the legend whose `mode` matches the active mode is positioned (and therefore
 * rendered); the others keep the same `colorBy` (still driving fill/tooltip) but
 * stay hidden.
 *
 * The `assentamentos` mode positions a **categorical** legend (status → color)
 * instead of a quantitative one; it's appended after the choropleth legends and
 * only positioned when its mode is active.
 *
 * @param mode - Active {@link MapMode}; positions the matching legend.
 * @returns One {@link LegendSpec} per choropleth variant, plus the settlement one.
 *
 * @example
 * buildLegends('coropletico-taxa').find((l) => l.position); // the rate legend
 * buildLegends('assentamentos').find((l) => l.position); // the settlement legend
 */
export const buildLegends = (mode: MapMode): LegendSpec[] => {
  const choropleths = LEGEND_CONFIGS.map((config): LegendSpec => {
    return {
      id: config.id,
      title: config.title,
      subtitle: config.subtitle,
      ...(mode === config.mode
        ? { position: 'bottom-right' as const, offset: 12 }
        : {}),
      colorBy: {
        type: 'quantitative',
        property: 'value',
        scale: 'threshold',
        thresholds: config.thresholds,
        colors: config.colors,
        defaultColor: WITHOUT_KITCHEN_COLOR,
      },
      labelFormat: { type: 'labels', labels: config.labels },
      ...(config.noDataLabel ? { noDataLabel: config.noDataLabel } : {}),
      reference: config.reference,
    };
  });

  return [...choropleths, buildAssentamentoLegend(mode === 'assentamentos')];
};

/**
 * The id of the legend whose choropleth the given mode paints — used as the fill
 * layer's `activeLegendId`. Falls back to the count legend for the non-metric
 * modes (`coropletico`, `pontos`, `circulos`).
 *
 * @param mode - Active {@link MapMode}.
 * @returns The matching legend id, or the count legend id as fallback.
 *
 * @example
 * legendIdForMode('coropletico-taxa'); // 'legenda-taxa'
 * legendIdForMode('pontos'); // 'legenda-cozinhas'
 */
export const legendIdForMode = (mode: MapMode): string => {
  const match = LEGEND_CONFIGS.find((config) => {
    return config.mode === mode;
  });
  return match?.id ?? CHOROPLETH_LEGEND_ID;
};
