import type {
  GeoJSONSource,
  HoverTooltipConfig,
  MapData,
  MapDataRow,
  VisualizationLayer,
  VisualizationSpec,
} from '@ttoss/geovis';

import type {
  cadinsanByCity,
  cafByCity,
  kitchenRateByCity,
  MunicipioIvs,
} from '@/data-gateway/schema';

import {
  ASSENTAMENTO_LEGEND_ID,
  assentamentoStatusLabel,
} from './geovisAssentamentosScales';
import { resolveChoropleth, toValueRows } from './geovisChoroplethRows';
import {
  buildCozinhaStatusLegend,
  COZINHA_STATUS_LEGEND_ID,
  cozinhaStatusLabel,
} from './geovisCozinhaStatusScales';
import { buildLegends, legendIdForMode, type MapMode } from './geovisScales';

/** Re-exported so consumers keep importing the map's mode type from here. */
export type { MapMode };

/**
 * One SICAR settlement's map-facing attributes, from the
 * `/geo/assentamentos-atributos.json` sidecar. Geometry-free: it drives the
 * categorical status join (color) and the hover tooltip; the geometry lives in
 * the companion `assentamentos.json` GeoJSON, matched by `codImovel`.
 */
export type AssentamentoAtributo = {
  /** SICAR property code (`cod_imovel`); the geometry join key. */
  codImovel: string;
  /** Município name (source-native spelling). */
  municipio: string;
  /** State (UF) the settlement belongs to. */
  uf: string;
  /** Total property area, in hectares. */
  areaHa: number;
  /** Property size in fiscal modules (unit varies by município). */
  modulosFiscais: number;
  /** Raw registration status code (`AT` / `CA` / `PE`). */
  status: string;
  /** Environmental-analysis condition (`des_condicao_ambiental`). */
  condicao: string;
  /** Registration creation date (`DD/MM/AAAA`). */
  dtCriacao: string;
  /** Last update date (`DD/MM/AAAA`). */
  dtAtualizacao: string;
};

/**
 * Optional overlay config passed to {@link buildSpec} for the assentamentos
 * mode: `atributos` color the settlement polygons by status and `hoverRender`
 * renders their spec-driven hover tooltip.
 */
type MapOverlays = {
  assentamentos?: {
    atributos?: AssentamentoAtributo[];
    hoverRender?: HoverTooltipConfig['render'];
  };
  /** Hover tooltip renderer for individual kitchen points (`pontos` and `assentamentos` modes). */
  cozinhaTooltipRender?: HoverTooltipConfig['render'];
  /**
   * `codigo → emFuncionamento` (source-native status text) for every kitchen
   * point, used to build the `cozinhas-status` join that colors the points by
   * operating status. Absent/empty entries fall back to the masked color.
   */
  cozinhaStatus?: Record<string, string>;
  /** Per-município CAF share rows; painted in `coropletico-cafs-percentual` mode. */
  cafByCity?: cafByCity[];
  /**
   * Per-município CADINSAN food-insecurity share rows; painted in the
   * `coropletico-cadinsan-com-pbf` and `coropletico-cadinsan-sem-pbf` modes.
   */
  cadinsanByCity?: cadinsanByCity[];
};

/**
 * Stand-ins for the optional overlay snapshots. Module constants rather than
 * `[]` literals so an omitted overlay keeps the same reference across calls —
 * `resolveChoropleth` memoizes on reference identity, and a fresh array per call
 * would defeat it.
 */
const NO_CAF_ROWS: cafByCity[] = [];
const NO_CADINSAN_ROWS: cadinsanByCity[] = [];
const NO_IVS_ROWS: MunicipioIvs[] = [];

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
 * The kitchen points layer. Larger, more opaque dots with a thick light halo so
 * each kitchen reads over the pale basemap and the settlement polygons. Static
 * (no data-driven paint), rendered in `pontos` and `assentamentos` modes.
 *
 * Each point feature carries its registration code as the GeoJSON `id`, so
 * declaring a `click` config opts the layer into click tracking and reports
 * that code as `MapClickInfo.featureId` — the key for `/api/cozinhas/[codigo]`.
 *
 * @param onSelect - Spec-driven click handler; invoked with the clicked point's
 * {@link MapClickInfo} (or `null` when the selection is cleared). Omit to render
 * the points without click tracking.
 */
