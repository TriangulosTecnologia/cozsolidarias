import type {
  MapData,
  MapHoverInfo,
  VisualizationLayer,
  VisualizationSpec,
} from '@ttoss/geovis';

import type { CadinsanByCity, KitchenRateByCity } from '@/data-gateway/schema';

import { TooltipCard } from '../mapas/mapaTooltipCard';
import { TOOLTIP_STYLE } from '../mapas/mapaTooltipStyle';
import { withLegendHoverTooltips } from './legendHoverTooltips';

const MUNICIPIOS_URL = '/geo/geojs-100-mun.json';

/** `codarea → municipio` read from the inline features of the spec's sources. */
const municipioNames = (spec: VisualizationSpec): Map<string, string> => {
  const features = (spec.sources ?? []).flatMap((source) => {
    const data = source.type === 'geojson' ? source.data : undefined;
    return typeof data === 'object' && 'features' in data ? data.features : [];
  });
  return new Map(
    features.flatMap(({ properties }) => {
      return typeof properties?.codarea === 'string' &&
        typeof properties.municipio === 'string'
        ? [[properties.codarea, properties.municipio] as const]
        : [];
    })
  );
};

const hoverCard = ({
  names,
  title,
  info,
}: {
  names: Map<string, string>;
  title?: string;
  info: MapHoverInfo;
}) => {
  return (
    <TooltipCard
      name={names.get(String(info.featureId)) ?? `Município ${info.featureId}`}
      primary={
        typeof info.value === 'number'
          ? `${info.value.toLocaleString('pt-BR')} · ${title}`
          : 'Sem dado'
      }
    />
  );
};

/**
 * Each point layer with the `mapData` entry that drives it. Only entries keyed
 * by `codarea` qualify: the hover polygon re-joins the rows to the município
 * boundary by `codarea`, so rows keyed by anything else (e.g. a kitchen's
 * `codigo`) match no município and collide on the boundary's `color` dimension.
 */
const pointLayersWithData = (spec: VisualizationSpec) => {
  return (spec.layers ?? []).flatMap((layer) => {
    const entry = spec.mapData?.find(({ mapDataId, joinKey }) => {
      return (
        layer.geometry === 'point' &&
        joinKey === 'codarea' &&
        mapDataId === layer.mapDataId
      );
    });
    return entry ? [{ layer, entry }] : [];
  });
};

/** The município boundary source and legend a hover polygon layer needs, or `null`. */
const hoverAnchor = (spec: VisualizationSpec) => {
  const boundary = (spec.sources ?? []).find((source) => {
    return source.type === 'geojson' && source.data === MUNICIPIOS_URL;
  });
  const legendId = spec.legends?.[0]?.id;
  return boundary && legendId ? { boundary, legendId } : null;
};

/** The point layers joined to a `mapData`, and the bare polygon `hoverTooltip`s, get the hover card; see {@link withHoverTooltips}. */
const withPointHoverTooltips = ({
  spec,
  names,
}: {
  spec: VisualizationSpec;
  names: Map<string, string>;
}): VisualizationSpec => {
  const anchor = hoverAnchor(spec);
  if (!anchor) {
    return spec;
  }
  const { boundary, legendId } = anchor;
  const { mapData = [], layers = [] } = spec;
  const hovered = pointLayersWithData(spec);
  const hoverLayers: VisualizationLayer[] = hovered.map(({ layer, entry }) => {
    return {
      id: `${layer.id}-hover`,
      sourceId: boundary.id,
      geometry: 'polygon',
      mapDataId: `${entry.mapDataId}-hover`,
      activeLegendId: legendId,
      paint: { fillOpacity: 0 },
      hoverTooltip: {
        style: TOOLTIP_STYLE,
        render: (info: MapHoverInfo) => {
          return hoverCard({ names, title: entry.title, info });
        },
      },
    };
  });
  const hoverMapData: MapData[] = hovered.map(({ entry }) => {
    return {
      ...entry,
      mapDataId: `${entry.mapDataId}-hover`,
      mapId: boundary.id,
      joinKey: 'codarea',
      dimension: 'color',
    };
  });

  const namedLayers = layers.map((layer) => {
    const { hoverTooltip } = layer;
    if (layer.geometry !== 'polygon' || !hoverTooltip || hoverTooltip.render) {
      return layer;
    }
    const title = mapData.find(({ mapDataId }) => {
      return mapDataId === layer.mapDataId;
    })?.title;
    return {
      ...layer,
      hoverTooltip: {
        ...hoverTooltip,
        render: (info: MapHoverInfo) => {
          return hoverCard({ names, title, info });
        },
      },
    };
  });

  return {
    ...spec,
    mapData: [...mapData, ...hoverMapData],
    layers: [...hoverLayers, ...namedLayers],
  };
};

/**
 * Gives the point layers joined to a `mapData` the `/mapas` hover card.
 * geovis only tracks hover on **polygon** layers with an `activeLegendId`, so —
 * like `/mapas` does with `municipios-br-fill` — the card hangs on an invisible
 * município polygon layer fed the same rows. A tooltip is a function and cannot
 * travel in the server's JSON, which is why this runs on the client: the value
 * comes from geovis feature-state, the label from the `mapData` title and the
 * name from the spec's own `codarea`/`municipio` source features.
 *
 * @param spec - The spec served by `/api/ai/spec`.
 * @param options - `nomes`: `codarea → município name` (e.g. `/geo/municipios-nomes.json`),
 * which wins over the names read from the spec's inline features — those cover
 * only municípios with data and arrive upper-cased. Município polygon layers
 * the server left with a bare `hoverTooltip` get the same card.
 * Polygon layers painted by a threshold legend, such as IVS and IDHM, get the
 * `/mapas` band card from {@link withLegendHoverTooltips}; `cadinsan`
 * (`codarea → CADINSAN row`) gives a CADINSAN share its `/mapas` lines, and
 * `cozinhas` (`codarea → kitchen row`) a CadÚnico coverage its counts.
 *
 * @returns The spec with one hover polygon layer (and its `mapData`) per
 * point layer, and the cards above; unchanged when there is nothing to add.
 *
 * @example
 * withHoverTooltips(spec).layers[0].hoverTooltip?.render({ featureId: '2927408', value: 120, layerId: 'l', sourceId: 's', point: { x: 0, y: 0 } });
 */
export const withHoverTooltips = (
  spec: VisualizationSpec,
  {
    nomes = {},
    cadinsan,
    cozinhas,
  }: {
    nomes?: { [codarea: string]: string };
    cadinsan?: Map<string, CadinsanByCity>;
    cozinhas?: Map<string, KitchenRateByCity>;
  } = {}
): VisualizationSpec => {
  const names = new Map([...municipioNames(spec), ...Object.entries(nomes)]);
  return withPointHoverTooltips({
    spec: withLegendHoverTooltips({ spec, names, cadinsan, cozinhas }),
    names,
  });
};
