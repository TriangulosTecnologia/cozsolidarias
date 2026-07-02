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
import type { kitchenByCity } from '@/data-gateway/schema';

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
 * - `coropletico`: data-driven choropleth (cozinhas por município);
 * - `pontos`: flat background so the individual kitchen points stand out;
 * - `circulos`: flat background with one proportional circle per município
 *   (radius encodes the kitchen count).
 *
 * The fill, the municipality/state borders and the background color stay the
 * same across modes — only the data coloring and the points/circles overlays
 * change.
 */
export type MapMode = 'coropletico' | 'pontos' | 'circulos';

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
  ];
};

/** Maps per-município counts to geovis `mapData` value rows. */
const toValueRows = (byCity: kitchenByCity[]): MapDataRow[] => {
  return byCity.map((register) => {
    return { geometryId: register.codigoIbge, value: register.quantidade };
  });
};

/**
 * The município fill layer — identical across modes (keeps its `mapDataId` +
 * `activeLegendId`), so the hover tooltip, which only tracks polygon layers
 * with an `activeLegendId`, keeps working everywhere. Only the *data* fed to it
 * changes between modes.
 */
const buildFillLayer = (
  hoverTooltipRender?: HoverTooltipConfig['render']
): VisualizationLayer => {
  return {
    id: 'municipios-br-fill',
    sourceId: 'municipios-boundary',
    geometry: 'polygon',
    mapDataId: 'cozinhas-por-municipio',
    activeLegendId: 'legenda-cozinhas',
    paint: {
      fillOpacity: 1,
      lineColor: '#FAF9F7',
    },
    // Spec-driven tooltip: `<GeoVisProvider>` renders the `<GeoVisHoverTooltip>`
    // itself, so it works inside the closed `<GeovisWorkspace>` (no children).
    ...(hoverTooltipRender
      ? { hoverTooltip: { render: hoverTooltipRender } }
      : {}),
  };
};

export const buildSpec = (
  byCity: kitchenByCity[],
  mode: MapMode = 'coropletico',
  hoverTooltipRender?: HoverTooltipConfig['render']
): VisualizationSpec => {
  const showPoints = mode === 'pontos';
  const showBubbles = mode === 'circulos';

  // Outside `coropletico` mode we feed the choropleth nothing, so every
  // município falls back to the legend's `defaultColor` (`WITHOUT_KITCHEN_COLOR`)
  // — the same flat background the no-kitchen municipalities already show.
  const choroplethData = mode === 'coropletico' ? byCity : [];

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
        data: toValueRows(choroplethData),
      },
      ...bubblesMapData,
    ],
    legends: buildLegends(mode),
    layers: [
      buildFillLayer(hoverTooltipRender),
      ...(showPoints ? [POINTS_LAYER] : []),
      ...(showBubbles ? [buildBubblesLayer(maxQuantidade)] : []),
    ],
  };
};
