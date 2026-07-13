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
 * `/geo/assentamentos-sp-atributos.json` sidecar. Geometry-free: it drives the
 * categorical status join (color) and the hover tooltip; the geometry lives in
 * the companion `assentamentos-sp.json` GeoJSON, matched by `codImovel`.
 */
export type AssentamentoAtributo = {
  /** SICAR property code (`cod_imovel`); the geometry join key. */
  codImovel: string;
  /** Município name (source-native spelling). */
  municipio: string;
  /** Total property area, in hectares. */
  areaHa: number;
  /** Raw registration status code (`AT` / `CA` / `PE`). */
  status: string;
  /** Environmental-analysis condition (`des_condicao_ambiental`). */
  condicao: string;
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

/** GeoJSON source + categorical status join for the assentamentos overlay. */
const ASSENTAMENTOS_SOURCE_ID = 'assentamentos';
const ASSENTAMENTOS_MAP_DATA_ID = 'assentamentos-status';

/**
 * The assentamentos GeoJSON source (SICAR AST perimeters of SP). Unlike the
 * always-on cozinha sources, it's added to the spec only in `assentamentos` mode
 * so the multi-MB geometry isn't fetched on other map views; the adapter's
 * source sync adds/removes it (with the `cod_imovel` join key) on mode switch.
 */
const ASSENTAMENTOS_SOURCE: GeoJSONSource = {
  id: ASSENTAMENTOS_SOURCE_ID,
  type: 'geojson',
  data: '/geo/assentamentos-sp.json',
  attribution: '© SICAR / Serviço Florestal Brasileiro',
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
 * The assentamentos fill layer. Like the município fill, it carries no static
 * `fillColor` — the color comes from the categorical join (`mapDataId` +
 * `activeLegendId`). Filled and translucent so the kitchen points overlaid on
 * top stay legible, with a dark contour outlining each perimeter.
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
      fillOpacity: 0.5,
      lineColor: '#241F21',
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
 * Maps an IVS-family score (overall IVS or a sub-index, selected by `pick`) to
 * geovis `mapData` value rows. Every row is kept — the gateway already dropped
 * municípios with an invalid/absent score, so the only municípios that fall back
 * to the legend's `defaultColor` ("sem dado") are those missing from the IVS
 * snapshot entirely.
 */
const toIvsRows = (
  ivsByCity: MunicipioIvs[],
  pick: (register: MunicipioIvs) => number
): MapDataRow[] => {
  return ivsByCity.map((register) => {
    return { geometryId: register.codigoIbge, value: pick(register) };
  });
};

/**
 * The IVS-family modes and the score each one paints. Keyed by {@link MapMode}
 * so `buildSpec` resolves the whole family in one lookup instead of a branch per
 * sub-index. Every value lives on the same `[0, 1]` IPEA scale.
 */
const IVS_PICKERS: Partial<
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
};

/**
 * The cozinha-based choropleth modes and the value rows each one paints. Keyed
 * by {@link MapMode} so `buildSpec` resolves them in one lookup; the IVS family
 * is handled separately via {@link IVS_PICKERS}.
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
 * Resolves the município choropleth value rows for the active mode: the IVS
 * family reads the IVS dataset (via {@link IVS_PICKERS}), the cozinha-based
 * choropleths use their row builder (via {@link CHOROPLETH_ROW_BUILDERS}), and
 * every other mode (overlays) feeds nothing so the fill stays neutral.
 */
const resolveChoroplethRows = (
  mode: MapMode,
  byCity: kitchenRateByCity[],
  ivsByCity: MunicipioIvs[]
): MapDataRow[] => {
  const ivsPick = IVS_PICKERS[mode];
  if (ivsPick) {
    return toIvsRows(ivsByCity, ivsPick);
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
 * Assembles the full geovis {@link VisualizationSpec} for the given data and
 * mode. The choropleth value rows depend on the mode: raw counts in
 * `coropletico`, the per-100k-inhabitants rate in `coropletico-taxa`, the share
 * (%) of Brazil in `coropletico-percentual`, the per-10k-CadÚnico rate in
 * `coropletico-cadunico`, the people-per-cozinha value in
 * `coropletico-pessoas-cozinha`, the overall IVS in `coropletico-ivs` and each
 * IVS sub-index in `coropletico-ivs-infraestrutura` / `-capital-humano` /
 * `-renda-trabalho`, and nothing in the overlay modes (`pontos`, `circulos`),
 * where every município falls back to the legend's `defaultColor`.
 *
 * @param byCity - Per-município canonical cozinha rows (from the gateway).
 * @param mode - Active {@link MapMode}. Defaults to `'coropletico'`.
 * @param hoverTooltipRender - Optional spec-driven hover-tooltip renderer.
 * @param ivsByCity - Per-município IVS rows (from the gateway); read in the
 * `coropletico-ivs` mode and the three IVS sub-index modes. Defaults to `[]`.
 * @param assentamentos - Settlement overlay config, read only in `assentamentos`
 * mode: `atributos` (from the map's sidecar) color the polygons by status and
 * `hoverRender` renders their tooltip. Defaults to `{}`.
 * @returns The geovis visualization spec (sources, mapData, legends, layers).
 *
 * @example
 * buildSpec(byCity, 'coropletico-taxa');
 * buildSpec(byCity, 'coropletico-ivs', undefined, ivsByCity);
 * buildSpec(byCity, 'assentamentos', undefined, [], { atributos });
 */
export const buildSpec = (
  byCity: kitchenRateByCity[],
  mode: MapMode = 'coropletico',
  hoverTooltipRender?: HoverTooltipConfig['render'],
  ivsByCity: MunicipioIvs[] = [],
  assentamentos: {
    atributos?: AssentamentoAtributo[];
    hoverRender?: HoverTooltipConfig['render'];
  } = {}
): VisualizationSpec => {
  const showPoints = mode === 'pontos';
  const showBubbles = mode === 'circulos';
  const showAssentamentos = mode === 'assentamentos';

  const choroplethRows = resolveChoroplethRows(mode, byCity, ivsByCity);

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

  // Gated on the mode (unlike the always-on cozinha sources): the adapter's
  // source sync adds the source + this join (with `cod_imovel` as `promoteId`)
  // when entering the mode and removes them when leaving, so the multi-MB
  // geometry never loads on other views.
  const assentamentosMapData: MapData[] = showAssentamentos
    ? [
        {
          mapDataId: ASSENTAMENTOS_MAP_DATA_ID,
          mapId: ASSENTAMENTOS_SOURCE_ID,
          joinKey: 'cod_imovel',
          title: 'Assentamentos por situação',
          data: toAssentamentoStatusRows(assentamentos.atributos ?? []),
        },
      ]
    : [];

  return {
    id: 'mapa-cozinhas-sp',
    engine: 'maplibre',
    view: {
      center: [-53.0, -14.5],
      zoom: 4,
    },
    basemap: { labels: false },
    sources: showAssentamentos ? [...SOURCES, ASSENTAMENTOS_SOURCE] : SOURCES,
    mapData: [
      {
        mapDataId: 'cozinhas-por-municipio',
        mapId: 'municipios-boundary',
        joinKey: 'codarea',
        title: 'Cozinhas por município',
        data: choroplethRows,
      },
      ...bubblesMapData,
      ...assentamentosMapData,
    ],
    legends: buildLegends(mode),
    layers: [
      buildFillLayer(mode, hoverTooltipRender),
      ...(showPoints ? [POINTS_LAYER] : []),
      ...(showBubbles ? [buildBubblesLayer(maxQuantidade)] : []),
      // Points on top of the settlement polygons so kitchens stay visible.
      ...(showAssentamentos
        ? [buildAssentamentosLayer(assentamentos.hoverRender), POINTS_LAYER]
        : []),
    ],
  };
};
