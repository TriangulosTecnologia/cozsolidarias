import type { LegendSpec } from '@ttoss/geovis';

import { mapTokens } from '@/config/theme';
import type { CozinhaSituacao } from '@/data-gateway/schema';

interface LegendItem {
  color: string;
  label: string;
}

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

/**
 * Flat fill used by municípios with no cozinha (and "sem dado" bins) — the
 * legend's `defaultColor` in every quantitative scale, and the neutral map
 * background in the overlay modes.
 *
 * @example
 * paint: { fillColor: WITHOUT_KITCHEN_COLOR }
 */
export const WITHOUT_KITCHEN_COLOR = mapTokens.dataviz.color.status.masked;

/**
 * Fill color for the proportional-circle overlay (`circulos` mode). The
 * `proportionalCircles` resolver's own defaults
 * (`PROPORTIONAL_CIRCLES_DEFAULTS`) cover opacity/stroke but never
 * `circleColor` — leaving it unset renders MapLibre's own paint default
 * (opaque black), which reads as noise rather than data. Reuses the
 * mid-tone of the shared sequential ramp so the circles read as the same
 * "cozinhas" blue family as the choropleth.
 *
 * @example
 * paint: { circleColor: BUBBLES_COLOR }
 */
export const BUBBLES_COLOR = mapTokens.dataviz.color.sequential[1][6];

/**
 * Resolves the choropleth band color for a kitchen count, mirroring the
 * `threshold` scale that paints the fill (`THRESHOLDS`/`COLORS`). Municípios with
 * no kitchens (`<= 0`) resolve to `WITHOUT_KITCHEN_COLOR` — the same flat fill the
 * map uses — so the hover-tooltip swatch always matches what's on the map.
 *
 * @param quantidade kitchen count of the município.
 * @returns the CSS color of the band that count falls in.
 *
 * @example
 * colorForQuantidade(0); // → WITHOUT_KITCHEN_COLOR
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
 * @param taxa cozinhas per 100k inhabitants, or `null` when unknown.
 * @returns the CSS color of the band that rate falls in.
 *
 * @example
 * colorForTaxa(null); // → WITHOUT_KITCHEN_COLOR ("sem dado")
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
 * Resolves the share-choropleth band color for a município's % of Brazil's
 * cozinhas, mirroring geovis' `step` fill exactly: any value below the first
 * break (`PERCENT_THRESHOLDS[0]` — i.e. a município with no cozinha) resolves to
 * `WITHOUT_KITCHEN_COLOR`, and every band `[break[i-1], break[i])` to
 * `PERCENT_COLORS[i]`, so the hover-tooltip swatch always matches the map. Any
 * positive share, however small, gets a visible blue band.
 *
 * @param percentual the município's share (%) of all Brazilian cozinhas.
 * @returns the CSS color of the band that share falls in.
 *
 * @example
 * colorForPercentual(0); // → WITHOUT_KITCHEN_COLOR ("sem cozinha")
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
 * `PERCENT_THRESHOLDS`): geovis paints values below the first break with
 * the grey `defaultColor`, so the floor keeps the ~66 municípios whose rate sits
 * between the real minimum (≈ 0.04) and `0.2` painted blue instead of grey. Only
 * municípios with no cozinha (or, defensively, unknown CadÚnico) stay grey.
 */
const CADUNICO_THRESHOLDS = [0.01, 0.2, 0.5, 1, 2, 4];

/**
 * Color ramp for the CadÚnico choropleth — `CADUNICO_THRESHOLDS.length + 1`
 * steps. As with `PERCENT_COLORS`, only `CADUNICO_COLORS[1..]` are painted
 * (the below-first-break bin uses `defaultColor`), so index `0` is vestigial and
 * index `1` is the lightest visible band.
 */
const CADUNICO_COLORS = sampleRamp(
  mapTokens.dataviz.color.sequential[1],
  CADUNICO_THRESHOLDS.length + 1
);

