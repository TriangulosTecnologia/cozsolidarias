import type {
  LegendSpec,
  MapHoverInfo,
  VisualizationLayer,
  VisualizationSpec,
} from '@ttoss/geovis';

import type { CadinsanByCity, KitchenRateByCity } from '@/data-gateway/schema';

import { cadinsanCardLines } from '../mapas/mapaCadinsanTooltips';
import { TooltipCard } from '../mapas/mapaTooltipCard';
import { TOOLTIP_STYLE } from '../mapas/mapaTooltipStyle';
import {
  type CardLines,
  type Coverage,
  coverageLinesOf,
  coverageOf,
} from './coverageTooltipLines';

/**
 * The CADINSAN scenario each food-insecurity `mapDataId` paints: the route's
 * renderable ids, repeated here because the client cannot import the route
 * catalogue (it reaches the gateway).
 */
const CADINSAN_VARIANTS = new Map<string, 'com' | 'sem'>([
  ['municipios_cadinsan', 'com'],
  ['municipios_cadinsan_sem_pbf', 'sem'],
]);

/**
 * Whether a spec paints a CADINSAN share, the one case whose hover card needs
 * the CADINSAN rows (see {@link withLegendHoverTooltips}).
 *
 * @param spec - The spec served by `/api/ai/spec`.
 * @returns `true` when a `mapData` entry is `municipios_cadinsan` or `municipios_cadinsan_sem_pbf`.
 *
 * @example
 * paintsCadinsan({ mapData: [{ mapDataId: 'municipios_cadinsan_sem_pbf' }] }); // true
 */
export const paintsCadinsan = (spec: VisualizationSpec): boolean => {
  return (spec.mapData ?? []).some(({ mapDataId }) => {
    return CADINSAN_VARIANTS.has(mapDataId);
  });
};

/**
 * The CADINSAN scenario each food-insecurity `mapDataId` paints: the route's
 * renderable ids, repeated here because the client cannot import the route
 * catalogue (it reaches the gateway).
 */
const CADINSAN_VARIANTS = new Map<string, 'com' | 'sem'>([
  ['municipios_cadinsan', 'com'],
  ['municipios_cadinsan_sem_pbf', 'sem'],
]);

/**
 * Whether a spec paints a CADINSAN share, the one case whose hover card needs
 * the CADINSAN rows (see {@link withLegendHoverTooltips}).
 *
 * @param spec - The spec served by `/api/ai/spec`.
 * @returns `true` when a `mapData` entry is `municipios_cadinsan` or `municipios_cadinsan_sem_pbf`.
 *
 * @example
 * paintsCadinsan({ mapData: [{ mapDataId: 'municipios_cadinsan_sem_pbf' }] }); // true
 */
export const paintsCadinsan = (spec: VisualizationSpec): boolean => {
  return (spec.mapData ?? []).some(({ mapDataId }) => {
    return CADINSAN_VARIANTS.has(mapDataId);
  });
};

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

/** The `/mapas` CADINSAN lines of a painted band of a CADINSAN layer, else `null`. */
const cadinsanLinesOf = (params: {
  band: number;
  variant: 'com' | 'sem' | undefined;
  register: CadinsanByCity | undefined;
}): CardLines | null => {
  const { band, variant, register } = params;
  return band > 0 && variant ? cadinsanCardLines({ register, variant }) : null;
};

/**
 * The lines a card shows: the CADINSAN or coverage lines with the faixa after
 * the value, else the plain "<title> <value> · <faixa>" line.
 */
const cardLinesOf = (params: {
  band: number;
  value: number;
  faixa: string;
  title: string | undefined;
  cadinsan: CardLines | null;
  coverage: CardLines | null;
}): CardLines => {
  const { band, value, faixa, title, cadinsan, coverage } = params;
  const lines = cadinsan ?? coverage;
  if (!lines) {
    return { primary: primaryOf({ title, band, value, faixa }) };
  }
  return {
    ...lines,
    primary: band > 0 ? `${lines.primary} · ${faixa}` : lines.primary,
  };
};

/**
 * The hover card of a polygon layer painted by a threshold legend, the one
 * `/mapas` shows for IVS and IDHM: the município name, a swatch with the band's
 * color and "<title> <value> · <faixa>". The band follows geovis' step rule (the
 * count of thresholds at or under the value), so the swatch is the color on the
 * map; the first band is the "Sem dado" floor, which also takes a value that is
 * not a number. A CADINSAN layer whose município has a row reads the `/mapas`
 * CADINSAN lines instead, and a CadÚnico coverage layer the `/mapas` coverage
 * lines, each with the faixa after the value.
 */
