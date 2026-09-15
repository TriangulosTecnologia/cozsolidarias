import type {
  HoverTooltipConfig,
  LegendSpec,
  MapData,
  MapDataRow,
  VisualizationLayer,
} from '@ttoss/geovis';

import { mapTokens } from '@/config/theme';
import type { CafHexbinFeatureCollection } from '@/data-gateway/schema';

import { TOOLTIP_STYLE } from './mapaTooltipStyle';

/** Where the grid is served from; also the source's fallback before it loads. */
export const CAF_HEXBIN_URL = '/api/cafs/hexbin';

/** Source id of the hexagon grid. */
export const CAF_HEXBIN_SOURCE_ID = 'caf-hexbin';

/** The single polygon layer that paints the grid. */
export const CAF_HEXBIN_LAYER_ID = 'caf-hexbin-fill';

/** Id of the grid's `mapData` join, and of the legend the fill reads. */
export const CAF_HEXBIN_MAP_DATA_ID = 'caf-hexbin-counts';

/** Id of this mode's legend. */
export const CAF_HEXBIN_LEGEND_ID = 'legenda-cafs-hexbin';

/**
 * Feature property carrying the H3 index, promoted to the MapLibre feature id
 * by the join's `joinKey`.
 *
 * It lives in `properties` rather than in the feature's `id` because MapLibre
 * serialises geojson through the vector-tile encoder, whose spec allows only
 * integer feature ids: a string id is run through `parseInt` and comes out
 * `NaN`, the join then lands nowhere, and every cell falls to the legend's
 * no-data colour. `joinKey` sets `promoteId`, which resolves the id from the
 * property after the tile is parsed and accepts any string.
 */
const CAF_HEXBIN_ID_PROPERTY = 'h3';

/**
 * Class breaks for the cell counts, in CAFs per cell.
 *
 * Decade-spaced rather than evenly spaced, because the distribution spans four
 * orders of magnitude and is severely right-skewed — over the generated grid the
 * median cell holds 61 CAFs, the 90th percentile 1.747, and the largest 25.358.
 * Even intervals over that range would put all but a handful of cells in the
 * first band and paint the country one colour.
 *
 * Fixed rather than Jenks: this mode has no `labelsFrom` in the choropleth
 * registry, so the scale never moves. That is deliberate — the grid is
 * regenerated offline from a snapshot, and a scale that shifted with each
 * regeneration would make two runs of the same map incomparable.
 */
const CAF_HEXBIN_THRESHOLDS = [1, 10, 100, 500, 2000, 8000];

/** What each band is called, the empty-cell label first. */
const CAF_HEXBIN_LABELS = [
  'Sem CAF',
  '1–9',
  '10–99',
  '100–499',
  '500–1.999',
  '2.000–7.999',
  '8.000+',
];

const CAF_HEXBIN_COLORS = Array.from(
  { length: CAF_HEXBIN_THRESHOLDS.length + 1 },
  (_, index) => {
    const ramp = mapTokens.dataviz.color.sequential[1];
    return ramp[
      Math.round((index * (ramp.length - 1)) / CAF_HEXBIN_THRESHOLDS.length)
    ];
  }
);

/** Cells that caught nothing. Distinct from the palest band, never a class. */
const CAF_HEXBIN_EMPTY_COLOR = mapTokens.dataviz.color.status.masked;

/**
 * The colour a cell's count is painted in — the swatch its hover card shows.
 *
 * Derived from the same thresholds and palette the legend declares, rather than
 * from a second table, so the square in the card is the colour on the map by
 * construction and not by maintenance.
 *
 * The band is "how many thresholds this count has reached", which lands on the
 * palette exactly: index `0` is the empty colour, and index `i` is the band
 * opened by `thresholds[i - 1]`.
 *
 * @param count - CAFs in the cell; `null` for a cell outside the join, which is
 * an empty one.
 * @returns The band's colour.
 *
 * @example
 * cafHexbinBandColor(0);    // the empty colour
 * cafHexbinBandColor(5);    // the first band
 * cafHexbinBandColor(25358); // the top band
 */
export const cafHexbinBandColor = (count: number | null): string => {
  if (count === null || count < CAF_HEXBIN_THRESHOLDS[0]) {
    return CAF_HEXBIN_EMPTY_COLOR;
  }

  const band = CAF_HEXBIN_THRESHOLDS.filter((threshold) => {
    return count >= threshold;
  }).length;

  return CAF_HEXBIN_COLORS[band];
};

/**
 * The grid source. The whole grid is one file — ~6k hexagons, fetched only when
 * this mode is picked — so there is no tile pyramid here and no zoom hierarchy:
 * the cell size is fixed at the resolution the file was generated for.
 *
 * @param cells - The grid held by the app, or `undefined` before it loads,
 * which leaves the source on its URL.
 * @returns The geojson source for the hexagon grid.
 *
 * @example
 * buildCafHexbinSource(); // { id: 'caf-hexbin', type: 'geojson', data: '/geo/caf-hexbin-r4.json' }
 */
