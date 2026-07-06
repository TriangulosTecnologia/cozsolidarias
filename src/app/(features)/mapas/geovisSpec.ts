import type {
  GeoJSONSource,
  HoverTooltipConfig,
  LegendSpec,
  MapData,
  MapDataRow,
  VisualizationLayer,
  VisualizationSpec,
} from '@ttoss/geovis';

import { mapTokens } from '@/config/theme';
import type { kitchenByCity, kitchenRateByCity } from '@/data-gateway/schema';

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
 * Card styling for the spec-driven hover tooltip — a warm ivory surface with a
 * subtle border and elevation so it reads as a floating card above the map.
 * Values reference the Chakra design tokens (exposed as `--chakra-*` custom
 * properties on the document root by `<ChakraProvider>`), keeping the tooltip in
 * step with the app's visual language. The tooltip *content* (name + count) is
 * built with Chakra components in `MapaPlayground`.
 */
const TOOLTIP_STYLE: NonNullable<HoverTooltipConfig['style']> = {
  background: 'var(--chakra-colors-ivory-50)',
  color: 'var(--chakra-colors-charcoal-900)',
  border: '1px solid var(--chakra-colors-ivory-300)',
  borderRadius: 'var(--chakra-radii-lg)',
  boxShadow: '0 4px 16px rgba(36, 31, 33, 0.12)',
  padding: 'var(--chakra-spacing-2) var(--chakra-spacing-3)',
  zIndex: 50,
};

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
 * What the municipality fill encodes:
 * - `coropletico`: data-driven choropleth (cozinhas por município, raw count);
 * - `coropletico-taxa`: data-driven choropleth of the cozinhas-per-100k-
 *   inhabitants rate (darker = higher density);
 * - `pontos`: flat background so the individual kitchen points stand out;
 * - `circulos`: flat background with one proportional circle per município
 *   (radius encodes the kitchen count).
 *
 * The fill, the municipality/state borders and the background color stay the
 * same across modes — only the data coloring and the points/circles overlays
 * change.
 */
export type MapMode =
  | 'coropletico'
  | 'coropletico-taxa'
  | 'pontos'
  | 'circulos';

/**
 * The kitchen points layer. Static (no data-driven paint), so it lives at module
 * scope and is only appended to the spec's `layers` in `pontos` mode.
 */
const POINTS_LAYER = {
  id: 'cozinhas-pts',
  sourceId: 'cozinhas',
  geometry: 'point',
  paint: {
    circleColor: '#E4572E',
    circleRadius: 2.4,
    circleOpacity: 0.7,
    circleStrokeColor: '#FAF9F7',
    circleStrokeWidth: 0.5,
  },
} as const;

/** GeoJSON source + join key for the proportional-circle (bubble) overlay. */
const BUBBLES_SOURCE_ID = 'cozinhas-bubbles';
const BUBBLES_MAP_DATA_ID = 'cozinhas-bolhas-data';

/**
 * Builds the proportional-circle layer. `sizeBy` reads its value from the
 * feature-state populated by the `BUBBLES_MAP_DATA_ID` join (geovis drives
 * `circle-radius` off `["feature-state", "value"]`), so the layer must carry
 * `mapDataId`. `transform: 'sqrt'` makes the circle *area* — not the radius —
 * proportional to the count, and `thresholds` set the data bounds the radius
 * range maps across (`[1, maxQuantidade]`, clamped so it's strictly ascending).
 */
const buildBubblesLayer = (maxQuantidade: number): VisualizationLayer => {
  return {
    id: 'cozinhas-bolhas',
    sourceId: BUBBLES_SOURCE_ID,
    geometry: 'point',
    mapDataId: BUBBLES_MAP_DATA_ID,
    paint: {
      circleColor: '#E4572E',
      circleOpacity: 0.75,
      circleStrokeColor: '#FAF9F7',
      circleStrokeWidth: 0.6,
    },
    sizeBy: {
      range: [4, 38],
      transform: 'sqrt',
      thresholds: [1, Math.max(maxQuantidade, 2)],
    },
  };
};

