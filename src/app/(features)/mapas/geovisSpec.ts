import type {
  GeoJSONSource,
  HoverTooltipConfig,
  MapData,
  MapDataRow,
  VisualizationLayer,
  VisualizationSpec,
} from '@ttoss/geovis';

import type {
  kitchenByCity,
  kitchenRateByCity,
  MunicipioIvs,
} from '@/data-gateway/schema';

import {
  ASSENTAMENTO_LEGEND_ID,
  assentamentoStatusLabel,
  buildLegends,
  legendIdForMode,
  type MapMode,
} from './geovisScales';

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
};

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
 */
const POINTS_LAYER: VisualizationLayer = {
  id: 'cozinhas-pts',
  sourceId: 'cozinhas',
  geometry: 'point',
  paint: {
    circleColor: '#E4572E',
    circleRadius: 4,
    circleOpacity: 0.9,
    circleStrokeColor: '#FAF9F7',
    circleStrokeWidth: 1.2,
  },
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

/** Default camera: the whole of Brazil (all cozinha-based modes). */
const BRAZIL_VIEW = { center: [-53.0, -14.5] as [number, number], zoom: 4 };

/**
 * Camera for the assentamentos mode: framed on the Southeast, which covers the
 * currently included states (SP, MG, RJ, ES). Widen/re-center as coverage grows
 * (and revert to {@link BRAZIL_VIEW} once it's national).
 */
const SUDESTE_VIEW = { center: [-45.5, -20.0] as [number, number], zoom: 5 };

/** Picks the camera for the active mode (Southeast for assentamentos, else Brazil). */
const resolveView = (showAssentamentos: boolean) => {
  return showAssentamentos ? SUDESTE_VIEW : BRAZIL_VIEW;
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
 * Maps a per-município score (any IVS- or IDHM-family value, selected by `pick`)
 * to geovis `mapData` value rows. Every row is kept — the gateway already dropped
 * municípios with an invalid/absent score, so the only municípios that fall back
 * to the legend's `defaultColor` ("sem dado") are those missing from the IVS
 * snapshot entirely.
 */
const toScoreRows = (
  ivsByCity: MunicipioIvs[],
  pick: (register: MunicipioIvs) => number
): MapDataRow[] => {
  return ivsByCity.map((register) => {
    return { geometryId: register.codigoIbge, value: pick(register) };
  });
};

/**
 * The IVS- and IDHM-family modes and the score each one paints, all read from
 * the per-município {@link MunicipioIvs} snapshot. Keyed by {@link MapMode} so
 * `buildSpec` resolves every family member in one lookup instead of a branch per
 * dimension.
 */
const SCORE_PICKERS: Partial<
  Record<MapMode, (register: MunicipioIvs) => number>
> = {
  'coropletico-ivs': (register) => {
    return register.ivs;
  },
  'coropletico-ivs-infraestrutura': (register) => {
    return register.ivsInfraestruturaUrbana;
  },
  'coropletico-ivs-capital-humano': (register) => {
    return register.ivsCapitalHumano;
  },
  'coropletico-ivs-renda-trabalho': (register) => {
    return register.ivsRendaETrabalho;
  },
  'coropletico-idhm': (register) => {
    return register.idhm;
  },
  'coropletico-idhm-longevidade': (register) => {
    return register.idhmLongevidade;
  },
  'coropletico-idhm-educacao': (register) => {
    return register.idhmEducacao;
  },
  'coropletico-idhm-renda': (register) => {
    return register.idhmRenda;
  },
  'coropletico-idhm-educacao-escolaridade': (register) => {
    return register.idhmEducacaoEscolaridade;
  },
  'coropletico-idhm-educacao-frequencia': (register) => {
    return register.idhmEducacaoFrequencia;
  },
};

/**
 * The cozinha-based choropleth modes and the value rows each one paints. Keyed
 * by {@link MapMode} so `buildSpec` resolves them in one lookup; the score
 * families are handled separately via {@link SCORE_PICKERS}.
 */
const CHOROPLETH_ROW_BUILDERS: Partial<
  Record<MapMode, (byCity: kitchenRateByCity[]) => MapDataRow[]>
> = {
  coropletico: toValueRows,
  'coropletico-taxa': toRateRows,
  'coropletico-percentual': toPercentRows,
  'coropletico-cadunico': toCadUnicoRows,
  'coropletico-pessoas-cozinha': toPessoasPorCozinhaRows,
};

/**
 * Resolves the município choropleth value rows for the active mode: the IVS- and
 * IDHM-families read the score snapshot (via {@link SCORE_PICKERS}), the
 * cozinha-based choropleths use their row builder (via
 * {@link CHOROPLETH_ROW_BUILDERS}), and every other mode (overlays) feeds nothing
 * so the fill stays neutral.
 */
const resolveChoroplethRows = (
  mode: MapMode,
  byCity: kitchenRateByCity[],
  ivsByCity: MunicipioIvs[]
): MapDataRow[] => {
  const scorePick = SCORE_PICKERS[mode];
  if (scorePick) {
    return toScoreRows(ivsByCity, scorePick);
  }
  const buildRows = CHOROPLETH_ROW_BUILDERS[mode];
  return buildRows ? buildRows(byCity) : [];
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
 * Assembles the layers for the active mode. The município fill is present in
 * every mode **except** `assentamentos` (where municípios are hidden). The
 * kitchen points sit on top in `pontos` and `assentamentos`; `circulos` shows
 * the proportional-circle overlay instead.
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
  if (mode !== 'assentamentos') {
    layers.push(buildFillLayer(mode, hoverTooltipRender));
  }
  if (mode === 'pontos') {
    layers.push(POINTS_LAYER);
  }
  if (mode === 'circulos') {
    layers.push(buildBubblesLayer(maxQuantidade));
  }
  if (mode === 'assentamentos') {
    // Bottom → top: near-white land backdrop, filled polygons, crisp outline,
    // then the kitchen points.
    layers.push(buildEstadosFillLayer());
    layers.push(buildAssentamentosLayer(overlays.assentamentos?.hoverRender));
    layers.push(buildAssentamentosOutlineLayer());
    layers.push(POINTS_LAYER);
  }
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
 * @param overlays - Overlay config for the assentamentos mode:
 * `assentamentos.atributos` color the polygons by status and `hoverRender` draws
 * their tooltip. Defaults to `{}`.
 * @returns The geovis visualization spec (sources, mapData, legends, layers).
 *
 * @example
 * buildSpec(byCity, 'coropletico-taxa');
 * buildSpec(byCity, 'coropletico-ivs', undefined, ivsByCity);
 * buildSpec(byCity, 'assentamentos', undefined, [], { assentamentos: { atributos } });
 */
export const buildSpec = (
  byCity: kitchenRateByCity[],
  mode: MapMode = 'coropletico',
  hoverTooltipRender?: HoverTooltipConfig['render'],
  ivsByCity: MunicipioIvs[] = [],
  overlays: MapOverlays = {}
): VisualizationSpec => {
  const showAssentamentos = mode === 'assentamentos';

  const choroplethRows = resolveChoroplethRows(mode, byCity, ivsByCity);

  // Bounds for the circle-size scale: the largest per-município count. Falls
  // back to 1 when there's no data so `buildBubblesLayer` can still clamp it.
  const maxQuantidade = byCity.reduce((max, register) => {
    return Math.max(max, register.quantidade);
  }, 1);

  return {
    id: 'mapa-cozinhas-sp',
    engine: 'maplibre',
    // The assentamentos data covers only some states, so frame that region when
    // the mode is active; every other (Brazil-wide) mode keeps the national view.
    view: resolveView(showAssentamentos),
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
    legends: buildLegends(mode),
    layers: buildOverlayLayers({
      mode,
      maxQuantidade,
      hoverTooltipRender,
      overlays,
    }),
  };
};
