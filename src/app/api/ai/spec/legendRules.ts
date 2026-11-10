import {
  IDHM_FAMILY_COLORS,
  IDHM_FAMILY_THRESHOLDS,
  IDHM_LEGEND_LABELS,
  IVS_FAMILY_COLORS,
  IVS_FAMILY_THRESHOLDS,
  IVS_LEGEND_LABELS,
} from '@/app/(features)/mapas/geovisScoreScales';

import { officialFaixasOf } from './mapDataCatalogue';
import { isRecord, type UnknownRecord } from './specValidation';

const recordsOf = (value: unknown): UnknownRecord[] => {
  return Array.isArray(value) ? value.filter(isRecord) : [];
};

const OFFICIAL_SCALES = {
  ivs: {
    thresholds: IVS_FAMILY_THRESHOLDS,
    colors: IVS_FAMILY_COLORS,
    labels: IVS_LEGEND_LABELS,
  },
  idhm: {
    thresholds: IDHM_FAMILY_THRESHOLDS,
    colors: IDHM_FAMILY_COLORS,
    labels: IDHM_LEGEND_LABELS,
  },
};

/**
 * Splits off the legends the agent wrote at the top level without an `id`
 * (text only: `title`, `subtitle`, `reference`, `noDataLabel`): the geovis resolver would append them as extra
 * legends instead of merging them into the one it generates. Legends with an
 * `id` (a full-spec reply) stay for geovis' own merge.
 *
 * @param spec - The derived agent spec.
 * @returns The spec without those legends, and the legends themselves.
 * @example
 * splitAgentLegends({ legends: [{ title: 'IVS' }, { id: 'l' }] });
 * // { spec: { legends: [{ id: 'l' }] }, agentLegends: [{ title: 'IVS' }] }
 */
export const splitAgentLegends = (
  spec: UnknownRecord
): { spec: UnknownRecord; agentLegends: UnknownRecord[] } => {
  if (!Array.isArray(spec['legends'])) {
    return { spec, agentLegends: [] };
  }
  const isAgentLegend = (legend: unknown): legend is UnknownRecord => {
    return isRecord(legend) && legend['id'] === undefined;
  };
  return {
    spec: {
      ...spec,
      legends: spec['legends'].filter((legend) => {
        return !isAgentLegend(legend);
      }),
    },
    agentLegends: spec['legends'].filter(isAgentLegend),
  };
};

/** The official IPEA scale of an IVS/IDHM `mapDataId`, as a legend `colorBy` patch. */
const officialScalePatch = (mapDataId: unknown): UnknownRecord => {
  // `appendRealMapData` already checked every `mapDataId` is a string.
  const family = officialFaixasOf(String(mapDataId));
  return family
    ? {
        colorBy: {
          type: 'quantitative',
          property: 'value',
          scale: 'threshold',
          ...OFFICIAL_SCALES[family],
        },
      }
    : {};
};

/**
 * Where a legend without one is mounted: `GeoVisProvider` only renders a
 * legend that has a `position`, and the choropleth resolver sets none.
 */
const LEGEND_POSITION = 'bottom-right';

/** The legend fields the agent writes: text only, never the scale. */
const AGENT_TEXT_KEYS = ['title', 'subtitle', 'reference', 'noDataLabel'];

/** A resolver legend with the agent's text (its `title` wins over the `mapData` title) and the official scale. */
const withAppText = (params: {
  legend: UnknownRecord;
  entry: UnknownRecord;
  agentLegend: UnknownRecord | undefined;
}): UnknownRecord => {
  const { legend, entry, agentLegend } = params;
  const agentText = Object.fromEntries(
    AGENT_TEXT_KEYS.flatMap((key) => {
      const value = agentLegend?.[key];
      return value !== undefined ? [[key, value]] : [];
    })
  );
  return {
    ...legend,
    title: entry['title'] ?? legend['title'],
    position: legend['position'] ?? LEGEND_POSITION,
    ...agentText,
    ...officialScalePatch(entry['mapDataId']),
  };
};

/**
 * Applies this app's legend rules to a spec the resolver produced. Each
 * resolver legend takes the text of the agent legend at the position of the
 * `mapData` entry it paints (else that entry's `title`, replacing the English
 * `Circle size =` of proportional circles); an IVS/IDHM legend gets the
 * official IPEA faixas instead of Jenks breaks. Agent legends no resolver
 * legend takes (a points map, a map type with no generated legend) are kept
 * with the id `legend-<n>`. Every legend these rules touch gets a
 * `position` when it has none, so the map shows it.
 *
 * @param params.spec - The spec the geovis resolver produced (or an untyped one).
 * @param params.agentLegends - The legends {@link splitAgentLegends} split off.
 * @returns The spec with its legends rewritten.
 * @example
 * applyAppLegendRules({ spec: resolved, agentLegends: [{ title: 'IVS' }] });
 */
export const applyAppLegendRules = (params: {
  spec: UnknownRecord;
  agentLegends: UnknownRecord[];
}): UnknownRecord => {
  const { spec, agentLegends } = params;
  const mapData = recordsOf(spec['mapData']);
  const indexByLegend = new Map<unknown, number>(
    recordsOf(spec['layers']).flatMap((layer) => {
      const index = mapData.findIndex((data) => {
        return data['mapDataId'] === layer['mapDataId'];
      });
      return index >= 0 && layer['activeLegendId'] !== undefined
        ? [[layer['activeLegendId'], index] as const]
        : [];
    })
  );
  const taken = new Set<number>();
  const resolverLegends = recordsOf(spec['legends']).map((legend) => {
    const index = indexByLegend.get(legend['id']);
    if (index === undefined) {
      return legend;
    }
    taken.add(index);
    return withAppText({
      legend,
      entry: mapData[index],
      // deferred: pairs by position, right only with one `mapData` entry per map (the agent instructions' rule, not checked server-side); key legends by `mapDataId` if multi-entry maps are allowed.
      agentLegend: agentLegends.at(index),
    });
  });
  const leftovers = agentLegends.flatMap((legend, index) => {
    return taken.has(index)
      ? []
      : [{ id: `legend-${index + 1}`, position: LEGEND_POSITION, ...legend }];
  });
  return { ...spec, legends: [...resolverLegends, ...leftovers] };
};