/**
 * GeoJSON source of kitchen points and the join that promotes `codigo`.
 * Exported so the app can swap its `data` for a year-specific, in-memory
 * FeatureCollection (the time-lapse).
 */
export const COZINHAS_SOURCE_ID = 'cozinhas';
const COZINHAS_POINTS_MAP_DATA_ID = 'cozinhas-pts-promote';

/**
 * Layer id of the kitchen points layer. Exported so `MapaPlayground` can filter
 * `onFeatureSelect` to only react to kitchen-point clicks.
 */
export const COZINHAS_POINTS_LAYER_ID = 'cozinhas-pts';

/**
 * The kitchen points layer. Larger, more opaque dots with a thick light halo so
 * each kitchen reads over the pale basemap and the settlement polygons.
 *
 * Data-driven color by operating status: `mapDataId` binds the `cozinhas-status`
 * join (`codigo` → descriptive status label) and `activeLegendId` points at the
 * categorical {@link COZINHA_STATUS_LEGEND_ID} legend, whose `colorBy.mapping`
 * paints each point green / amber / red (masked fallback for unknown). Carries no
 * static `circleColor` — the join drives it, mirroring the assentamentos fill.
 *
 * Declares `click: {}` to opt into click tracking so the workspace's
 * `rightSidebar.onFeatureSelect` fires when a point is clicked. The clicked
 * feature's `featureId` is the `codigo` (promoted via `promoteId: 'codigo'`).
 */
const POINTS_LAYER: VisualizationLayer = {
  id: COZINHAS_POINTS_LAYER_ID,
  sourceId: COZINHAS_SOURCE_ID,
  geometry: 'point',
  mapDataId: COZINHAS_POINTS_MAP_DATA_ID,
  activeLegendId: COZINHA_STATUS_LEGEND_ID,
  // Time-lapse: when the timeline changes the year, `useMapaSpec` swaps this
  // source's `data` to that year's points, so the geovis crossfade fades the
  // previous year's dots out while the new year's fade in, instead of snapping.
  transition: { kind: 'crossfade', durationMs: 500, easing: 'ease-in-out' },
  paint: {
    circleRadius: 4,
    circleOpacity: 0.9,
    circleStrokeColor: '#FAF9F7',
    circleStrokeWidth: 1.2,
  },
  click: {},
  clickAnchor: {
    color: '#EA4335',
  },
};

/**
 * Whether the "Localização das cozinhas" toggle starts on for the given mode.
 * The kitchen *points* are the primary visualization in `pontos` (points) and
 * `assentamentos` (points over the settlements), so the toggle defaults on
 * there. In `circulos` the primary layer is the proportional-circle overlay
 * (always visible, never toggled); the points are an *opt-in overlay* there,
 * so the toggle starts off — as it does on every choropleth, where the points
 * layer is present but hidden until the user reveals it.
 *
 * The geovis control keys its remembered state by `item.id`, so `defaultActive`
 * only decides the initial state *before the first toggle*; after the user
 * flips it once, that explicit choice wins across all modes.
 */
const cozinhasDefaultActive = (mode: MapMode): boolean => {
  return mode === 'pontos' || mode === 'assentamentos';
};

/**
 * Builds the spec-driven layer-toggle control for the active mode.
 * `<GeoVisProvider>` auto-mounts a floating "Camadas" button (bottom-left)
 * whenever `spec.control` is present — no component is placed manually. The
 * on/off choice is remembered by `item.id`, so each toggle persists across mode
 * switches (which rebuild the spec).
 *
 * - **Cozinhas** shows/hides the kitchen *points* layer (`cozinhas-pts`),
 *   which is now rendered in every mode. The proportional-circle overlay
 *   (`cozinhas-bolhas`, `circulos` mode) is the always-on primary layer there
 *   and is deliberately not referenced, so the toggle only reveals the points
 *   on top of the circles. The item is enabled everywhere; its initial state
 *   comes from {@link cozinhasDefaultActive}.
 * - **Linhas dos estados** toggles the state boundary outline drawn from
 *   `/geo/estados.json`. That line is a normal layer added by the
 *   `estados-boundary` group in `useMapaSpec` (`createBoundaryGroup` names it
 *   `${id}-line`), so referencing `estados-boundary-line` by id lets the
 *   control hide/show it. The group is present in every mode, so this item is
 *   always enabled.
 *
 * @param mode - Active {@link MapMode}; sets the kitchens item's `defaultActive`.
 * @returns The control spec for the "Camadas" button.
 *
 * @example
 * buildControl('pontos').items[0].defaultActive; // true
 * buildControl('coropletico').items[0].defaultActive; // false
 */
