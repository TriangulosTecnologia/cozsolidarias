import type { LegendSpec } from '@ttoss/geovis';

import { mapTokens } from '@/config/theme';

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
 * Break points for the "cozinhas per 100k inhabitants" rate choropleth, chosen
 * from the real distribution of the 870 municípios with ≥1 cozinha (median
 * ≈ 4.6, p90 ≈ 19). The lowest bin (`< 1`) is a real, painted band here — unlike
 * the count scale, where no município ever falls below 1 — so its color is the
 * lightest ramp step (`COLORS[0]`), distinct from the grey "sem dado" fill.
 */
const RATE_THRESHOLDS = [1, 3, 6, 12, 24];

/**
 * Resolves the rate-choropleth band color for a cozinhas-per-100k rate,
 * mirroring the `threshold` scale that paints the fill (`RATE_THRESHOLDS` over
 * the shared `COLORS` ramp). A `null` rate (município missing from the
 * population snapshot) resolves to `WITHOUT_KITCHEN_COLOR` so the hover-tooltip
 * swatch matches the "sem dado" fill.
 *
 * @param taxa - Cozinhas-per-100k rate, or `null` when unknown.
 * @returns The hex color for the rate's band.
 *
 * @example
 * colorForTaxa(null); // WITHOUT_KITCHEN_COLOR
 * colorForTaxa(0.5); // the lightest painted band
 */
export const colorForTaxa = (taxa: number | null): string => {
  if (taxa === null) {
    return WITHOUT_KITCHEN_COLOR;
  }
  const index = RATE_THRESHOLDS.findIndex((threshold) => {
    return taxa < threshold;
  });
  return index === -1 ? COLORS[COLORS.length - 1] : COLORS[index];
};

/**
 * Explicit labels for the rate legend's threshold bins, one per bin
 * (`RATE_THRESHOLDS.length + 1`), derived from `RATE_THRESHOLDS` so they can't
 * drift. The "sem dado" swatch is rendered separately via the legend's
 * `noDataLabel`, not folded into a bin.
 */
const RATE_LEGEND_LABELS = [
  `< ${RATE_THRESHOLDS[0]}`,
  ...RATE_THRESHOLDS.map((lower, index) => {
    const upper = RATE_THRESHOLDS[index + 1];
    return upper === undefined ? `${lower}+` : `${lower} – ${upper}`;
  }),
];

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
const PERCENT_LEGEND_LABELS = [
  'Sem cozinha',
  `< ${PERCENT_THRESHOLDS[1].toLocaleString('pt-BR')}%`,
  ...PERCENT_THRESHOLDS.slice(1).map((lower, index) => {
    const upper = PERCENT_THRESHOLDS[index + 2];
    return upper === undefined
      ? `${lower.toLocaleString('pt-BR')}%+`
      : `${lower.toLocaleString('pt-BR')} – ${upper.toLocaleString('pt-BR')}%`;
  }),
];

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
const CADUNICO_LEGEND_LABELS = [
  'Sem cozinha',
  `< ${CADUNICO_THRESHOLDS[1].toLocaleString('pt-BR')}`,
  ...CADUNICO_THRESHOLDS.slice(1).map((lower, index) => {
    const upper = CADUNICO_THRESHOLDS[index + 2];
    return upper === undefined
      ? `${lower.toLocaleString('pt-BR')}+`
      : `${lower.toLocaleString('pt-BR')} – ${upper.toLocaleString('pt-BR')}`;
  }),
];

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
const PESSOAS_COZINHA_LEGEND_LABELS = [
  'Sem cozinha',
  `< ${PESSOAS_COZINHA_THRESHOLDS[1].toLocaleString('pt-BR')}`,
  ...PESSOAS_COZINHA_THRESHOLDS.slice(1).map((lower, index) => {
    const upper = PESSOAS_COZINHA_THRESHOLDS[index + 2];
    return upper === undefined
      ? `${lower.toLocaleString('pt-BR')}+`
      : `${lower.toLocaleString('pt-BR')} – ${upper.toLocaleString('pt-BR')}`;
  }),
];

/**
 * IVS faixas oficiais do Atlas da Vulnerabilidade Social (IPEA): five fixed
 * classes on the `[0, 1]` index. Break points are the class upper bounds, so
 * `value < 0.2` → "muito baixa", `[0.2, 0.3)` → "baixa", …, `>= 0.5` → "muito
 * alta". Every band is a real painted class; a município only goes grey when
 * it's absent from the IVS snapshot (see {@link IVS_FLOOR}). These four cutpoints
 * drive the tooltip (`colorForIvs` / `ivsFaixaLabel`); the fill legend prepends
 * {@link IVS_FLOOR} so "muito baixa" isn't swallowed by geovis' grey base bin.
 */