/**
 * Resolves the CadÚnico-choropleth band color for a cozinhas-per-10k-CadÚnico
 * rate (see {@link colorForPercentual}, which shares the same floored-scale
 * logic). A `null` rate (município missing from the CadÚnico snapshot) or a
 * município with no cozinha is grey.
 *
 * @param taxa cozinhas-per-10k-CadÚnico rate, or `null` when unknown.
 * @returns the CSS color of the band that rate falls in.
 *
 * @example
 * colorForCadUnico(null); // → WITHOUT_KITCHEN_COLOR
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
 * The leading `1` is a **floor, not a real cutpoint**: it keeps every município
 * with a cozinha (minimum ≈ 7 people/cozinha) out of the grey below-first-break
 * bin, so only municípios with no cozinha (or, defensively, unknown CadÚnico)
 * stay grey.
 */
const PESSOAS_COZINHA_THRESHOLDS = [1, 5000, 10000, 20000, 40000, 80000];

/**
 * Color ramp for the coverage choropleth — `PESSOAS_COZINHA_THRESHOLDS.length +
 * 1` steps. As with `CADUNICO_COLORS`, only index `1..` are painted (the
 * below-first-break bin uses `defaultColor`), so index `0` is vestigial.
 */
const PESSOAS_COZINHA_COLORS = sampleRamp(
  mapTokens.dataviz.color.sequential[1],
  PESSOAS_COZINHA_THRESHOLDS.length + 1
);

/**
 * Resolves the coverage-choropleth band color for a people-per-cozinha value
 * (see {@link colorForPercentual}). A `null` value (município missing from the
 * CadÚnico snapshot) or a município with no cozinha is grey.
 *
 * @param valor CadÚnico people per cozinha, or `null` when unknown.
 * @returns the CSS color of the band that value falls in.
 *
 * @example
 * colorForPessoasPorCozinha(null); // → WITHOUT_KITCHEN_COLOR
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
 * Id of the count-choropleth legend; also the fill's `activeLegendId` in
 * `coropletico` mode.
 *
 * @example
 * spec.legends?.find((legend) => legend.id === CHOROPLETH_LEGEND_ID);
 */
export const CHOROPLETH_LEGEND_ID = 'legenda-cozinhas';

/**
 * Id of the rate legend; also the fill's `activeLegendId` in rate mode.
 *
 * @example
 * spec.legends?.find((legend) => legend.id === RATE_LEGEND_ID);
 */
export const RATE_LEGEND_ID = 'legenda-taxa';

/**
 * Id of the share legend; also the fill's `activeLegendId` in share mode.
 *
 * @example
 * spec.legends?.find((legend) => legend.id === PERCENT_LEGEND_ID);
 */
export const PERCENT_LEGEND_ID = 'legenda-percentual';

/**
 * Id of the CadÚnico legend; also the fill's `activeLegendId` in that mode.
 *
 * @example
 * spec.legends?.find((legend) => legend.id === CADUNICO_LEGEND_ID);
 */
export const CADUNICO_LEGEND_ID = 'legenda-cadunico';

/**
 * Id of the coverage (people-per-cozinha) legend; also the fill's
 * `activeLegendId` in that mode.
 *
 * @example
 * spec.legends?.find((legend) => legend.id === PESSOAS_COZINHA_LEGEND_ID);
 */
export const PESSOAS_COZINHA_LEGEND_ID = 'legenda-pessoas-cozinha';

/** Title of the rate legend; also the fill's `activeLegendId` in rate mode. */
const RATE_LEGEND_TITLE = 'nº coz. no município / 100.000 hab.';

/** Title of the share legend; also the fill's `activeLegendId` in share mode. */
const PERCENT_LEGEND_TITLE = '% das cozinhas do Brasil no município';

/** Title of the CadÚnico legend; also the fill's `activeLegendId` in that mode. */
const CADUNICO_LEGEND_TITLE = 'nº coz. / 10 mil pessoas no CadÚnico';

/** Title of the coverage legend; also the fill's `activeLegendId` in that mode. */
const PESSOAS_COZINHA_LEGEND_TITLE = 'pessoas no CadÚnico por cozinha';

export const DOT_DENSITY_LEGEND_ID = 'legenda-cozinhas-pontos';

