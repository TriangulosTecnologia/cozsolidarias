import type {
  GeoJSONSource,
  HoverTooltipConfig,
  LegendSpec,
  MapType,
  VisualizationLayer,
  VisualizationSpec,
} from '@ttoss/geovis';

import type {
  CozinhasFeatureCollection,
  CozinhasStatusFeatureCollection,
  kitchenRateByCity,
  MunicipioIvs,
} from '@/data-gateway/schema';

import {
  BUBBLES_COLOR,
  buildBubblesLegend,
  buildCadUnicoLegend,
  buildChoroplethLegend,
  buildDotDensityLegend,
  buildIvsLegend,
  buildPercentLegend,
  buildPessoasPorCozinhaLegend,
  buildPointsStatusLegend,
  buildRateLegend,
  CADUNICO_LEGEND_ID,
  CHOROPLETH_LEGEND_ID,
  DOT_DENSITY_LEGEND_ID,
  IVS_CAPITAL_LEGEND_ID,
  IVS_INFRA_LEGEND_ID,
  IVS_LEGEND_ID,
  IVS_RENDA_LEGEND_ID,
  PERCENT_LEGEND_ID,
  PESSOAS_COZINHA_LEGEND_ID,
  POINTS_STATUS_LEGEND_ID,
  RATE_LEGEND_ID,
  WITHOUT_KITCHEN_COLOR,
} from './legendsBuilders';
import {
  BUBBLES_SOURCE_ID,
  buildMapData,
  CHOROPLETH_MAP_DATA_ID,
  CHOROPLETH_SOURCE_ID,
  type MapMode,
  POINTS_MAP_DATA_ID,
  POINTS_SOURCE_ID,
  POINTS_STATUS_MAP_DATA_ID,
  POINTS_STATUS_SOURCE_ID,
} from './mapDataBuilders';

export {
  buildLegendItems,
  colorForCadUnico,
  colorForIvs,
  colorForPercentual,
  colorForPessoasPorCozinha,
  colorForQuantidade,
  colorForSituacao,
  colorForTaxa,
  HABILITADA_COLOR,
  ivsFaixaLabel,
  NAO_HABILITADA_COLOR,
} from './legendsBuilders';
export type { MapMode } from './mapDataBuilders';

/**
 * The plain-points layer for `pontos` mode. Renders one circle per cozinha
 * location with uniform color, left at the `dotDensity` resolver's defaults
 * (`circleColor`/`circleRadius`/etc.) — no `paint` override needed since every
 * point looks the same. `hoverTooltip` is a ready-made config (render + style),
 * built by callers via `toHoverTooltip` in `mapaTooltips` — this module only
 * plumbs it onto the layer.
 */
const buildPointsLayer = (
  hoverTooltip?: HoverTooltipConfig
): VisualizationLayer => {
  return {
    id: 'cozinhas-pts',
    sourceId: POINTS_SOURCE_ID,
    geometry: 'point',
    mapDataId: POINTS_MAP_DATA_ID,
    activeLegendId: DOT_DENSITY_LEGEND_ID,
    hoverTooltip,
  };
};

/**
 * The status-colored points layer for `pontos-status` mode. No `paint` is
 * declared: the `dotDensity` resolver's own circle defaults (radius, opacity,
 * stroke) apply untouched, and `circleColor` is left for the status legend's
 * categorical `match` expression (over the joined `situacao` feature-state) to
 * drive — an explicit `paint.circleColor` here would silently win over it.
 */
const buildPointsStatusLayer = (
  hoverTooltip?: HoverTooltipConfig
): VisualizationLayer => {
  return {
    id: 'cozinhas-status-pts',
    sourceId: POINTS_STATUS_SOURCE_ID,
    geometry: 'point',
    mapDataId: POINTS_STATUS_MAP_DATA_ID,
    activeLegendId: POINTS_STATUS_LEGEND_ID,
    hoverTooltip,
  };
};

