import type {
  GeoJSONSource,
  HoverTooltipConfig,
  MapDataRow,
  VisualizationLayer,
} from '@ttoss/geovis';

import {
  ASSENTAMENTO_LEGEND_ID,
  assentamentoStatusLabel,
} from './geovisAssentamentosScales';
import { TOOLTIP_STYLE } from './mapaTooltipStyle';

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

/** GeoJSON source + categorical status join for the assentamentos overlay. */
export const ASSENTAMENTOS_SOURCE_ID = 'assentamentos';
export const ASSENTAMENTOS_MAP_DATA_ID = 'assentamentos-status';

/**
 * The assentamentos GeoJSON source (SICAR AST perimeters, all covered states).
 * Unlike the always-on cozinha sources, it's added to the spec only in
 * `assentamentos` mode so the multi-MB geometry isn't fetched on other map
 * views; the adapter's source sync adds/removes it (with the `cod_imovel` join
 * key) on mode switch.
 */
export const ASSENTAMENTOS_SOURCE: GeoJSONSource = {
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

export const ESTADOS_SOURCE: GeoJSONSource = {
  id: ESTADOS_SOURCE_ID,
  type: 'geojson',
  data: '/geo/estados.json',
  attribution: '© IBGE',
};

/** The near-white state backdrop layer (bottom of the assentamentos overlay). */
export const buildEstadosFillLayer = (): VisualizationLayer => {
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
export const buildAssentamentosOutlineLayer = (): VisualizationLayer => {
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
export const toAssentamentoStatusRows = (
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
export const buildAssentamentosLayer = (
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