/**
 * Id of the município fill's own `activeLegendId` in `pontos` mode — kept
 * deliberately separate from {@link DOT_DENSITY_LEGEND_ID}. The adapter
 * resolves a polygon layer's `fill-color` from its `activeLegendId`'s
 * `colorBy` FIRST, only falling back to the layer's own explicit
 * `paint.fillColor` when that legend has no `colorBy` at all
 * (`legendFillColor ?? fp.fillColor` in `buildPolygon`) — so sharing one
 * legend id between the fill and the points would make the points' color
 * swatch leak onto the fill (or vice-versa) the moment either carries a
 * `colorBy`. This id's legend (`buildPontosFillLegend`) never gets one.
 *
 * @example
 * spec.legends?.find((legend) => legend.id === PONTOS_FILL_LEGEND_ID);
 */
export const PONTOS_FILL_LEGEND_ID = 'legenda-cozinhas-pontos-fill';

/**
 * Id of the categorical status legend; also the status points layer's
 * `activeLegendId` in `pontos-status` mode.
 *
 * @example
 * spec.legends?.find((legend) => legend.id === POINTS_STATUS_LEGEND_ID);
 */
export const POINTS_STATUS_LEGEND_ID = 'legenda-cozinhas-status';

/**
 * Point color for the "Habilitada" status — forest green reads as the active
 * state. Single origin for the map's `match` expression, the legend swatch,
 * and the tooltip swatch.
 */
export const HABILITADA_COLOR = mapTokens.dataviz.color.sequential[2][3];

/**
 * Point color for the "Não Habilitada" status — sienna/red reads as the
 * attention state. Single origin for the map's `match` expression, the legend
 * swatch, and the tooltip swatch.
 */
export const NAO_HABILITADA_COLOR = mapTokens.dataviz.color.sequential[5][6];

// /**
//  * Point color for the "Mapeada" status — orange indicates a mapped kitchen.
//  */
// const MAPEADA_COLOR = mapTokens.dataviz.color.sequential[4][5];

// /**
//  * Point color for the "Retirada" status — warm gray indicates a removed kitchen.
//  */
// const RETIRADA_COLOR = mapTokens.dataviz.color.categorical[1][7];

// /**
//  * Point color for the "Em análise" status — amber indicates pending analysis.
//  */
// const EM_ANALISE_COLOR = mapTokens.dataviz.color.sequential[3][2];

// /**
//  * Point color for the "Homologada para Habilitação" status — teal indicates
//  * approved for activation.
//  */
// const HOMOLOGADA_HABILITACAO_COLOR = mapTokens.dataviz.color.sequential[6][6];

// /**
//  * Point color for the "Pendência emitida pelo MDS" status — dusty purple
//  * indicates a pending issue.
//  */
// const PENDENCIA_MDS_COLOR = mapTokens.dataviz.color.categorical[1][3];

// /**
//  * Point color for the "Enviada para análise" status — steel blue indicates
//  * submitted for review.
//  */
// const ENVIADA_ANALISE_COLOR = mapTokens.dataviz.color.categorical[1][8];

// /**
//  * Point color for the "Homologada para Retirada" status — dark teal indicates
//  * approved for removal.
//  */
// const HOMOLOGADA_RETIRADA_COLOR = mapTokens.dataviz.color.sequential[6][10];

/**
 * Point color per cozinha status, drawn from the theme's categorical ramp:
 * forest green reads as the "active" state (Habilitada), sienna/clay as the
 * attention state (Não Habilitada). Drives both the map's `match` expression
 * (via the legend's `colorBy.mapping`) and the tooltip swatch, so they can
 * never drift.
 */
const SITUACAO_COLORS: Record<CozinhaSituacao, string> = {
  Habilitada: HABILITADA_COLOR,
  'Não Habilitada': NAO_HABILITADA_COLOR,
  // Mapeada: MAPEADA_COLOR,
  // Retirada: RETIRADA_COLOR,
  // 'Em análise': EM_ANALISE_COLOR,
  // 'Homologada para Habilitação': HOMOLOGADA_HABILITACAO_COLOR,
  // 'Pendência emitida pelo MDS (Prazo para adequações 15 dias)':
  //   PENDENCIA_MDS_COLOR,
  // 'Enviada para análise': ENVIADA_ANALISE_COLOR,
  // 'Homologada para Retirada': HOMOLOGADA_RETIRADA_COLOR,
};