const buildControl = (
  mode: MapMode
): NonNullable<VisualizationSpec['control']> => {
  return {
    id: 'camadas',
    label: 'Camadas',
    icon: 'lucide:layers',
    position: 'bottom-left',
    // Match the left sidebar card's inset (the overlay's `'3'` ≈ 12px on both
    // axes) so the control's bottom-left corner lines up with the card's when
    // closed. When the sidebar opens, the workspace shifts only `x` (clearing
    // the sidebar) and preserves this `y`, keeping the vertical alignment.
    offset: 12,
    trigger: 'hover',
    items: [
      {
        id: 'cozinhas',
        label: 'Localização das cozinhas',
        layers: [COZINHAS_POINTS_LAYER_ID],
        defaultActive: cozinhasDefaultActive(mode),
      },
      {
        id: 'estados',
        label: 'Linhas dos estados',
        layers: ['estados-boundary-line'],
      },
    ],
  };
};

/** GeoJSON source + categorical status join for the assentamentos overlay. */
const ASSENTAMENTOS_SOURCE_ID = 'assentamentos';
const ASSENTAMENTOS_MAP_DATA_ID = 'assentamentos-status';

/**
 * The assentamentos GeoJSON source (SICAR AST perimeters, all covered states).
 * Unlike the always-on cozinha sources, it's added to the spec only in
 * `assentamentos` mode so the multi-MB geometry isn't fetched on other map
 * views; the adapter's source sync adds/removes it (with the `cod_imovel` join
 * key) on mode switch.
 */
const ASSENTAMENTOS_SOURCE: GeoJSONSource = {
  id: ASSENTAMENTOS_SOURCE_ID,
  type: 'geojson',
  data: '/geo/assentamentos.json',
  attribution: '© SICAR / Serviço Florestal Brasileiro',
};

/**
 * A near-white land backdrop for the assentamentos mode: a fill of every state
 * polygon, laid over the basemap so the busy tiles (roads, protected areas,
 * rivers) don't compete with the small settlement polygons. Water stays the
 * basemap's, since it's outside the state polygons. Gated to this mode only.
 */
const ESTADOS_SOURCE_ID = 'estados-fill';

const ESTADOS_SOURCE: GeoJSONSource = {
  id: ESTADOS_SOURCE_ID,
  type: 'geojson',
  data: '/geo/estados.json',
  attribution: '© IBGE',
};

/** The near-white state backdrop layer (bottom of the assentamentos overlay). */
const buildEstadosFillLayer = (): VisualizationLayer => {
  return {
    id: 'estados-fill',
    sourceId: ESTADOS_SOURCE_ID,
    geometry: 'polygon',
    paint: {
      // Warm near-white (brand ivory) at near-full opacity: masks the basemap
      // clutter over land while leaving a whisper of it. The state outline is
      // drawn by the `estados-boundary` group on top.
      fillColor: '#FAF9F7',
      fillOpacity: 0.92,
    },
  };
};

/**
 * The settlement outline layer — a dedicated `line` over the assentamentos
 * source, thicker than a fill's 1px edge, so even tiny polygons read as crisp
 * shapes at the Southeast zoom. Paired with the filled polygon below it.
 */
const buildAssentamentosOutlineLayer = (): VisualizationLayer => {
  return {
    id: 'assentamentos-outline',
    sourceId: ASSENTAMENTOS_SOURCE_ID,
    geometry: 'line',
    paint: {
      lineColor: '#241F21',
      lineWidth: 1.4,
      lineOpacity: 0.9,
    },
  };
};

/**
 * Maps settlement attributes to categorical `mapData` value rows: `geometryId`
 * is the `cod_imovel` join key, `value` is the human status label the legend's
 * categorical `mapping` (and the tooltip) color by.
 */
