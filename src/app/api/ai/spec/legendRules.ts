import {
  CADINSAN_COLORS,
  CADINSAN_LEGEND_LABELS,
  CADINSAN_THRESHOLDS,
  CADUNICO_COLORS,
  CADUNICO_THRESHOLDS,
  flooredBinLabels,
  PESSOAS_COZINHA_COLORS,
  PESSOAS_COZINHA_LEGEND_LABELS,
  PESSOAS_COZINHA_THRESHOLDS,
  WITHOUT_KITCHEN_COLOR,
} from '@/app/(features)/mapas/geovisChoroplethScales';
import {
  IDHM_FAMILY_COLORS,
  IDHM_FAMILY_THRESHOLDS,
  IDHM_LEGEND_LABELS,
  IVS_FAMILY_COLORS,
  IVS_FAMILY_THRESHOLDS,
  IVS_LEGEND_LABELS,
} from '@/app/(features)/mapas/geovisScoreScales';

import {
  isCadunicoRateId,
  officialFaixasOf,
  rateBaseOf,
} from './mapDataCatalogue';
import { isRecord, type UnknownRecord } from './specValidation';

/** A fixed legend scale: an official IPEA faixa family or a `/mapas` ruler. */
type FixedScale =
  | 'ivs'
  | 'idhm'
  | 'cadinsan'
  | 'cadunicoRate'
  | 'pessoasCozinha';

/**
 * The ids `/mapas` paints on a fixed ruler of its own (`CADINSAN_THRESHOLDS`,
 * `PESSOAS_COZINHA_THRESHOLDS`); a CadÚnico rate id, on any base, takes
 * `CADUNICO_THRESHOLDS` moved to its base. Fixed scales, not
 * official indexes: `findReclassifiedOfficialIndex` leaves them out, and the
 * legend rules put the ruler back whatever the agent wrote.
 */
const APP_SCALE_IDS: Record<string, FixedScale> = {
  municipios_cadinsan: 'cadinsan',
  municipios_cadinsan_sem_pbf: 'cadinsan',
  cadunico_pessoas_por_cozinha: 'pessoasCozinha',
};

/**
 * The fixed legend scale a renderable id is painted on: its official faixa
 * family (see {@link officialFaixasOf}), else the `/mapas` ruler of the
 * food-insecurity shares and the CadÚnico coverage ids. Read by the legend
 * rules, which replace the resolver's Jenks breaks with that scale.
 *
 * @param mapDataId - A `mapData[].mapDataId`.
 * @returns The {@link FixedScale}, or `undefined` when the scale is free.
 *
 * @example
 * fixedScaleOf('municipios_cadinsan_sem_pbf'); // 'cadinsan'
 * fixedScaleOf('cozinhas_por_100mil_cadunico'); // 'cadunicoRate'
 * fixedScaleOf('municipios_ivs'); // 'ivs'
 * fixedScaleOf('cozinhas_geolocalizadas'); // undefined
 */
export const fixedScaleOf = (mapDataId: string): FixedScale | undefined => {
  if (isCadunicoRateId(mapDataId)) {
    return 'cadunicoRate';
  }
  return (
    officialFaixasOf(mapDataId) ??
    (Object.hasOwn(APP_SCALE_IDS, mapDataId)
      ? APP_SCALE_IDS[mapDataId]
      : undefined)
  );
};

/** A legend scale: bands in `colorBy`, their names in `labelFormat`. */
type Scale = {
  thresholds: readonly number[];
  colors: readonly string[];
  labels: readonly string[];
  defaultColor?: string;
};

/**
 * The `/mapas` CadÚnico ruler (cozinhas per 10 mil) moved to `base`, the one
 * the map is computed on: each cutpoint × base / 10 mil (rounded off the float
 * noise), labels rebuilt from them, so the legend reads in the base the map
 * paints. On the 10 mil base it is the `/mapas` ruler itself.
 */
const cadunicoRateScale = (base: number): Scale => {
  const thresholds = CADUNICO_THRESHOLDS.map((threshold) => {
    return Math.round(((threshold * base) / 10_000) * 1e6) / 1e6;
  });
  return {
    thresholds,
    colors: CADUNICO_COLORS,
    labels: flooredBinLabels('Sem cozinha', thresholds),
    defaultColor: WITHOUT_KITCHEN_COLOR,
  };
};

const recordsOf = (value: unknown): UnknownRecord[] => {
  return Array.isArray(value) ? value.filter(isRecord) : [];
};

/**
 * The fixed scale of each family, as `/mapas` paints it. The `/mapas` rulers
 * carry its grey `defaultColor`: their first color is a vestigial ramp step,
 * not the "Sem dado" grey the IVS/IDHM colors start with.
 */
const FIXED_SCALES: Record<Exclude<FixedScale, 'cadunicoRate'>, Scale> = {
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
  pessoasCozinha: {
    thresholds: PESSOAS_COZINHA_THRESHOLDS,
    colors: PESSOAS_COZINHA_COLORS,
    labels: PESSOAS_COZINHA_LEGEND_LABELS,
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

/** A scale as a legend patch: the bands in `colorBy`, their names in `labelFormat` (geovis has no `colorBy.labels`). */
const scalePatch = (scale: Scale): UnknownRecord => {
  const { thresholds, colors, labels, defaultColor } = scale;
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
 * The fixed scale of a `mapDataId` (official IVS/IDHM faixas, a `/mapas`
 * ruler) as a legend patch. A CadÚnico rate takes the ruler on the base its
 * id names ({@link rateBaseOf}), the one its values were computed on, and
 * carries that base as the legend's geovis `normalization`, where the `/ia`
 * hover card reads it.
 */
const fixedScalePatch = (rawMapDataId: unknown): UnknownRecord => {
  // `appendRealMapData` already checked every `mapDataId` is a string.
  const mapDataId = String(rawMapDataId);
  const family = fixedScaleOf(mapDataId);
  if (!family) {
    return {};
  }
  if (family !== 'cadunicoRate') {
    return scalePatch(FIXED_SCALES[family]);
  }
  const base = rateBaseOf(mapDataId);
  return {
    normalization: {
      type: 'rate',
      numeratorLabel: 'cozinhas',
      denominatorLabel: 'pessoas no CadÚnico',
      rateBase: base,
    },
    ...scalePatch(cadunicoRateScale(base)),
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
  };
};

/**
 * Applies this app's legend rules to a spec the resolver produced. Each
 * resolver legend takes the text of the agent legend at the position of the
 * `mapData` entry it paints (else that entry's `title`, replacing the English
 * `Circle size =` of proportional circles); an IVS/IDHM legend gets the
 * official IPEA faixas, a CADINSAN or CadÚnico one its `/mapas` ruler (a
 * CadÚnico rate on the base its id names), instead of Jenks breaks. Agent legends no resolver
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