/**
 * Resolves the point color for a cozinha status, mirroring the categorical
 * `match` expression that paints the status points (`SITUACAO_COLORS`) — so
 * the hover-tooltip swatch always matches the map. An unknown/absent status
 * resolves to the "sem dado" grey.
 *
 * @param situacao canonical status, or `null` when unknown.
 * @returns the CSS color of that status.
 *
 * @example
 * colorForSituacao('Habilitada'); // → SITUACAO_COLORS.Habilitada
 * colorForSituacao(null); // → WITHOUT_KITCHEN_COLOR
 */
export const colorForSituacao = (situacao: CozinhaSituacao | null): string => {
  if (situacao === null) {
    return WITHOUT_KITCHEN_COLOR;
  }
  return SITUACAO_COLORS[situacao];
};

/**
 * Must match `getProportionalCirclesAutoLegendId(spec)` from
 * `@ttoss/geovis`, which resolves to `${BUBBLES_MAP_DATA_ID}-legend`.
 * With an identical id, `mergeLegendsByIdOnly` merges the resolver's
 * `colorBy` into this legend while preserving our title/subtitle.
 * The resolver's `shouldAutoGenerateColorItems` returns false when the id
 * matches the auto-generated legend id (no choropleth-style color bands),
 * and `shouldShowCircleItems` returns true (circle-size reference rows).
 */
const BUBBLES_LEGEND_ID = 'cozinhas-bolhas-data-legend';

const DATA_REFERENCE = 'Fonte dos dados: © Cozinhas Solidárias';

/**
 * Legend swatches for the right sidebar, derived from the same `THRESHOLDS` and
 * `COLORS` that drive the choropleth — so the sidebar legend can never drift
 * from the map coloring.
 *
 * `COLORS[0]` (values `< 1`, i.e. zero) is folded into the "Sem cozinha" swatch
 * (the `defaultColor` used by municípios with no data), so the visible count
 * ranges start at `COLORS[1]`.
 *
 * @returns one `{ color, label }` per swatch, "Sem cozinha" first.
 *
 * @example
 * buildLegendItems()[0]; // → { color: WITHOUT_KITCHEN_COLOR, label: 'Sem cozinha' }
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
 * Swatch labels for the legend, derived from the same `THRESHOLDS`/`COLORS` as
 * the fill (via `buildLegendItems`) so they can never drift. Ordered to match
 * the quantitative bins geovis generates: index 0 is the `< 1` bin — which
 * resolves to `defaultColor` (`WITHOUT_KITCHEN_COLOR`) and so doubles as the
 * "Sem cozinha" swatch — followed by one label per threshold range.
 */
const LEGEND_BIN_LABELS = buildLegendItems().map((item) => {
  return item.label;
});

/**
 * The choropleth legend, configured entirely from the spec. Rendered only in
 * `coropletico` mode (see `buildLegends`). Outside that mode the fill layer
 * falls back to `fillColor: WITHOUT_KITCHEN_COLOR` on its paint.
 *
 * @returns the count-choropleth `LegendSpec`.
 *
 * @example
 * buildChoroplethLegend().id; // → CHOROPLETH_LEGEND_ID
 */
export const buildChoroplethLegend = (): LegendSpec => {
  return {
    id: CHOROPLETH_LEGEND_ID,
    title: 'Cozinhas por município',
    subtitle: 'Quanto mais escuro o município, mais cozinhas cadastradas ali.',
    position: 'bottom-right',
    colorBy: {
      type: 'quantitative',
      property: 'value',
      scale: 'threshold',
      thresholds: THRESHOLDS,
      colors: COLORS,
      defaultColor: WITHOUT_KITCHEN_COLOR,
    },
    labelFormat: { type: 'labels', labels: LEGEND_BIN_LABELS },
    reference: DATA_REFERENCE,
  };
};

/**
 * The rate-choropleth legend for `coropletico-taxa` mode. Shares the same
 * `COLORS` ramp as the count legend but uses `RATE_THRESHOLDS` and includes a
 * `noDataLabel` for municípios with unknown population.
 *
 * @returns the rate-choropleth `LegendSpec`.
 *
 * @example
 * buildRateLegend().noDataLabel; // → 'Sem dado'
 */