export const buildCafHexbinSource = (cells?: CafHexbinFeatureCollection) => {
  return {
    id: CAF_HEXBIN_SOURCE_ID,
    type: 'geojson' as const,
    data: cells ?? CAF_HEXBIN_URL,
    attribution: '© CAF / MDA',
  };
};

/**
 * The grid's single fill layer.
 *
 * One layer, not the four-per-resolution stack the `cafs` mode needs: that mode
 * reads a tiled source, which cannot carry a `mapData` join, so its colour ramp
 * has to be simulated with stacked one-sided filters. A geojson source joins,
 * so a real `colorBy` ramp applies — the same shape as every município
 * choropleth in this app.
 *
 * @param hoverTooltipRender - Renders the cell's hover card; omit for no card.
 * @returns The polygon layer, joined and pointed at this mode's legend.
 *
 * @example
 * buildCafHexbinLayer().mapDataId; // 'caf-hexbin-counts'
 */
export const buildCafHexbinLayer = (
  hoverTooltipRender?: HoverTooltipConfig['render']
): VisualizationLayer => {
  return {
    id: CAF_HEXBIN_LAYER_ID,
    sourceId: CAF_HEXBIN_SOURCE_ID,
    geometry: 'polygon',
    mapDataId: CAF_HEXBIN_MAP_DATA_ID,
    activeLegendId: CAF_HEXBIN_LEGEND_ID,
    paint: {
      fillOpacity: 0.85,
      // Warm mid-grey, which reads against BOTH ends of what this layer paints:
      // the pale beige of an empty cell and the near-black blue of the top
      // class. It was the empty colour before, so empty cells had an outline
      // the same colour as their fill and ran together into one mass.
      //
      // No `lineWidth`: geovis compiles a polygon layer's `lineColor` to
      // MapLibre's `fill-outline-color`, which is always one pixel and takes no
      // width — declaring one would only suggest a knob that does nothing.
      lineColor: mapTokens.dataviz.color.status.suppressed,
    },
    ...(hoverTooltipRender
      ? { hoverTooltip: { render: hoverTooltipRender, style: TOOLTIP_STYLE } }
      : {}),
  };
};

/**
 * The join behind the fill.
 *
 * Empty cells are deliberately left OUT of the rows. A row of `value: 0` falls
 * below the first threshold and paints the cell in the palest band — "no CAF
 * here" reading as "a few CAFs here", which is the whole reason the empty
 * colour exists. With no row they resolve to `defaultColor`, under "Sem CAF".
 *
 * @param cells - The grid held by the app, if loaded.
 * @returns The join, empty before the grid arrives — which still sets the
 * `promoteId` the ids depend on.
 *
 * @example
 * buildCafHexbinMapData({ type: 'FeatureCollection', features: [{ properties: { h3: '84a', count: 12 } }] });
 * // [{ mapDataId: 'caf-hexbin-counts', mapId: 'caf-hexbin', joinKey: 'h3', data: [{ geometryId: '84a', value: 12 }] }]
 */
export const buildCafHexbinMapData = (
  cells?: CafHexbinFeatureCollection
): MapData[] => {
  const rows: MapDataRow[] = (cells?.features ?? [])
    .filter((feature) => {
      return feature.properties.count > 0;
    })
    .map((feature) => {
      return {
        geometryId: feature.properties.h3,
        value: feature.properties.count,
      };
    });

  return [
    {
      mapDataId: CAF_HEXBIN_MAP_DATA_ID,
      mapId: CAF_HEXBIN_SOURCE_ID,
      joinKey: CAF_HEXBIN_ID_PROPERTY,
      data: rows,
    },
  ];
};

/**
 * This mode's legend. Data-driven, unlike the `cafs` mode's explanatory one:
 * the fill carries it as `activeLegendId`, so the swatches and the map are the
 * same `colorBy`.
 *
 * @param active - Whether this mode is the one on screen; only a positioned
 * legend is rendered.
 * @returns The legend spec.
 *
 * @example
 * buildCafHexbinLegend(true).position; // 'bottom-right'
 */
export const buildCafHexbinLegend = (active: boolean): LegendSpec => {
  return {
    id: CAF_HEXBIN_LEGEND_ID,
    title: 'CAFs por célula da grade',
    subtitle:
      'Cada hexágono cobre cerca de 1.770 km² — todos do mesmo tamanho, então a cor compara densidade sem o viés de área dos municípios. Mostra os CAFs com coordenada utilizável.',
    icon: 'lucide:hexagon',
    ...(active ? { position: 'bottom-right' as const, offset: 12 } : {}),
    colorBy: {
      type: 'quantitative',
      property: 'value',
      scale: 'threshold',
      thresholds: CAF_HEXBIN_THRESHOLDS,
      colors: CAF_HEXBIN_COLORS,
      defaultColor: CAF_HEXBIN_EMPTY_COLOR,
    },
    labelFormat: { type: 'labels', labels: CAF_HEXBIN_LABELS },
    noDataLabel: 'Sem CAF',
    reference:
      'Fonte dos dados: Cadastro Nacional da Agricultura Familiar (CAF)',
  };
};
