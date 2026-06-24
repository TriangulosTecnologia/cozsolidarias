import type { HoverTooltipConfig, VisualizationSpec } from '@ttoss/geovis';

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
 * - `pontos`: flat background so the kitchen points stand out.
 *
 * The fill, the municipality/state borders and the SP background color stay the
 * same in both modes — only the data coloring and the points toggle.
 */
export type MapMode = 'coropletico' | 'pontos';

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

export const buildSpec = (
  byCity: kitchenByCity[],
  mode: MapMode = 'coropletico',
  hoverTooltipRender?: HoverTooltipConfig['render']
): VisualizationSpec => {
  const showPoints = mode === 'pontos';

  // The municipality fill layer is identical in both modes (keeps its
  // `mapDataId` + `activeLegendId`), so the hover tooltip — which only tracks
  // polygon layers with an `activeLegendId` — keeps working everywhere.
  //
  // The only thing that changes is the *data* fed to the choropleth: in `pontos`
  // mode we feed it nothing, so every município falls back to the legend's
  // `defaultColor` (`WITHOUT_KITCHEN_COLOR`) — the exact same flat SP background
  // the no-kitchen municipalities already show in `coropletico` mode.
  const choroplethData = mode === 'coropletico' ? byCity : [];

  return {
    id: 'mapa-cozinhas-sp',
    engine: 'maplibre',
    view: {
      center: [-48.6, -22.3],
      zoom: 6.5,
    },
    sources: [
      {
        id: 'cozinhas',
        type: 'geojson',
        data: '/api/cozinhas',
        attribution: '© Cozinhas Solidárias',
      },
    ],
    mapData: [
      {
        mapDataId: 'cozinhas-por-municipio',
        mapId: 'municipios-boundary',
        joinKey: 'codarea',
        title: 'Cozinhas por município',
        data: choroplethData.map((register) => {
          return {
            geometryId: register.codigoIbge,
            value: register.quantidade,
          };
        }),
      },
    ],
    legends: [
      {
        id: 'legenda-cozinhas',
        title: 'Cozinhas por município',
        colorBy: {
          type: 'quantitative',
          property: 'value',
          scale: 'threshold',
          thresholds: THRESHOLDS,
          colors: COLORS,
          defaultColor: WITHOUT_KITCHEN_COLOR,
        },
      },
    ],
    layers: [
      {
        id: 'municipios-br-fill',
        sourceId: 'municipios-boundary',
        geometry: 'polygon',
        mapDataId: 'cozinhas-por-municipio',
        activeLegendId: 'legenda-cozinhas',
        paint: {
          fillOpacity: mapTokens.dataviz.opacity.area,
          lineColor: '#FAF9F7',
        },
        // Spec-driven tooltip: `<GeoVisProvider>` renders the `<GeoVisHoverTooltip>`
        // itself, so it works inside the closed `<GeovisWorkspace>` (no children).
        ...(hoverTooltipRender
          ? { hoverTooltip: { render: hoverTooltipRender } }
          : {}),
      },
      ...(showPoints ? [POINTS_LAYER] : []),
    ],
  };
};
