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
  buildIvsLegend,
  IVS_CAPITAL_LEGEND_ID,
  IVS_INFRA_LEGEND_ID,
  IVS_LEGEND_ID,
  IVS_RENDA_LEGEND_ID,
} from './ivsLegends';
import {
  BUBBLES_CIRCLE_OPACITY,
  BUBBLES_COLOR,
  buildBubblesLegend,
  buildCadUnicoLegend,
  buildChoroplethLegend,
  buildDotDensityLegend,
  buildPercentLegend,
  buildPessoasPorCozinhaLegend,
  buildPointsStatusLegend,
  buildPontosFillLegend,
  buildRateLegend,
  CADUNICO_LEGEND_ID,
  CHOROPLETH_LEGEND_ID,
  PERCENT_LEGEND_ID,
  PESSOAS_COZINHA_LEGEND_ID,
  POINTS_STATUS_LEGEND_ID,
  PONTOS_FILL_LEGEND_ID,
  RATE_LEGEND_ID,
  WITHOUT_KITCHEN_COLOR,
} from './legendsBuilders';
import {
  BUBBLES_SOURCE_ID,
  buildMapData,
  CHOROPLETH_MAP_DATA_ID,
  CHOROPLETH_SOURCE_ID,
  type MapMode,
  POINTS_SOURCE_ID,
  POINTS_STATUS_SOURCE_ID,
} from './mapDataBuilders';

export { colorForIvs, ivsFaixaLabel } from './ivsLegends';
export {
  buildLegendItems,
  colorForCadUnico,
  colorForPercentual,
  colorForPessoasPorCozinha,
  colorForQuantidade,
  colorForSituacao,
  colorForTaxa,
  HABILITADA_COLOR,
  NAO_HABILITADA_COLOR,
} from './legendsBuilders';
export type { MapMode } from './mapDataBuilders';

/**
 * Shared `paint` for both kitchen point layers (`pontos` and `pontos-status`):
 * larger, more opaque dots with a thicker light halo than geovis'
 * `DEFAULT_DOT_DENSITY_PAINT` so each kitchen reads clearly over both the pale
 * basemap and the colored settlement polygons. Deliberately omits
 * `circleColor`: in `pontos` the `dotDensity` resolver merges its own uniform
 * color in (`injectResolvedFields`), while in `pontos-status` the adapter
 * falls back to the `activeLegendId`'s categorical `match` expression
 * (`resolveCircleColor` lets explicit paint win, so a color here would flatten
 * every status point).
 */
const POINTS_PAINT = {
  circleRadius: 4,
  circleOpacity: 0.9,
  circleStrokeColor: '#FAF9F7',
  circleStrokeWidth: 1.2,
} satisfies VisualizationLayer['paint'];

/**
 * Builds the minimal overrides for both point layers (`pontos` and
 * `pontos-status`) sharing {@link POINTS_PAINT}. Both are returned together so
 * the spec always carries the status-colored layer alongside the density one;
 * the resolver fills in `mapDataId`/`activeLegendId`/`circleColor` for each
 * from the resolved layers (matched on `sourceId`/`geometry` via
 * `mergeResolvedLayers`).
 */