const toAssentamentoStatusRows = (
  atributos: AssentamentoAtributo[]
): MapDataRow[] => {
  return atributos.map((atributo) => {
    return {
      geometryId: atributo.codImovel,
      value: assentamentoStatusLabel(atributo.status),
    };
  });
};

/**
 * The assentamentos fill layer. Carries no static `fillColor` — the color comes
 * from the categorical status join (`mapDataId` + `activeLegendId`). Fairly
 * opaque so each settlement reads as a solid status-colored patch over the
 * near-white land backdrop; the crisp border comes from the companion
 * {@link buildAssentamentosOutlineLayer}, and the kitchen points sit on top.
 */
const buildAssentamentosLayer = (
  hoverTooltipRender?: HoverTooltipConfig['render']
): VisualizationLayer => {
  return {
    id: 'assentamentos-poly',
    sourceId: ASSENTAMENTOS_SOURCE_ID,
    geometry: 'polygon',
    mapDataId: ASSENTAMENTOS_MAP_DATA_ID,
    activeLegendId: ASSENTAMENTO_LEGEND_ID,
    paint: {
      fillOpacity: 0.7,
    },
    ...(hoverTooltipRender
      ? { hoverTooltip: { render: hoverTooltipRender, style: TOOLTIP_STYLE } }
      : {}),
  };
};

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
    id: COZINHAS_SOURCE_ID,
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

/**
 * Zoom-in ceiling shared by every camera. Caps how close the user can get so
 * the view stays at município scale and avoids the high-zoom range where point
 * pins drift from their rendered circles.
 */
const MAX_ZOOM_IN = 9;

/**
 * Zoom-out floor shared by every camera. Caps how far the user can zoom out at
 * the level where Brazil's whole territory fills the view — the same zoom as the
 * default {@link BRAZIL_VIEW} — so the map never recedes to a global/ocean scale.
 */
const MAX_ZOOM_OUT = 4;

/** Default camera: the whole of Brazil (all cozinha-based modes). */
const BRAZIL_VIEW = {
  center: [-53.0, -14.5] as [number, number],
  zoom: 4,
  maxZoomIn: MAX_ZOOM_IN,
  maxZoomOut: MAX_ZOOM_OUT,
};

/**
 * Camera for the assentamentos mode: framed on the Southeast, which covers the
 * currently included states (SP, MG, RJ, ES). Widen/re-center as coverage grows
 * (and revert to {@link BRAZIL_VIEW} once it's national).
 */
const SUDESTE_VIEW = {
  center: [-45.5, -20.0] as [number, number],
  zoom: 5,
  maxZoomIn: MAX_ZOOM_IN,
  maxZoomOut: MAX_ZOOM_OUT,
};