const IVS_THRESHOLDS = [0.2, 0.3, 0.4, 0.5];

/**
 * Leading **floor**, not a real cutpoint (see {@link PERCENT_THRESHOLDS}): geovis'
 * `step` fill paints every value *below the first break* with the grey
 * `defaultColor`, and missing municípios coalesce to `0`. Without a floor the
 * whole "muito baixa" class (`< 0.2`) would fall in that bin and render as "sem
 * dado". Set just above `0` so every positive score is painted; the shared IVS
 * family scale reuses it, and `ivs_infraestrutura_urbana` has real `0.0` values
 * (44 municípios) that are indistinguishable from the coalesced-`0` missing
 * sentinel, so those unavoidably stay grey.
 */
const IVS_FLOOR = 0.001;

/** Faixa names, one per band (`IVS_THRESHOLDS.length + 1`), low → high. */
const IVS_FAIXA_LABELS = [
  'Muito baixa',
  'Baixa',
  'Média',
  'Alta',
  'Muito alta',
];

/**
 * Legend swatch labels, one per rendered bin (`IVS_THRESHOLDS.length + 2`): the
 * first is the grey `defaultColor` base bin (município absent from the snapshot),
 * labelled "Sem dado"; the rest are the faixa name + its official IPEA class
 * range (`0,201` etc.), so they read as the canonical classification.
 */
const IVS_LEGEND_LABELS = [
  'Sem dado',
  'Muito baixa (≤ 0,200)',
  'Baixa (0,201–0,300)',
  'Média (0,301–0,400)',
  'Alta (0,401–0,500)',
  'Muito alta (≥ 0,501)',
];

/**
 * Single-hue red ramp for the IVS faixas (`IVS_THRESHOLDS.length + 1` steps):
 * light red = low vulnerability, dark red = high. Sampled at evenly spaced
 * indices of the brand `red` sequential ramp so the scale reads as a
 * monochromatic light→dark gradient — the more reddish the município, the higher
 * its social vulnerability.
 */
const IVS_COLORS = [
  mapTokens.dataviz.color.sequential[5][0], // muito baixa — light red
  mapTokens.dataviz.color.sequential[5][3], // baixa
  mapTokens.dataviz.color.sequential[5][6], // média
  mapTokens.dataviz.color.sequential[5][9], // alta
  mapTokens.dataviz.color.sequential[5][13], // muito alta — dark red
];

/**
 * Resolves the IVS-choropleth band color for an overall IVS score, mirroring the
 * `threshold` scale that paints the fill (`IVS_THRESHOLDS`/`IVS_COLORS`). A
 * `null` score (município missing from the IVS snapshot) resolves to
 * `WITHOUT_KITCHEN_COLOR` so the hover-tooltip swatch matches the "sem dado"
 * fill.
 *
 * @param ivs - Overall IVS score in `[0, 1]`, or `null` when unknown.
 * @returns The hex color for the score's faixa.
 *
 * @example
 * colorForIvs(null); // WITHOUT_KITCHEN_COLOR (grey "sem dado")
 * colorForIvs(0.15); // the "muito baixa" light-red band
 * colorForIvs(0.55); // the "muito alta" dark-red band
 */
export const colorForIvs = (ivs: number | null): string => {
  if (ivs === null) {
    return WITHOUT_KITCHEN_COLOR;
  }
  const index = IVS_THRESHOLDS.findIndex((threshold) => {
    return ivs < threshold;
  });
  return index === -1 ? IVS_COLORS[IVS_COLORS.length - 1] : IVS_COLORS[index];
};

/**
 * Resolves the IVS faixa name for a score (see {@link IVS_FAIXA_LABELS}), or
 * `null` when the score is unknown. Shared by the tooltip so the faixa it shows
 * can't drift from the band {@link colorForIvs} paints (both read
 * `IVS_THRESHOLDS`).
 *
 * @param ivs - Overall IVS score in `[0, 1]`, or `null` when unknown.
 * @returns The faixa name (e.g. `'Média'`), or `null`.
 *
 * @example
 * ivsFaixaLabel(0.35); // 'Média'
 * ivsFaixaLabel(null); // null
 */