/**
 * Map sources. The bubble source is always declared (not gated on the active
 * mode) so MapLibre fetches its GeoJSON once at mount, like `cozinhas` — the
 * circle overlay then paints already-loaded data instead of waiting on a
 * round-trip when the user switches to `circulos`.
 */
const SOURCES: GeoJSONSource[] = [
  {
    id: 'cozinhas',
    type: 'geojson',
    data: '/api/cozinhas',
    attribution: '© Cozinhas Solidárias',
  },
  {
    id: BUBBLES_SOURCE_ID,
    type: 'geojson',
    data: '/api/cozinhas/bolhas',
    attribution: '© Cozinhas Solidárias',
  },
];

const CHOROPLETH_LEGEND_ID = 'legenda-cozinhas';
const RATE_LEGEND_ID = 'legenda-taxa';

/** Title of the rate legend; also the fill's `activeLegendId` in rate mode. */
const RATE_LEGEND_TITLE = 'nº coz. no município / 100.000 hab.';

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
 * The choropleth legend, configured entirely from the spec. `geovis`'
 * `GeoVisProvider` auto-renders any legend that carries a `position`, so this
 * appears as an overlay on the map with no extra wiring.
 *
 * Only `coropletico` mode encodes the count in the fill color, so the legend is
 * only positioned (and therefore only rendered) there. In the other modes the
 * same `colorBy` still drives the fill/tooltip, but the omitted `position`
 * keeps the legend hidden.
 */
const buildLegends = (mode: MapMode): LegendSpec[] => {
  return [
    {
      id: CHOROPLETH_LEGEND_ID,
      title: 'Cozinhas por município',
      subtitle:
        'Quanto mais escuro o município, mais cozinhas cadastradas ali.',
      ...(mode === 'coropletico' ? { position: 'bottom-right' as const } : {}),
      colorBy: {
        type: 'quantitative',
        property: 'value',
        scale: 'threshold',
        thresholds: THRESHOLDS,
        colors: COLORS,
        defaultColor: WITHOUT_KITCHEN_COLOR,
      },
      labelFormat: { type: 'labels', labels: LEGEND_BIN_LABELS },
      reference: 'Fonte dos dados: © Cozinhas Solidárias',
    },
    {
      id: RATE_LEGEND_ID,
      title: RATE_LEGEND_TITLE,
      subtitle:
        'Quanto mais escuro o município, mais cozinhas por 100 mil habitantes.',
      ...(mode === 'coropletico-taxa'
        ? { position: 'bottom-right' as const }
        : {}),
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
    },
  ];
};

/** Maps per-município counts to geovis `mapData` value rows. */
const toValueRows = (byCity: kitchenByCity[]): MapDataRow[] => {
  return byCity.map((register) => {
    return { geometryId: register.codigoIbge, value: register.quantidade };
  });
};

/**
 * Maps per-município rates to geovis `mapData` value rows, dropping municípios
 * with an unknown rate (`porCemMil === null`) so they fall back to the legend's
 * `defaultColor` ("sem dado") instead of being colored as a low rate.
 */
const toRateRows = (byCity: kitchenRateByCity[]): MapDataRow[] => {
  return byCity.flatMap((register) => {
    return register.porCemMil === null
      ? []
      : [{ geometryId: register.codigoIbge, value: register.porCemMil }];
  });
};

/**
 * The município fill layer — identical across modes (keeps its `mapDataId` +
 * `activeLegendId`), so the hover tooltip, which only tracks polygon layers
 * with an `activeLegendId`, keeps working everywhere. Only the *data* fed to it
 * changes between modes.
 */