const bandCard = (params: {
  names: Map<string, string>;
  title: string | undefined;
  scale: BandScale;
  info: MapHoverInfo;
  variant: 'com' | 'sem' | undefined;
  cadinsan: Map<string, CadinsanByCity>;
  coverage: Coverage | undefined;
  cozinhas: Map<string, KitchenRateByCity>;
}) => {
  const { names, title, scale, info } = params;
  const id = String(info.featureId);
  const value =
    typeof info.value === 'number' ? info.value : Number.NEGATIVE_INFINITY;
  const band = scale.thresholds.filter((threshold) => {
    return value >= threshold;
  }).length;
  // The range in parentheses stays in the legend; the card keeps the faixa name, as `/mapas` does.
  const faixa = scale.labels[band].replace(/\s*\(.*\)$/, '');
  const lines = cardLinesOf({
    band,
    value,
    faixa,
    title,
    cadinsan: cadinsanLinesOf({
      band,
      variant: params.variant,
      register: params.cadinsan.get(id),
    }),
    coverage: coverageLinesOf({
      band,
      value,
      coverage: params.coverage,
      register: params.cozinhas.get(id),
    }),
  });
  return (
    <TooltipCard
      name={names.get(id) ?? `Município ${info.featureId}`}
      swatchColor={scale.colors[band]}
      primary={lines.primary}
      secondary={lines.secondary}
      details={lines.details}
    />
  );
};

const NO_CADINSAN_ROWS = new Map<string, CadinsanByCity>();

const NO_KITCHEN_ROWS = new Map<string, KitchenRateByCity>();

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
  cadinsan: Map<string, CadinsanByCity>;
  cozinhas: Map<string, KitchenRateByCity>;
}): VisualizationLayer => {
  const { spec, layer, names, cadinsan, cozinhas } = params;
  const legend = spec.legends?.find(({ id }) => {
    return id === layer.activeLegendId;
  });
  const scale = bandScaleOf(legend);
  if (!scale) {
    return layer;
  }
  const title = spec.mapData?.find(({ mapDataId }) => {
    return mapDataId === layer.mapDataId;
  })?.title;
  // `isTippable` only lets through layers with a `mapDataId`.
  const variant = CADINSAN_VARIANTS.get(String(layer.mapDataId));
  const coverage = coverageOf({ mapDataId: String(layer.mapDataId), legend });
  return {
    ...layer,
    hoverTooltip: {
      style: TOOLTIP_STYLE,
      ...layer.hoverTooltip,
      render: (info: MapHoverInfo) => {
        return bandCard({
          names,
          title,
          scale,
          info,
          variant,
          cadinsan,
          coverage,
          cozinhas,
        });
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
 * `hoverTooltip` without `render` keeps its `style`. A CADINSAN share
 * (`municipios_cadinsan`, `municipios_cadinsan_sem_pbf`) gets the `/mapas`
 * CADINSAN lines (share, "N de M famílias", the other scenario) from its row in
 * `cadinsan`; without that row it keeps the plain band card. A CadÚnico
 * coverage (`cozinhas_por_10mil_cadunico`, `cozinhas_por_100mil_cadunico`,
 * `cadunico_pessoas_por_cozinha`) gets the `/mapas` coverage lines, with the
 * kitchen and CadÚnico counts from its row in `cozinhas` when there is one.
 *
 * @param params.spec - The spec served by `/api/ai/spec`.
 * @param params.names - `codarea → município name`; a município missing from it shows as `Município <codarea>`.
 * @param params.cadinsan - `codarea → CADINSAN row` (`/api/cadinsan/por-municipio`); defaults to none.
 * @param params.cozinhas - `codarea → kitchen row` (`/api/cozinhas/por-municipio`); defaults to none.
 * @returns The spec with the hover card on its legend-driven polygon layers.
 *
 * @example
 * withLegendHoverTooltips({ spec, names: new Map([['5300108', 'Brasília']]) }).layers?.[2].hoverTooltip?.render?.({ featureId: '5300108', value: 0.294, layerId: 'l', sourceId: 's', point: { x: 0, y: 0 } });
 * // a TooltipCard: "Brasília", "IVS 0,294 · Baixa"
 */
export const withLegendHoverTooltips = (params: {
  spec: VisualizationSpec;
  names: Map<string, string>;
  cadinsan?: Map<string, CadinsanByCity>;
  cozinhas?: Map<string, KitchenRateByCity>;
}): VisualizationSpec => {
  const {
    spec,
    names,
    cadinsan = NO_CADINSAN_ROWS,
    cozinhas = NO_KITCHEN_ROWS,
  } = params;
  const layers = spec.layers?.map((layer) => {
    return isTippable(layer)
      ? withTooltip({ spec, layer, names, cadinsan, cozinhas })
      : layer;
  });
  return layers?.some((layer, index) => {
    return layer !== spec.layers?.[index];
  })
    ? { ...spec, layers }
    : spec;
};