export const ivsFaixaLabel = (ivs: number | null): string | null => {
  if (ivs === null) {
    return null;
  }
  const index = IVS_THRESHOLDS.findIndex((threshold) => {
    return ivs < threshold;
  });
  return index === -1
    ? IVS_FAIXA_LABELS[IVS_FAIXA_LABELS.length - 1]
    : IVS_FAIXA_LABELS[index];
};

/**
 * Shared fill scale for the whole IVS family (overall IVS + the three
 * sub-indices): every one lives on the same `[0, 1]` IPEA scale, faixas and
 * colors, so they reuse a single floor-prefixed threshold/color pair and only
 * differ in copy. See {@link IVS_FLOOR} for why the floor leads the breaks.
 */
const IVS_FAMILY_THRESHOLDS = [IVS_FLOOR, ...IVS_THRESHOLDS];
const IVS_FAMILY_COLORS = [WITHOUT_KITCHEN_COLOR, ...IVS_COLORS];

/** Source note shared by the IVS-family legends: data vintage + IPEA classification. */
const IVS_FAMILY_REFERENCE =
  'Fonte dos dados: Atlas da Vulnerabilidade Social — IPEA (2010). Faixas de classificação conforme IPEA, Atlas da Vulnerabilidade Social nos Municípios Brasileiros (2015), seção “Como ler o IVS”.';

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
  const semCozinha: LegendItem = {
    color: WITHOUT_KITCHEN_COLOR,
    label: 'Sem cozinha',
  };

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

  return [semCozinha, ...ranges];
};

/**
 * Swatch labels for the count legend, derived from the same `THRESHOLDS`/`COLORS`
 * as the fill (via {@link buildLegendItems}) so they can never drift. Index 0 is
 * the `< 1` bin — which resolves to `defaultColor` (`WITHOUT_KITCHEN_COLOR`) and
 * so doubles as the "Sem cozinha" swatch — followed by one label per range.
 */
const LEGEND_BIN_LABELS = buildLegendItems().map((item) => {
  return item.label;
});

/**
 * What the municipality fill encodes:
 * - `coropletico`: data-driven choropleth (cozinhas por município, raw count);
 * - `coropletico-taxa`: data-driven choropleth of the cozinhas-per-100k-
 *   inhabitants rate (darker = higher density);
 * - `coropletico-percentual`: data-driven choropleth of each município's share
 *   (%) of all Brazilian cozinhas (darker = larger share);
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
  | 'coropletico-cadunico'
  | 'coropletico-pessoas-cozinha'
  | 'coropletico-ivs'
  | 'coropletico-ivs-infraestrutura'
  | 'coropletico-ivs-capital-humano'
  | 'coropletico-ivs-renda-trabalho'
  | 'pontos'
  | 'circulos'
  | 'assentamentos';

/**
 * Registration-status classes of a SICAR settlement (`ind_status`), with the
 * human label the map colors and labels by. The map's categorical join uses the
 * **label** (not the code) as the joined value, so the legend swatch labels and
 * the tooltip text read straight from it. `code → label` is the only mapping
 * that must stay in sync with the source's `ind_status` domain.
 */
const ASSENTAMENTO_STATUS = [
  { code: 'AT', label: 'Ativo' },
  { code: 'CA', label: 'Cancelado' },
  { code: 'PE', label: 'Pendente' },
] as const;

/** Discrete brand categorical hues (nominal), reused for the status classes. */
const ASSENTAMENTO_CATEGORICAL = mapTokens.dataviz.color.categorical[1];

/**
 * Status label → fill color. Green = active, brick-red = cancelled, amber =
 * pending, drawn from the brand categorical palette. Keyed by label because the
 * categorical `colorBy.mapping` and the join value are both label-based.
 */
const ASSENTAMENTO_STATUS_COLORS: Record<string, string> = {
  Ativo: ASSENTAMENTO_CATEGORICAL[2],
  Cancelado: ASSENTAMENTO_CATEGORICAL[6],
  Pendente: ASSENTAMENTO_CATEGORICAL[4],
};

/** Fallback fill for a settlement whose status is outside the known domain. */
const ASSENTAMENTO_DEFAULT_COLOR = mapTokens.dataviz.color.status.masked;

/**
 * Maps a SICAR `ind_status` code to its human label. Unknown codes return
 * `'Outros'` so they still color/join to the fallback swatch instead of leaking
 * the raw code.
 *
 * @param code - Raw `ind_status` from the source (e.g. `'AT'`).
 * @returns The human label (e.g. `'Ativo'`), or `'Outros'` when unknown.
 *
 * @example
 * assentamentoStatusLabel('AT'); // 'Ativo'
 * assentamentoStatusLabel('ZZ'); // 'Outros'
 */