const buildFillLayer = (
  mode: MapMode,
  hoverTooltipRender?: HoverTooltipConfig['render']
): VisualizationLayer => {
  return {
    id: 'municipios-br-fill',
    sourceId: 'municipios-boundary',
    geometry: 'polygon',
    mapDataId: 'cozinhas-por-municipio',
    activeLegendId:
      mode === 'coropletico-taxa' ? RATE_LEGEND_ID : CHOROPLETH_LEGEND_ID,
    paint: {
      fillOpacity: 1,
      lineColor: '#FAF9F7',
    },
    // Spec-driven tooltip: `<GeoVisProvider>` renders the `<GeoVisHoverTooltip>`
    // itself, so it works inside the closed `<GeovisWorkspace>` (no children).
    ...(hoverTooltipRender
      ? { hoverTooltip: { render: hoverTooltipRender, style: TOOLTIP_STYLE } }
      : {}),
  };
};

export const buildSpec = (
  byCity: kitchenRateByCity[],
  mode: MapMode = 'coropletico',
  hoverTooltipRender?: HoverTooltipConfig['render']
): VisualizationSpec => {
  const showPoints = mode === 'pontos';
  const showBubbles = mode === 'circulos';

  // The choropleth value rows depend on the mode: raw counts in `coropletico`,
  // the per-100k rate in `coropletico-taxa`. In the overlay modes (`pontos`,
  // `circulos`) we feed the choropleth nothing, so every município falls back to
  // the legend's `defaultColor` (`WITHOUT_KITCHEN_COLOR`) — the same flat
  // background the no-kitchen municipalities already show.
  const choroplethRows =
    mode === 'coropletico'
      ? toValueRows(byCity)
      : mode === 'coropletico-taxa'
        ? toRateRows(byCity)
        : [];

  // Bounds for the circle-size scale: the largest per-município count. Falls
  // back to 1 when there's no data so `buildBubblesLayer` can still clamp it.
  const maxQuantidade = byCity.reduce((max, register) => {
    return Math.max(max, register.quantidade);
  }, 1);

  // Joins the kitchen count to each bubble feature (`codarea`), feeding the
  // `sizeBy` scale via feature-state.
  //
  // ALWAYS present, even outside `circulos` mode: the bubble source is added to
  // the map at mount (it lives in `SOURCES` unconditionally), and the adapter
  // resolves the source's MapLibre `promoteId` from whichever `mapData` entry
  // targets it *at add time* — that promoted `feature.id` (`codarea`) is what
  // `setFeatureState` keys the join value on. If this entry only appeared in
  // `circulos` mode, the source would already be on the map without a
  // `promoteId`, and switching modes never re-adds it, so the join value would
  // never attach and every circle would collapse to the fallback radius.
  // Declaring it always makes the source pick up `promoteId: 'codarea'` at
  // mount; the bubble *layer* below stays gated on the mode, so nothing renders
  // outside `circulos`.
  const bubblesMapData: MapData[] = [
    {
      mapDataId: BUBBLES_MAP_DATA_ID,
      mapId: BUBBLES_SOURCE_ID,
      joinKey: 'codarea',
      title: 'Cozinhas por município',
      data: toValueRows(byCity),
    },
  ];

  return {
    id: 'mapa-cozinhas-sp',
    engine: 'maplibre',
    view: {
      center: [-53.0, -14.5],
      zoom: 4,
    },
    basemap: { labels: false },
    sources: SOURCES,
    mapData: [
      {
        mapDataId: 'cozinhas-por-municipio',
        mapId: 'municipios-boundary',
        joinKey: 'codarea',
        title: 'Cozinhas por município',
        data: choroplethRows,
      },
      ...bubblesMapData,
    ],
    legends: buildLegends(mode),
    layers: [
      buildFillLayer(mode, hoverTooltipRender),
      ...(showPoints ? [POINTS_LAYER] : []),
      ...(showBubbles ? [buildBubblesLayer(maxQuantidade)] : []),
    ],
  };
};