/**
 * Radius range (px) for the proportional circles. geovis' own default is
 * `[4, 16]` (`PROPORTIONAL_CIRCLES_DEFAULTS` in
 * `resolveProportionalCircles`); `[4, 38]` matches the range the previous
 * hand-rolled `circulos` layer used, kept here for visual continuity.
 */
const BUBBLES_RADIUS_RANGE: [number, number] = [4, 38];

/**
 * Overrides `resolveProportionalCircles`'s auto-generated point layer for
 * `circulos` mode. Only `sourceId`/`geometry` need to match (`mergeResolvedLayers`
 * matches on those, not `id`) — `mapDataId`/`activeLegendId`/`hoverPaint`/etc.
 * still come from the resolved layer since this one omits them.
 *
 * The whole point of this override is `sizeBy`: `injectResolvedFields` only
 * fills a field from the resolved layer when the user layer LACKS it, so once
 * we declare `sizeBy` here the library's default (`range: [4, 16]`) never
 * merges in — our `BUBBLES_RADIUS_RANGE` ([4, 38]) fully wins.
 *
 * Both keys are load-bearing and irreducible:
 * - `range: [4, 38]` sets the min/max circle radius in PIXELS. `scaleMaxValue`
 *   cannot substitute for it: `scaleMaxValue` only picks WHICH data value maps
 *   to the maximum radius (`range[1]`), not the maximum radius itself, so with
 *   the default range circles would still cap at 16px however it's tuned.
 * - `transform: 'sqrt'` is what makes the adapter take the `scaleMaxValue`
 *   proportional-ceiling path (`usesProportionalCeiling` requires it); drop it
 *   and `scaleMaxValue` is ignored and sizing falls back to legend thresholds.
 *
 * The hover tooltip is attached HERE (not on the fill) in `circulos` mode so
 * hovering fires from the circles themselves. The circle features resolve
 * their ids from `codarea` — geovis derives the source's `promoteId` from the
 * bubbles `mapData` entry's `joinKey` (`resolvePromoteIdForSource`) — so the
 * tooltip callback's `info.featureId` → município lookup works unchanged.
 */
