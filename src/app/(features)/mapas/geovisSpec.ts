import type {
  GeoJSONSource,
  HoverTooltipConfig,
  MapData,
  MapDataRow,
  VisualizationLayer,
  VisualizationSpec,
} from '@ttoss/geovis';

import type { kitchenByCity, kitchenRateByCity } from '@/data-gateway/schema';

import { buildLegends, legendIdForMode, type MapMode } from './geovisScales';

/** Re-exported so consumers keep importing the map's mode type from here. */
export type { MapMode };

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
 * Maps per-município shares (%) to geovis `mapData` value rows. Every row is
 * kept — `percentualDoBrasil` is never `null` — so municípios absent from the
 * data (no cozinha) are the only ones that fall back to the legend's
 * `defaultColor` ("sem cozinha").
 */
const toPercentRows = (byCity: kitchenRateByCity[]): MapDataRow[] => {
  return byCity.map((register) => {
    return {
      geometryId: register.codigoIbge,
      value: register.percentualDoBrasil,
    };
  });
};

/**
 * Maps per-município CadÚnico rates to geovis `mapData` value rows, dropping
 * municípios with an unknown rate (`porDezMilCadUnico === null`) so they fall
 * back to the legend's `defaultColor` ("sem dado") instead of a low rate.
 */
const toCadUnicoRows = (byCity: kitchenRateByCity[]): MapDataRow[] => {
  return byCity.flatMap((register) => {
    return register.porDezMilCadUnico === null
      ? []
      : [
          {
            geometryId: register.codigoIbge,
            value: register.porDezMilCadUnico,
          },
        ];
  });
};

/**
 * Maps per-município people-per-cozinha values to geovis `mapData` value rows,
 * dropping municípios with an unknown value (`pessoasPorCozinha === null`) so
 * they fall back to the legend's `defaultColor` ("sem dado").
 */
const toPessoasPorCozinhaRows = (byCity: kitchenRateByCity[]): MapDataRow[] => {
  return byCity.flatMap((register) => {
    return register.pessoasPorCozinha === null
      ? []
      : [
          {
            geometryId: register.codigoIbge,
            value: register.pessoasPorCozinha,
          },
        ];
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
    activeLegendId: legendIdForMode(mode),
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

/**
 * Assembles the full geovis {@link VisualizationSpec} for the given data and
 * mode. The choropleth value rows depend on the mode: raw counts in
 * `coropletico`, the per-100k-inhabitants rate in `coropletico-taxa`, the share
 * (%) of Brazil in `coropletico-percentual`, the per-10k-CadÚnico rate in
 * `coropletico-cadunico`, the people-per-cozinha value in
 * `coropletico-pessoas-cozinha`, and nothing in the overlay modes (`pontos`,
 * `circulos`), where every município falls back to the legend's `defaultColor`.
 *
 * @param byCity - Per-município canonical rows (from the gateway).
 * @param mode - Active {@link MapMode}. Defaults to `'coropletico'`.
 * @param hoverTooltipRender - Optional spec-driven hover-tooltip renderer.
 * @returns The geovis visualization spec (sources, mapData, legends, layers).
 *
 * @example
 * buildSpec(byCity, 'coropletico-taxa');
 */
export const buildSpec = (
  byCity: kitchenRateByCity[],
  mode: MapMode = 'coropletico',
  hoverTooltipRender?: HoverTooltipConfig['render']
): VisualizationSpec => {
  const showPoints = mode === 'pontos';
  const showBubbles = mode === 'circulos';

  const choroplethRows =
    mode === 'coropletico'
      ? toValueRows(byCity)
      : mode === 'coropletico-taxa'
        ? toRateRows(byCity)
        : mode === 'coropletico-percentual'
          ? toPercentRows(byCity)
          : mode === 'coropletico-cadunico'
            ? toCadUnicoRows(byCity)
            : mode === 'coropletico-pessoas-cozinha'
              ? toPessoasPorCozinhaRows(byCity)
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