export const buildRateLegend = (): LegendSpec => {
  return {
    id: RATE_LEGEND_ID,
    title: RATE_LEGEND_TITLE,
    subtitle:
      'Quanto mais escuro o município, mais cozinhas por 100 mil habitantes.',
    position: 'bottom-right',
    colorBy: {
      type: 'quantitative',
      property: 'value',
      scale: 'threshold',
      thresholds: RATE_THRESHOLDS,
      colors: COLORS,
      defaultColor: WITHOUT_KITCHEN_COLOR,
    },
    labelFormat: { type: 'labels', labels: RATE_LEGEND_LABELS },
    noDataLabel: 'Sem dado',
    reference: 'Fontes: © Cozinhas Solidárias · IBGE (Censo 2022)',
  };
};

/**
 * The share-choropleth legend for `coropletico-percentual` mode. Uses
 * `PERCENT_THRESHOLDS` and `PERCENT_COLORS` so the legend matches the
 * percentual fill scale.
 *
 * @returns the share-choropleth `LegendSpec`.
 *
 * @example
 * buildPercentLegend().id; // → PERCENT_LEGEND_ID
 */
export const buildPercentLegend = (): LegendSpec => {
  return {
    id: PERCENT_LEGEND_ID,
    title: PERCENT_LEGEND_TITLE,
    subtitle:
      'Quanto mais escuro o município, maior a fatia das cozinhas do Brasil ali.',
    position: 'bottom-right',
    colorBy: {
      type: 'quantitative',
      property: 'value',
      scale: 'threshold',
      thresholds: PERCENT_THRESHOLDS,
      colors: PERCENT_COLORS,
      defaultColor: WITHOUT_KITCHEN_COLOR,
    },
    labelFormat: { type: 'labels', labels: PERCENT_LEGEND_LABELS },
    reference: DATA_REFERENCE,
  };
};

/**
 * The CadÚnico-choropleth legend for `coropletico-cadunico` mode. Uses
 * `CADUNICO_THRESHOLDS` and `CADUNICO_COLORS` so the legend matches the fill.
 *
 * @returns the CadÚnico-choropleth `LegendSpec`.
 *
 * @example
 * buildCadUnicoLegend().id; // → CADUNICO_LEGEND_ID
 */
export const buildCadUnicoLegend = (): LegendSpec => {
  return {
    id: CADUNICO_LEGEND_ID,
    title: CADUNICO_LEGEND_TITLE,
    subtitle:
      'Quanto mais escuro o município, mais cozinhas por 10 mil pessoas no CadÚnico.',
    position: 'bottom-right',
    colorBy: {
      type: 'quantitative',
      property: 'value',
      scale: 'threshold',
      thresholds: CADUNICO_THRESHOLDS,
      colors: CADUNICO_COLORS,
      defaultColor: WITHOUT_KITCHEN_COLOR,
    },
    labelFormat: { type: 'labels', labels: CADUNICO_LEGEND_LABELS },
    reference: 'Fontes: © Cozinhas Solidárias · MDS/SAGI (CadÚnico, jun/2026)',
  };
};

/**
 * The coverage-choropleth legend for `coropletico-pessoas-cozinha` mode. Uses
 * `PESSOAS_COZINHA_THRESHOLDS` and `PESSOAS_COZINHA_COLORS` so the legend
 * matches the fill.
 *
 * @returns the coverage-choropleth `LegendSpec`.
 *
 * @example
 * buildPessoasPorCozinhaLegend().id; // → PESSOAS_COZINHA_LEGEND_ID
 */
export const buildPessoasPorCozinhaLegend = (): LegendSpec => {
  return {
    id: PESSOAS_COZINHA_LEGEND_ID,
    title: PESSOAS_COZINHA_LEGEND_TITLE,
    subtitle:
      'Quanto mais escuro o município, mais pessoas do CadÚnico para cada cozinha.',
    position: 'bottom-right',
    colorBy: {
      type: 'quantitative',
      property: 'value',
      scale: 'threshold',
      thresholds: PESSOAS_COZINHA_THRESHOLDS,
      colors: PESSOAS_COZINHA_COLORS,
      defaultColor: WITHOUT_KITCHEN_COLOR,
    },
    labelFormat: { type: 'labels', labels: PESSOAS_COZINHA_LEGEND_LABELS },
    reference: 'Fontes: © Cozinhas Solidárias · MDS/SAGI (CadÚnico, jun/2026)',
  };
};