/** Picks the camera for the active mode (Southeast for assentamentos, else Brazil). */
const resolveView = (showAssentamentos: boolean) => {
  return showAssentamentos ? SUDESTE_VIEW : BRAZIL_VIEW;
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
 * Attaches a spec-driven hover tooltip to a layer when a render is provided,
 * returning the layer unchanged otherwise.
 */
const withHoverTooltip = (
  layer: VisualizationLayer,
  render?: HoverTooltipConfig['render']
): VisualizationLayer => {
  return render
    ? { ...layer, hoverTooltip: { render, style: TOOLTIP_STYLE } }
    : layer;
};

/**
 * Assembles the layers for the active mode.
 *
 * Both kitchen representations — the proportional-circle overlay
 * (`cozinhas-bolhas`) and the points (`cozinhas-pts`) — are present in **every**
 * mode, always in the order `[bubbles, points]`, with only their visibility
 * varying by mode. This fixes their stacking at first mount: the geovis adapter
 * appends newly-added layers on top and never reorders existing ones, so if the
 * bubbles were added only on entering `circulos` they would land *above* the
 * points that the mount-time (`coropletico`) spec already placed. Keeping both
 * present from the first render — and never removing them — guarantees the
 * points always draw on top of the circles regardless of the navigation path.
 *
 * Visibility per mode:
 * - **bubbles** — visible only in `circulos` (its primary layer); hidden else.
 * - **points** — visible in `pontos` and `assentamentos` (their primary layer);
 *   hidden everywhere else, where the "Camadas" control reveals them as an
 *   opt-in overlay (see {@link cozinhasDefaultActive}).
 *
 * The município fill is present in every mode **except** `assentamentos` (where
 * municípios are hidden and the settlement backdrop/polygons/outline replace it).
 */
const buildOverlayLayers = ({
  mode,
  maxQuantidade,
  hoverTooltipRender,
  overlays,
}: {
  mode: MapMode;
  maxQuantidade: number;
  hoverTooltipRender?: HoverTooltipConfig['render'];
  overlays: MapOverlays;
}): VisualizationLayer[] => {
  const layers: VisualizationLayer[] = [];
  const pointsLayer = withHoverTooltip(
    POINTS_LAYER,
    overlays.cozinhaTooltipRender
  );

  if (mode === 'assentamentos') {
    // Bottom → top: near-white land backdrop, filled polygons, crisp outline.
    layers.push(buildEstadosFillLayer());
    layers.push(buildAssentamentosLayer(overlays.assentamentos?.hoverRender));
    layers.push(buildAssentamentosOutlineLayer());
  } else {
    layers.push(buildFillLayer(mode, hoverTooltipRender));
  }

  // Proportional circles: always present so their stacking position *below* the
  // points is fixed at mount and never reordered by a later mode switch. Only
  // visible in `circulos`, where they are the primary layer.
  layers.push({
    ...buildBubblesLayer(maxQuantidade),
    visible: mode === 'circulos',
  });

  // Kitchen points: always present and always added AFTER the bubbles, so they
  // render on top of the proportional circles. Visible where they are the
  // primary layer (`pontos`, `assentamentos`); hidden elsewhere, where the
  // "Camadas" control reveals them as an opt-in overlay.
  layers.push({
    ...pointsLayer,
    visible: mode === 'pontos' || mode === 'assentamentos',
  });

  return layers;
};

/**
 * Assembles the spec's `mapData` joins. The bubble join is ALWAYS present so its
 * (always-on) source picks up `promoteId: 'codarea'` at mount, feeding the
 * circle size. The município choropleth join is omitted in `assentamentos` mode
 * (no município fill there); the settlement status join is added only in that
 * mode, alongside its gated source.
 */
const buildMapData = ({
  byCity,
  choroplethRows,
  showAssentamentos,
  overlays,
}: {
  byCity: kitchenRateByCity[];
  choroplethRows: MapDataRow[];
  showAssentamentos: boolean;
  overlays: MapOverlays;
}): MapData[] => {
  const data: MapData[] = [
    {
      mapDataId: BUBBLES_MAP_DATA_ID,
      mapId: BUBBLES_SOURCE_ID,
      joinKey: 'codarea',
      title: 'Cozinhas por município',
      data: toValueRows(byCity),
    },
    // Doubles as (a) the `promoteId: 'codigo'` promotion — the `joinKey` makes
    // geovis promote each point's `codigo` to the MapLibre `feature.id` (without
    // it clicks report `0`) — and (b) the status color join: each row's `value`
    // is the descriptive status label the categorical points legend colors by.
    // Always present so the promotion is set when the `cozinhas` source is added.
    {
      mapDataId: COZINHAS_POINTS_MAP_DATA_ID,
      mapId: COZINHAS_SOURCE_ID,
      joinKey: 'codigo',
      data: Object.entries(overlays.cozinhaStatus ?? {}).map(
        ([codigo, raw]) => {
          return { geometryId: codigo, value: cozinhaStatusLabel(raw) };
        }
      ),
    },
  ];

  if (!showAssentamentos) {
    data.push({
      mapDataId: 'cozinhas-por-municipio',
      mapId: 'municipios-boundary',
      joinKey: 'codarea',
      title: 'Cozinhas por município',
      data: choroplethRows,
    });
  } else {
    data.push({
      mapDataId: ASSENTAMENTOS_MAP_DATA_ID,
      mapId: ASSENTAMENTOS_SOURCE_ID,
      joinKey: 'cod_imovel',
      title: 'Assentamentos por situação',
      data: toAssentamentoStatusRows(overlays.assentamentos?.atributos ?? []),
    });
  }
  return data;
};

/**
 * Assembles the full geovis {@link VisualizationSpec} for the given data and
 * mode. The choropleth value rows depend on the mode: raw counts in
 * `coropletico`, the per-100k-inhabitants rate in `coropletico-taxa`, the share
 * (%) of Brazil in `coropletico-percentual`, the per-10k-CadÚnico rate in
 * `coropletico-cadunico`, the people-per-cozinha value in
 * `coropletico-pessoas-cozinha`, any IVS- or IDHM-family score in the
 * `coropletico-ivs*` / `coropletico-idhm*` modes, and nothing in the overlay
 * modes (`pontos`, `circulos`), where every município falls back to the legend's
 * `defaultColor`.
 *
 * @param byCity - Per-município canonical cozinha rows (from the gateway).
 * @param mode - Active {@link MapMode}. Defaults to `'coropletico'`.
 * @param hoverTooltipRender - Optional spec-driven hover-tooltip renderer.
 * @param ivsByCity - Per-município IVS/IDHM rows (from the gateway); read in the
 * `coropletico-ivs*` and `coropletico-idhm*` modes. Defaults to `[]`.
 * @param overlays - Overlay config: `assentamentos.atributos` color the
 * settlement polygons by status and `hoverRender` draws their tooltip;
 * `cozinhaStatus` (`codigo → emFuncionamento`) colors the kitchen points by
 * operating status; `cafByCity` paints the CAF share choropleth; `cadinsanByCity`
 * paints the CADINSAN food-insecurity choropleths. Defaults to `{}`.
 * @returns The geovis visualization spec (sources, mapData, legends, layers).
 *
 * @example
 * buildSpec(byCity, 'coropletico-taxa');
 * buildSpec(byCity, 'coropletico-ivs', undefined, ivsByCity);
 * buildSpec(byCity, 'coropletico-cafs-percentual', undefined, [], { cafByCity });
 * buildSpec(byCity, 'assentamentos', undefined, [], { assentamentos: { atributos } });
 */
export const buildSpec = (
  byCity: kitchenRateByCity[],
  mode: MapMode = 'coropletico',
  hoverTooltipRender?: HoverTooltipConfig['render'],
  ivsByCity: MunicipioIvs[] = NO_IVS_ROWS,
  overlays: MapOverlays = {}
): VisualizationSpec => {
  const showAssentamentos = mode === 'assentamentos';

  // Value rows plus the data-driven Jenks breaks for the active ad-hoc
  // choropleth, fitted to the exact values it paints (so the legend can never
  // disagree with the fill). `jenksBreaks` is `null` for the IVS/IDHM families
  // (fixed official faixas) and overlays, which keeps their official scale.
  // Memoized per mode against these snapshots — see `resolveChoropleth`.
  const { rows: choroplethRows, jenksBreaks } = resolveChoropleth({
    mode,
    byCity,
    ivsByCity,
    // Stable empties, not fresh `[]` literals: the memo keys on reference
    // identity, and a new array every call would miss on every call.
    cafByCity: overlays.cafByCity ?? NO_CAF_ROWS,
    cadinsanByCity: overlays.cadinsanByCity ?? NO_CADINSAN_ROWS,
  });

  // Bounds for the circle-size scale: the largest per-município count. Falls
  // back to 1 when there's no data so `buildBubblesLayer` can still clamp it.
  const maxQuantidade = byCity.reduce((max, register) => {
    return Math.max(max, register.quantidade);
  }, 1);

  return {
    engine: 'maplibre',
    // The assentamentos data covers only some states, so frame that region when
    // the mode is active; every other (Brazil-wide) mode keeps the national view.
    view: resolveView(showAssentamentos),
    // Hide the basemap's text/icon labels (place, road and POI names) so the
    // choropleths, points and bubbles read against a clean geography. Only the
    // basemap's own `symbol` layers are affected — we declare none of our own.
    basemap: { labels: false },
    // The assentamentos geometry and the state backdrop are added only in this
    // mode, so other views never fetch them; the adapter's source sync
    // adds/removes them on switch.
    sources: showAssentamentos
      ? [...SOURCES, ASSENTAMENTOS_SOURCE, ESTADOS_SOURCE]
      : SOURCES,
    mapData: buildMapData({
      byCity,
      choroplethRows,
      showAssentamentos,
      overlays,
    }),
    legends: [
      ...buildLegends(mode, jenksBreaks),
      buildCozinhaStatusLegend(mode === 'pontos'),
    ],
    layers: buildOverlayLayers({
      mode,
      maxQuantidade,
      hoverTooltipRender,
      overlays,
    }),
    control: buildControl(mode),
  };
};