export const assentamentoStatusLabel = (code: string): string => {
  const match = ASSENTAMENTO_STATUS.find((entry) => {
    return entry.code === code;
  });
  return match?.label ?? 'Outros';
};

/**
 * Resolves the fill color for a settlement status label, mirroring the
 * categorical `colorBy.mapping` that paints the polygons so the tooltip swatch
 * can't drift. Any label outside {@link ASSENTAMENTO_STATUS_COLORS} (including
 * `null`) resolves to the masked fallback.
 *
 * @param label - Status label (e.g. `'Ativo'`), or `null` when unknown.
 * @returns The hex color for the status.
 *
 * @example
 * colorForAssentamentoStatus('Cancelado'); // brick-red
 * colorForAssentamentoStatus(null); // masked fallback
 */
export const colorForAssentamentoStatus = (label: string | null): string => {
  if (label === null) {
    return ASSENTAMENTO_DEFAULT_COLOR;
  }
  return ASSENTAMENTO_STATUS_COLORS[label] ?? ASSENTAMENTO_DEFAULT_COLOR;
};

const CHOROPLETH_LEGEND_ID = 'legenda-cozinhas';
const RATE_LEGEND_ID = 'legenda-taxa';
const PERCENT_LEGEND_ID = 'legenda-percentual';
const CADUNICO_LEGEND_ID = 'legenda-cadunico';
const PESSOAS_COZINHA_LEGEND_ID = 'legenda-pessoas-cozinha';
const IVS_LEGEND_ID = 'legenda-ivs';
const IVS_INFRA_LEGEND_ID = 'legenda-ivs-infraestrutura';
const IVS_CAPITAL_LEGEND_ID = 'legenda-ivs-capital-humano';
const IVS_RENDA_LEGEND_ID = 'legenda-ivs-renda-trabalho';

/** Id of the categorical settlement legend; the assentamentos fill's `activeLegendId`. */
export const ASSENTAMENTO_LEGEND_ID = 'legenda-assentamentos';

/** Title of the settlement legend; also the menu label for the assentamentos mode. */
const ASSENTAMENTO_LEGEND_TITLE = 'Assentamentos rurais';

/** Title of the rate legend; also the fill's `activeLegendId` in rate mode. */
const RATE_LEGEND_TITLE = 'nº coz. no município / 100.000 hab.';

/** Title of the share legend; also the fill's `activeLegendId` in share mode. */
const PERCENT_LEGEND_TITLE = '% das cozinhas do Brasil no município';

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
    labels: LEGEND_BIN_LABELS,
    reference: 'Fonte dos dados: © Cozinhas Solidárias',
  },
  {
    id: RATE_LEGEND_ID,
    mode: 'coropletico-taxa',
    title: RATE_LEGEND_TITLE,
    subtitle:
      'Quanto mais escuro o município, mais cozinhas por 100 mil habitantes.',
    thresholds: RATE_THRESHOLDS,
    colors: COLORS,
    labels: RATE_LEGEND_LABELS,
    reference: 'Fontes: © Cozinhas Solidárias · IBGE (Censo 2022)',
    noDataLabel: 'Sem dado',
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
    // Floor-prefixed so geovis paints all five faixas: the base bin (`< IVS_FLOOR`)
    // is the grey "sem dado" swatch, and `[IVS_FLOOR, 0.2)` → the muito-baixa color.
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
      ...(mode === config.mode ? { position: 'bottom-right' as const } : {}),
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

  const assentamentos: LegendSpec = {
    id: ASSENTAMENTO_LEGEND_ID,
    title: ASSENTAMENTO_LEGEND_TITLE,
    subtitle: 'Cor pela situação do cadastro do assentamento no CAR.',
    ...(mode === 'assentamentos' ? { position: 'bottom-right' as const } : {}),
    colorBy: {
      type: 'categorical',
      property: 'value',
      mapping: ASSENTAMENTO_STATUS_COLORS,
      defaultColor: ASSENTAMENTO_DEFAULT_COLOR,
    },
    reference:
      'Fonte dos dados: SICAR / Serviço Florestal Brasileiro — {link:consulta.car.gov.br|https://consulta.car.gov.br/geoservices}',
  };

  return [...choropleths, assentamentos];
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