/**
 * The `dotDensity` legend for `pontos` mode. `resolveDotDensity` never
 * auto-generates a legend (each point carries no size/color-by value), so this
 * is hand-authored. The `dotDensity` resolver paints every point in its own
 * flat default color, so a single-color swatch would carry no information —
 * the legend is therefore **text-only**: no `colorBy`, just the explanatory
 * `subtitle` (`1 ponto = 1 cozinha`). `GeoVisLegend` renders a text-only
 * legend (title + subtitle + reference) whenever a `subtitle` is present.
 *
 * This is safe from the leak documented on {@link PONTOS_FILL_LEGEND_ID} only
 * because the município fill uses that OTHER id as its `activeLegendId` in
 * `pontos` mode — the two are never the same legend.
 *
 * @returns the dot-density `LegendSpec`.
 *
 * @example
 * buildDotDensityLegend().colorBy; // → undefined (text-only key)
 */
export const buildDotDensityLegend = (): LegendSpec => {
  return {
    id: DOT_DENSITY_LEGEND_ID,
    title: 'Localização das cozinhas',
    subtitle: '1 ponto = 1 cozinha',
    position: 'bottom-right',
    reference: DATA_REFERENCE,
  };
};

/**
 * The município fill's own legend for `pontos` mode — see
 * {@link PONTOS_FILL_LEGEND_ID} for why it must stay a SEPARATE id from
 * {@link buildDotDensityLegend}. Deliberately carries no `colorBy` and no
 * `position`: it exists only so the fill layer's `activeLegendId` resolves
 * to a real legend entry (enabling hover tracking) without the adapter
 * ever computing a legend-driven `fill-color` from it — `buildPolygon`
 * falls back to the layer's own explicit `paint.fillColor`
 * (`WITHOUT_KITCHEN_COLOR`) whenever the referenced legend has no
 * `colorBy`. Never rendered in the sidebar (no `position`).
 *
 * @returns the neutral fill `LegendSpec` for `pontos` mode.
 */
export const buildPontosFillLegend = (): LegendSpec => {
  return {
    id: PONTOS_FILL_LEGEND_ID,
    title: 'Cozinhas por município',
    reference: DATA_REFERENCE,
  };
};

/**
 * The categorical status legend for `pontos-status` mode. `colorBy.mapping`
 * drives both the legend swatches and the layer's `match` color expression
 * (the adapter reads the joined `situacao` from feature-state), so the legend
 * can never drift from the point colors. Statuses outside the mapping never
 * reach the map — the gateway transformer drops them.
 *
 * @returns the status points `LegendSpec`.
 *
 * @example
 * buildPointsStatusLegend().id; // → POINTS_STATUS_LEGEND_ID
 */
export const buildPointsStatusLegend = (): LegendSpec => {
  return {
    id: POINTS_STATUS_LEGEND_ID,
    title: 'Localização das cozinhas com status',
    subtitle: 'A cor do ponto indica a situação da cozinha.',
    position: 'bottom-right',
    colorBy: {
      type: 'categorical',
      property: 'value',
      mapping: { ...SITUACAO_COLORS },
      defaultColor: WITHOUT_KITCHEN_COLOR,
    },
    reference: DATA_REFERENCE,
  };
};

/**
 * The `proportionalCircles` legend for `circulos` mode. `BUBBLES_LEGEND_ID`
 * matches the resolver's auto-generated id so `mergeLegendsByIdOnly` merges
 * them into one legend: the resolver's `colorBy` (all bins same color) is
 * injected, `shouldAutoGenerateColorItems` suppresses color bands, and
 * `shouldShowCircleItems` renders the circle-size reference rows.
 *
 * @returns the proportional-circles `LegendSpec`.
 *
 * @example
 * buildBubblesLegend().id; // → 'cozinhas-bolhas-data-legend'
 */
export const buildBubblesLegend = (): LegendSpec => {
  return {
    id: BUBBLES_LEGEND_ID,
    title: 'Cozinhas por município',
    subtitle: 'O tamanho do círculo indica a quantidade de cozinhas.',
    position: 'bottom-right',
    reference: DATA_REFERENCE,
  };
};