const buildBubblesOverrideLayer = (
  hoverTooltip?: HoverTooltipConfig
): VisualizationLayer => {
  return {
    id: 'cozinhas-bolhas-overrides',
    sourceId: BUBBLES_SOURCE_ID,
    geometry: 'point',
    sizeBy: { range: BUBBLES_RADIUS_RANGE, transform: 'sqrt' },
    paint: { circleColor: BUBBLES_COLOR },
    hoverTooltip,
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
    id: POINTS_SOURCE_ID,
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
  {
    id: POINTS_STATUS_SOURCE_ID,
    type: 'geojson',
    data: '/api/cozinhas/status',
    attribution: '© Cozinhas Solidárias',
  },
];

/**
 * Legend builders keyed by the mode they serve. Each mode returns only its own
 * legend; modes that share no legend with any other mode each get their own
 * builder. The four IVS-family modes share `buildIvsLegend`, varying only the
 * id. `coropletico` has no entry — it falls back to `buildChoroplethLegend` in
 * `buildLegends`.
 */
const LEGEND_BUILDER_BY_MODE: Partial<Record<MapMode, () => LegendSpec>> = {
  pontos: buildDotDensityLegend,
  'pontos-status': buildPointsStatusLegend,
  circulos: buildBubblesLegend,
  'coropletico-taxa': buildRateLegend,
  'coropletico-percentual': buildPercentLegend,
  'coropletico-cadunico': buildCadUnicoLegend,
  'coropletico-pessoas-cozinha': buildPessoasPorCozinhaLegend,
  'coropletico-ivs': () => {
    return buildIvsLegend(IVS_LEGEND_ID);
  },
  'coropletico-ivs-infraestrutura': () => {
    return buildIvsLegend(IVS_INFRA_LEGEND_ID);
  },
  'coropletico-ivs-capital-humano': () => {
    return buildIvsLegend(IVS_CAPITAL_LEGEND_ID);
  },
  'coropletico-ivs-renda-trabalho': () => {
    return buildIvsLegend(IVS_RENDA_LEGEND_ID);
  },
};

/** Builds legends for the given mode via `LEGEND_BUILDER_BY_MODE`. */
const buildLegends = (mode: MapMode): LegendSpec[] => {
  const build = LEGEND_BUILDER_BY_MODE[mode] ?? buildChoroplethLegend;
  return [build()];
};

/**
 * Fill layer's `activeLegendId` per mode. Choropleth modes resolve to their
 * legend so the adapter drives data-driven paint; overlay modes resolve to the
 * mode's own legend so geovis renders it, while the adapter falls back to
 * `fillColor` for the paint (no `colorBy` on the fill).
 */
const FILL_LEGEND_ID_BY_MODE: { [key in MapMode]: string | undefined } = {
  coropletico: CHOROPLETH_LEGEND_ID,
  'coropletico-taxa': RATE_LEGEND_ID,
  'coropletico-percentual': PERCENT_LEGEND_ID,
  'coropletico-cadunico': CADUNICO_LEGEND_ID,
  'coropletico-pessoas-cozinha': PESSOAS_COZINHA_LEGEND_ID,
  'coropletico-ivs': IVS_LEGEND_ID,
  'coropletico-ivs-infraestrutura': IVS_INFRA_LEGEND_ID,
  'coropletico-ivs-capital-humano': IVS_CAPITAL_LEGEND_ID,
  'coropletico-ivs-renda-trabalho': IVS_RENDA_LEGEND_ID,
  pontos: DOT_DENSITY_LEGEND_ID,
  'pontos-status': POINTS_STATUS_LEGEND_ID,
  circulos: undefined,
};

/**
 * The município fill layer — always present so the hover tooltip (which tracks
 * layers with an `activeLegendId`) works in choropleth modes.
 *
 * In choropleth modes (`coropletico*`) the fill declares the matching legend
 * id so the adapter resolves its data-driven paint. In overlay modes
 * (`pontos`, `pontos-status`, `circulos`) `activeLegendId` is `undefined` —
 * the adapter falls back to `fillColor: WITHOUT_KITCHEN_COLOR`, keeping the
 * map background neutral without rendering a choropleth legend.
 *
 * In `circulos` mode the tooltip moves to the overlay layer (see
 * `buildBubblesOverrideLayer`), so the fill deliberately drops its
 * `hoverTooltip` there — hovering a município without touching a circle shows
 * nothing, which is the intent: the circles are the data in that mode.
 */
const buildFillLayer = (
  mode: MapMode,
  hoverTooltip?: HoverTooltipConfig
): VisualizationLayer => {
  return {
    id: 'municipios-br-fill',
    sourceId: CHOROPLETH_SOURCE_ID,
    geometry: 'polygon',
    mapDataId: CHOROPLETH_MAP_DATA_ID,
    activeLegendId: FILL_LEGEND_ID_BY_MODE[mode],
    paint: {
      fillOpacity: 1,
      lineColor: '#FAF9F7',
      fillColor: WITHOUT_KITCHEN_COLOR,
    },
    hoverTooltip: mode === 'circulos' ? undefined : hoverTooltip,
  };
};

/** Pre-configured geovis `mapType` for each visualization mode. */
const MAP_TYPE_BY_MODE: { [key in MapMode]: MapType } = {
  coropletico: 'choropleth',
  'coropletico-taxa': 'choropleth',
  'coropletico-percentual': 'choropleth',
  'coropletico-cadunico': 'choropleth',
  'coropletico-pessoas-cozinha': 'choropleth',
  'coropletico-ivs': 'choropleth',
  'coropletico-ivs-infraestrutura': 'choropleth',
  'coropletico-ivs-capital-humano': 'choropleth',
  'coropletico-ivs-renda-trabalho': 'choropleth',
  pontos: 'dotDensity',
  'pontos-status': 'dotDensity',
  circulos: 'proportionalCircles',
};

/**
 * Builds the full geovis `VisualizationSpec` for the mapas page: sources,
 * per-mode `mapData` (via `buildMapData`), per-mode legends (via
 * `buildLegends`) and layers, pre-configured from the mode's `mapType`.
 *
 * The choropleth value rows depend on the mode: raw counts in `coropletico`,
 * the per-100k-inhabitants rate in `coropletico-taxa`, the share (%) of Brazil
 * in `coropletico-percentual`, the per-10k-CadÚnico rate in
 * `coropletico-cadunico`, the people-per-cozinha value in
 * `coropletico-pessoas-cozinha`, the overall IVS in `coropletico-ivs` and each
 * IVS sub-index in `coropletico-ivs-infraestrutura` / `-capital-humano` /
 * `-renda-trabalho` (read from `ivsByCity`), and nothing in the overlay modes
 * (`pontos`, `pontos-status`, `circulos`).
 *
 * Invariants: the município fill layer is always present; the points overlay
 * exists only in `pontos` mode; the status points overlay only in
 * `pontos-status` mode; the circles override only in `circulos` mode, which is
 * also the only mode carrying `scaleMaxValue`.
 *
 * @returns the spec consumed by `<GeovisWorkspace>`.
 *
 * `fillHoverTooltip`/`pontosHoverTooltip`/`pontosStatusHoverTooltip` are
 * ready-made `HoverTooltipConfig` objects (render + shared card style) built
 * by callers via `toHoverTooltip` in `mapaTooltips` — this module only plumbs
 * them onto the matching layer, it never constructs tooltip style itself.
 *
 * @example
 * const spec = buildSpec({ byCity, mode: 'circulos', fillHoverTooltip: toHoverTooltip(renderTooltip) });
 * @example
 * const spec = buildSpec({ byCity, mode: 'coropletico-ivs', ivsByCity });
 */
export const buildSpec = (
  {
    byCity,
    mode = 'coropletico',
    fillHoverTooltip,
    cozinhas,
    cozinhasStatus,
    pontosHoverTooltip,
    pontosStatusHoverTooltip,
    ivsByCity,
  }: {
    byCity: kitchenRateByCity[];
    mode?: MapMode;
    fillHoverTooltip?: HoverTooltipConfig;
    cozinhas?: CozinhasFeatureCollection;
    cozinhasStatus?: CozinhasStatusFeatureCollection;
    pontosHoverTooltip?: HoverTooltipConfig;
    pontosStatusHoverTooltip?: HoverTooltipConfig;
    ivsByCity?: MunicipioIvs[];
  } = {} as {
    byCity: kitchenRateByCity[];
  }
): VisualizationSpec => {
  const showPoints = mode === 'pontos';
  const showPointsStatus = mode === 'pontos-status';
  const showBubbles = mode === 'circulos';

  // Bounds for the circle-size scale: the largest per-município count. Falls
  // back to 1 when there's no data so the circles layer can still clamp it.
  const maxQuantidade = byCity.reduce((max, register) => {
    return Math.max(max, register.quantidade);
  }, 1);

  return {
    engine: 'maplibre',
    mapType: MAP_TYPE_BY_MODE[mode],
    view: {
      center: [-53.0, -14.5],
      zoom: 4,
    },
    basemap: { labels: false },
    sources: SOURCES,
    mapData: buildMapData({
      byCity,
      mode,
      cozinhas,
      cozinhasStatus,
      ivsByCity,
    }),
    legends: buildLegends(mode),
    layers: [
      buildFillLayer(mode, fillHoverTooltip),
      ...(showPoints ? [buildPointsLayer(pontosHoverTooltip)] : []),
      ...(showPointsStatus
        ? [buildPointsStatusLayer(pontosStatusHoverTooltip)]
        : []),
      ...(showBubbles ? [buildBubblesOverrideLayer(fillHoverTooltip)] : []),
    ],
    ...(showBubbles ? { scaleMaxValue: maxQuantidade } : {}),
  };
};
