import type {
  LegendSpec,
  MapHoverInfo,
  VisualizationLayer,
  VisualizationSpec,
} from '@ttoss/geovis';

import { TooltipCard } from '../mapas/mapaTooltipCard';
import { TOOLTIP_STYLE } from '../mapas/mapaTooltipStyle';

/** A legend read as bands: band `i` is painted `colors[i]` and named `labels[i]`; `thresholds` are the cut points. */
type BandScale = { thresholds: number[]; colors: string[]; labels: string[] };

const cutsOf = (colorBy: LegendSpec['colorBy']) => {
  return colorBy?.type === 'quantitative' &&
    colorBy.thresholds &&
    colorBy.colors
    ? { thresholds: colorBy.thresholds, colors: colorBy.colors }
    : null;
};

const labelsOf = (labelFormat: LegendSpec['labelFormat']) => {
  return labelFormat?.type === 'labels' ? labelFormat.labels : null;
};

/** The bands of a legend that is a threshold scale with named bins, or `null` for any other legend. */
const bandScaleOf = (legend: LegendSpec | undefined): BandScale | null => {
  const cuts = cutsOf(legend?.colorBy);
  const labels = labelsOf(legend?.labelFormat);
  return cuts && labels ? { ...cuts, labels } : null;
};

/** The card's main line: "<title> <value> · <faixa>", or "Sem dado de <title>" for the floor band. */
const primaryOf = (params: {
  title: string | undefined;
  band: number;
  value: number;
  faixa: string;
}) => {
  const { title, band, value, faixa } = params;
  if (band === 0) {
    return `Sem dado${title ? ` de ${title}` : ''}`;
  }
  return `${title ? `${title} ` : ''}${value.toLocaleString('pt-BR')} · ${faixa}`;
};

/**
 * The hover card of a polygon layer painted by a threshold legend, the one
 * `/mapas` shows for IVS and IDHM: the município name, a swatch with the band's
 * color and "<title> <value> · <faixa>". The band follows geovis' step rule (the
 * count of thresholds at or under the value), so the swatch is the color on the
 * map; the first band is the "Sem dado" floor, which also takes a value that is
 * not a number.
 */
const bandCard = (params: {
  names: Map<string, string>;
  title: string | undefined;
  scale: BandScale;
  info: MapHoverInfo;
}) => {
  const { names, title, scale, info } = params;
  const value =
    typeof info.value === 'number' ? info.value : Number.NEGATIVE_INFINITY;
  const band = scale.thresholds.filter((threshold) => {
    return value >= threshold;
  }).length;
  // The range in parentheses stays in the legend; the card keeps the faixa name, as `/mapas` does.
  const faixa = scale.labels[band].replace(/\s*\(.*\)$/, '');
  return (
    <TooltipCard
      name={names.get(String(info.featureId)) ?? `Município ${info.featureId}`}
      swatchColor={scale.colors[band]}
      primary={primaryOf({ title, band, value, faixa })}
    />
  );
};

const isTippable = (layer: VisualizationLayer) => {
  return (
    layer.geometry === 'polygon' &&
    Boolean(layer.mapDataId) &&
    !layer.hoverTooltip?.render
  );
};

const withTooltip = (params: {
  spec: VisualizationSpec;
  layer: VisualizationLayer;
  names: Map<string, string>;
}): VisualizationLayer => {
  const { spec, layer, names } = params;
  const scale = bandScaleOf(
    spec.legends?.find(({ id }) => {
      return id === layer.activeLegendId;
    })
  );
  if (!scale) {
    return layer;
  }
  const title = spec.mapData?.find(({ mapDataId }) => {
    return mapDataId === layer.mapDataId;
  })?.title;
  return {
    ...layer,
    hoverTooltip: {
      style: TOOLTIP_STYLE,
      ...layer.hoverTooltip,
      render: (info: MapHoverInfo) => {
        return bandCard({ names, title, scale, info });
      },
    },
  };
};

/**
 * Gives each polygon layer painted by a threshold legend the `/mapas` hover
 * card. The server serves such a layer with `hoverPaint` and no `hoverTooltip`,
 * because a tooltip is a function and cannot travel in JSON; everything the card
 * shows is already in the spec: the value (geovis feature-state), the band color
 * and name (`legend.colorBy.colors` and `legend.labelFormat.labels`) and the
 * label (`mapData[].title`). A layer that already has a `render`, has no
 * `mapDataId`, or whose legend is not a threshold scale with named bins is left
 * as it is, and a spec with none to change comes back as the same object. A
 * `hoverTooltip` without `render` keeps its `style`.
 *
 * @param params.spec - The spec served by `/api/ai/spec`.
 * @param params.names - `codarea → município name`; a município missing from it shows as `Município <codarea>`.
 * @returns The spec with the hover card on its legend-driven polygon layers.
 *
 * @example
 * withLegendHoverTooltips({ spec, names: new Map([['5300108', 'Brasília']]) }).layers?.[2].hoverTooltip?.render?.({ featureId: '5300108', value: 0.294, layerId: 'l', sourceId: 's', point: { x: 0, y: 0 } });
 * // a TooltipCard: "Brasília", "IVS 0,294 · Baixa"
 */
export const withLegendHoverTooltips = (params: {
  spec: VisualizationSpec;
  names: Map<string, string>;
}): VisualizationSpec => {
  const { spec, names } = params;
  const layers = spec.layers?.map((layer) => {
    return isTippable(layer) ? withTooltip({ spec, layer, names }) : layer;
  });
  return layers?.some((layer, index) => {
    return layer !== spec.layers?.[index];
  })
    ? { ...spec, layers }
    : spec;
};
