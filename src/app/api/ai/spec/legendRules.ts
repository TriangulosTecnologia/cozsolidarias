import {
  CADINSAN_COLORS,
  CADINSAN_LEGEND_LABELS,
  CADINSAN_THRESHOLDS,
  CADUNICO_COLORS,
  flooredBinLabels,
  PESSOAS_COZINHA_COLORS,
  WITHOUT_KITCHEN_COLOR,
} from '@/app/(features)/mapas/geovisChoroplethScales';
import type { MapMode } from '@/app/(features)/mapas/geovisMapMode';
import { jenksBreaksForMode } from '@/app/(features)/mapas/geovisScales';
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

/**
 * The ids `/mapas` paints on its fixed CADINSAN ruler (`CADINSAN_THRESHOLDS`).
 * A fixed scale, not an official index: `findReclassifiedOfficialIndex` leaves
 * them out, and the legend rules put the ruler back whatever the agent wrote.
 */
const CADINSAN_SCALE_IDS: readonly string[] = [
  'municipios_cadinsan',
  'municipios_cadinsan_sem_pbf',
];

/**
 * The fixed legend scale a renderable id is painted on: its official faixa
 * family (see {@link officialFaixasOf}), else `'cadinsan'` for the two
 * food-insecurity shares. Read by the legend rules, which replace the
 * resolver's Jenks breaks with that scale.
 *
 * @param mapDataId - A `mapData[].mapDataId`.
 * @returns `'ivs'`, `'idhm'`, `'cadinsan'` or `undefined` when the scale is free.
 *
 * @example
 * fixedScaleOf('municipios_cadinsan_sem_pbf'); // 'cadinsan'
 * fixedScaleOf('municipios_ivs'); // 'ivs'
 * fixedScaleOf('cozinhas_geolocalizadas'); // undefined
 */
export const fixedScaleOf = (
  mapDataId: string
): 'ivs' | 'idhm' | 'cadinsan' | undefined => {
  return (
    officialFaixasOf(mapDataId) ??
    (CADINSAN_SCALE_IDS.includes(mapDataId) ? 'cadinsan' : undefined)
  );
};

const recordsOf = (value: unknown): UnknownRecord[] => {
  return Array.isArray(value) ? value.filter(isRecord) : [];
};

/**
 * The fixed scale of each family, as `/mapas` paints it. CADINSAN carries
 * `/mapas`'s grey `defaultColor`: its first color is a vestigial ramp step,
 * not the "Sem dado" grey the IVS/IDHM colors start with.
 */
const FIXED_SCALES: Record<
  'ivs' | 'idhm' | 'cadinsan',
  {
    thresholds: readonly number[];
    colors: readonly string[];
    labels: readonly string[];
    defaultColor?: string;
  }
> = {
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
  cadinsan: {
    thresholds: CADINSAN_THRESHOLDS,
    colors: CADINSAN_COLORS,
    labels: CADINSAN_LEGEND_LABELS,
    defaultColor: WITHOUT_KITCHEN_COLOR,
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

/**
 * The fixed scale of a `mapDataId` (official IVS/IDHM faixas, the CADINSAN
 * ruler), as a legend patch: the bands in `colorBy`, their names in the
 * legend's `labelFormat` (geovis has no `colorBy.labels`).
 */
const fixedScalePatch = (mapDataId: unknown): UnknownRecord => {
  // `appendRealMapData` already checked every `mapDataId` is a string.
  const family = fixedScaleOf(String(mapDataId));
  if (!family) {
    return {};
  }
  const { thresholds, colors, labels, defaultColor } = FIXED_SCALES[family];
  return {
    colorBy: {
      type: 'quantitative',
      property: 'value',
      scale: 'threshold',
      thresholds,
      colors,
      ...(defaultColor === undefined ? {} : { defaultColor }),
    },
    labelFormat: { type: 'labels', labels },
  };
};

/**
 * The `/mapas` mode whose data-driven (Jenks) legend each CadÚnico coverage id
 * gets, with that mode's colors. The 100 mil id shares the 10 mil mode, but its
 * breaks are fitted to its own values, so its labels never repeat the 10 mil ones.
 */
const JENKS_SCALES: Record<string, { mode: MapMode; colors: string[] }> = {
  cozinhas_por_10mil_cadunico: {
    mode: 'coropletico-cadunico',
    colors: CADUNICO_COLORS,
  },
  cozinhas_por_100mil_cadunico: {
    mode: 'coropletico-cadunico',
    colors: CADUNICO_COLORS,
  },
  cadunico_pessoas_por_cozinha: {
    mode: 'coropletico-pessoas-cozinha',
    colors: PESSOAS_COZINHA_COLORS,
  },
};

/**
 * A coverage id's legend as `/mapas` draws it: the Jenks breaks of the painted
 * values (`jenksBreaksForMode`), the mode's colors and its "Sem cozinha"
 * labels. Nothing when the values are too few to split: the resolver's legend stays.
 */
const jenksScalePatch = (entry: UnknownRecord): UnknownRecord => {
  const id = String(entry['mapDataId']);
  if (!Object.hasOwn(JENKS_SCALES, id)) {
    return {};
  }
  const { mode, colors } = JENKS_SCALES[id];
  const thresholds = jenksBreaksForMode(
    mode,
    recordsOf(entry['data']).map((row) => {
      return typeof row['value'] === 'number' ? row['value'] : null;
    })
  );
  if (!thresholds) {
    return {};
  }
  return {
    colorBy: {
      type: 'quantitative',
      property: 'value',
      scale: 'threshold',
      thresholds,
      colors,
      defaultColor: WITHOUT_KITCHEN_COLOR,
    },
    labelFormat: {
      type: 'labels',
      labels: flooredBinLabels('Sem cozinha', thresholds),
    },
  };
};

/**
 * Where a legend without one is mounted: `GeoVisProvider` only renders a
 * legend that has a `position`, and the choropleth resolver sets none.
 */
const LEGEND_POSITION = 'bottom-right';

/** The legend fields the agent writes: text only, never the scale. */
const AGENT_TEXT_KEYS = ['title', 'subtitle', 'reference', 'noDataLabel'];

/** A resolver legend with the agent's text (its `title` wins over the `mapData` title) and the fixed scale. */
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
    ...fixedScalePatch(entry['mapDataId']),
    ...jenksScalePatch(entry),
  };
};

/**
 * Applies this app's legend rules to a spec the resolver produced. Each
 * resolver legend takes the text of the agent legend at the position of the
 * `mapData` entry it paints (else that entry's `title`, replacing the English
 * `Circle size =` of proportional circles); an IVS/IDHM legend gets the
 * official IPEA faixas, and a CADINSAN one the `/mapas` ruler
 * (`CADINSAN_THRESHOLDS`, `CADINSAN_LEGEND_LABELS`), instead of Jenks breaks. Agent legends no resolver
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