const buildPointsLayerOverride = (): VisualizationLayer[] => {
  return [
    {
      id: 'cozinhas-pts-overrides',
      sourceId: POINTS_SOURCE_ID,
      geometry: 'point',
      paint: POINTS_PAINT,
    },
    {
      id: 'cozinhas-status-pts',
      sourceId: POINTS_STATUS_SOURCE_ID,
      geometry: 'point',
      // References the status legend so the adapter resolves its categorical
      // `match` over the joined `situacao` feature-state; `paint` omits
      // `circleColor` so the legend expression wins (an explicit color would
      // flatten every status point).
      activeLegendId: POINTS_STATUS_LEGEND_ID,
      paint: POINTS_PAINT,
    },
  ] satisfies VisualizationLayer[];
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
 * `sizeBy.transform: 'sqrt'` is also what makes circles render at all: it
 * puts the resolver on the `scaleMaxValue` proportional-ceiling path
 * (`usesProportionalCeiling`); without it every circle silently paints at
 * `zeroRadiusPx`. Dropping `paint.circleColor` altogether would similarly
 * leave circles with an undefined (opaque black) fill — `PROPORTIONAL_CIRCLES_DEFAULTS`
 * only covers opacity/stroke, never a color. `circleOpacity` matches the
 * resolver's own default (0.72) but is pinned here via
 * {@link BUBBLES_CIRCLE_OPACITY} so the legend swatches (repainted in
 * `MapaPlayground` from the same constant) can never drift from the map.
 *
 * No `hoverTooltip` here: geovis only fires hover on POLYGON layers with an
 * `activeLegendId` (`useMapHover`), so a tooltip on this point layer would
 * never render — the `circulos` tooltip lives on the município fill instead
 * (see {@link buildFillLayer}).
 */
const buildBubblesOverrideLayer = (): VisualizationLayer => {
  return {
    id: 'cozinhas-bolhas-overrides',
    sourceId: BUBBLES_SOURCE_ID,
    geometry: 'point',
    sizeBy: { range: BUBBLES_RADIUS_RANGE, transform: 'sqrt' },
    paint: {
      circleColor: BUBBLES_COLOR,
      circleOpacity: BUBBLES_CIRCLE_OPACITY,
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
  'pontos-status': buildPointsStatusLegend,
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

/**
 * Builds legends for the given mode via `LEGEND_BUILDER_BY_MODE`. `pontos` and
 * `circulos` carry two: their visible legend (`buildDotDensityLegend` /
 * `buildBubblesLegend`, both with a `position`) plus the invisible
 * `buildPontosFillLegend` (no `colorBy`, no `position`) — the fill references
 * it as `activeLegendId` purely so geovis hover-tracks the fill (enabling the
 * município tooltip) without the legend ever painting it; see
 * `PONTOS_FILL_LEGEND_ID` for why the fill needs its own, uncolored entry.
 */
const buildLegends = (mode: MapMode): LegendSpec[] => {
  if (mode === 'pontos') {
    return [buildDotDensityLegend(), buildPontosFillLegend()];
  }
  if (mode === 'circulos') {
    return [buildBubblesLegend(), buildPontosFillLegend()];
  }
  const build = LEGEND_BUILDER_BY_MODE[mode] ?? buildChoroplethLegend;
  return [build()];
};

/**
 * Fill layer's `activeLegendId` per mode. Choropleth modes resolve to their
 * legend so the adapter drives data-driven paint; overlay modes resolve to a
 * legend with no `colorBy` (rendering nothing, existing only so hover
 * tracking has a real legend to reference), while the adapter falls back to
 * the layer's own explicit `fillColor` for paint. `pontos` and `circulos`
 * cannot reuse their visible legends here — see `PONTOS_FILL_LEGEND_ID`.
 * `pontos-status` is the one overlay whose legend DOES sit on the fill: its
 * categorical `match` reads the município feature-state, which the mode never
 * feeds, so every polygon falls through to the legend's grey `defaultColor`.
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
  pontos: PONTOS_FILL_LEGEND_ID,
  'pontos-status': POINTS_STATUS_LEGEND_ID,
  circulos: PONTOS_FILL_LEGEND_ID,
};

/**
 * The município fill layer — always present, and the ONLY layer carrying a
 * `hoverTooltip`: geovis fires hover exclusively on polygon layers with an
 * `activeLegendId` (`useMapHover`), so every mode's tooltip — including the
 * overlay modes — renders from the hovered município here. Point layers never
 * fire hover, which is why none of them declare a tooltip.
 *
 * In choropleth modes (`coropletico*`) the fill declares the matching legend
 * id so the adapter resolves its data-driven paint. In overlay modes
 * (`pontos`, `pontos-status`, `circulos`) the referenced legend paints
 * nothing (no `colorBy`, or a categorical over never-fed feature-state) — the
 * adapter falls back to `fillColor: WITHOUT_KITCHEN_COLOR`, keeping the map
 * background neutral while hover tracking (and the tooltip) still works.
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
    hoverTooltip,
  };
};

/**
 * Pre-configured geovis `mapType` for each visualization mode. `undefined`
 * skips the library's mapType resolution entirely — the mode's layers and
 * legends are then used exactly as authored here.
 *
 * `pontos-status` must stay `undefined`: `resolveDotDensity` merges
 * `DEFAULT_DOT_DENSITY_PAINT` (including `circleColor: '#E4572E'`) into any
 * point layer on its target source (`injectResolvedFields`), and the adapter
 * lets an explicit `paint.circleColor` win over the `activeLegendId`'s
 * categorical expression (`resolveCircleColor`) — so with `'dotDensity'` every
 * status point silently paints flat orange instead of its situação color.
 */
const MAP_TYPE_BY_MODE: { [key in MapMode]: MapType | undefined } = {
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
  'pontos-status': undefined,
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
 * Invariants: the município fill layer is always present; the `pontos` points
 * layer is auto-generated by geovis' `dotDensity` resolver, with a minimal
 * override carrying only {@link POINTS_PAINT} (like the bubbles override,
 * `mergeResolvedLayers` matches on `sourceId`/`geometry` and the resolver
 * fills in `mapDataId`/`activeLegendId`/`circleColor`); the status points
 * overlay exists only in `pontos-status` mode; the circles override only in
 * `circulos` mode, which is also the only mode carrying `scaleMaxValue`.
 *
 * @returns the spec consumed by `<GeovisWorkspace>`.
 *
 * `fillHoverTooltip` is a ready-made `HoverTooltipConfig` (render + shared
 * card style) built by callers via `toHoverTooltip` in `mapaTooltips` — this
 * module only plumbs it onto the fill layer (the single hover-tracked layer,
 * see {@link buildFillLayer}), it never constructs tooltip style itself.
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
    ivsByCity,
  }: {
    byCity: kitchenRateByCity[];
    mode?: MapMode;
    fillHoverTooltip?: HoverTooltipConfig;
    cozinhas?: CozinhasFeatureCollection;
    cozinhasStatus?: CozinhasStatusFeatureCollection;
    ivsByCity?: MunicipioIvs[];
  } = {} as {
    byCity: kitchenRateByCity[];
  }
): VisualizationSpec => {
  const showPointsStatus = mode === 'pontos-status';
  const showBubbles = mode === 'circulos';

  // Bounds for the circle-size scale: the largest per-município count. Falls
  // back to 1 when there's no data so the circles layer can still clamp it.
  const maxQuantidade = byCity.reduce((max, register) => {
    return Math.max(max, register.quantidade);
  }, 1);

  const mapType = MAP_TYPE_BY_MODE[mode];

  return {
    engine: 'maplibre',
    ...(mapType === undefined ? {} : { mapType }),
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
      // `pontos-status` carries both point layers (density + status) built by
      // `buildPointsLayerOverride`, sharing POINTS_PAINT. The status layer
      // references the categorical status legend (no `circleColor`), so the
      // adapter falls back to its `match` over the joined `situacao`
      // feature-state. This only holds because `pontos-status` sets no
      // `mapType` (see MAP_TYPE_BY_MODE).
      ...(showPointsStatus ? buildPointsLayerOverride() : []),
      ...(showBubbles ? [buildBubblesOverrideLayer()] : []),
    ],
    ...(showBubbles ? { scaleMaxValue: maxQuantidade } : {}),
  };
};
