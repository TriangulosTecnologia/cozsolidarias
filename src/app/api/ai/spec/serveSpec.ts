import { resolveSpecFromMapType, type VisualizationSpec } from '@ttoss/geovis';

import {
  buildCozinhasChoroplethSpec,
  isCozinhasChoroplethRequest,
} from './canonicalChoropleth';
import { logGeneration } from './generationLogger';
import { applyAppLegendRules, splitAgentLegends } from './legendRules';
import { applyProportionalCirclesDefaults } from './specDefaults';
import {
  appendRealMapData,
  appendRealSourceData,
  errorResponse,
  invalidSpecResponse,
  isRecord,
  KNOWN_SOURCE_URLS,
  SOURCE_METADATA,
  type UnknownRecord,
} from './specValidation';

const arrayOf = (value: unknown): unknown[] => {
  return Array.isArray(value) ? value : [];
};

const recordsOf = (value: unknown): UnknownRecord[] => {
  return arrayOf(value).filter(isRecord);
};

/** The well-known source a `sourceId` names (see `SOURCE_METADATA[].id`), as a source entry. */
const wellKnownSource = (
  id: string,
  query: string
): UnknownRecord | undefined => {
  const url = KNOWN_SOURCE_URLS.find((known) => {
    return SOURCE_METADATA[known].id === id;
  });
  return url ? { id, type: 'geojson', data: `${url}${query}` } : undefined;
};

/** `?ano=<year>` for a dataset id pinned to a snapshot year (`…_2025`), else empty. */
const yearQueryOf = (mapDataId: unknown): string => {
  const year =
    typeof mapDataId === 'string' ? /_(\d{4})$/.exec(mapDataId)?.[1] : null;
  return year ? `?ano=${year}` : '';
};

/** The map types the geovis resolver draws as a `point` layer. */
const POINT_MAP_TYPES: unknown[] = ['proportionalCircles', 'dotDensity'];

/**
 * Every renderable dataset is keyed by município (catalogue grain
 * `municipality`): area maps join the município polygons; kitchen counts drawn
 * as circles or dots join the per-município bubbles, the only point source
 * keyed by `codarea` (a point layer on polygons draws one circle per vertex).
 */
const mapIdOf = (params: { mapType: unknown; mapDataId: unknown }): string => {
  return POINT_MAP_TYPES.includes(params.mapType) &&
    typeof params.mapDataId === 'string' &&
    params.mapDataId.startsWith('cozinhas_')
    ? 'cozinhas-bolhas'
    : 'municipios';
};

/**
 * Fills in what the agent no longer writes: each `mapData[].mapId` (see
 * {@link mapIdOf}), each `layers[].id` (`${sourceId}-${geometry}`), and every
 * well-known source a layer or `mapData` entry references without declaring it
 * (see `SOURCE_METADATA`). Values the agent did write are kept.
 *
 * @param spec - The agent spec merged over the base spec.
 * @returns A new spec with the derived fields filled in.
 *
 * @example
 * deriveAgentStructure({ layers: [{ sourceId: 'cozinhas', geometry: 'point' }] });
 * // layers => [{ id: 'cozinhas-point', ... }], sources => [{ id: 'cozinhas', data: '/api/cozinhas', ... }]
 */
export const deriveAgentStructure = (spec: UnknownRecord): UnknownRecord => {
  // A non-array `mapData` or a non-record entry is kept as is, so
  // `appendRealMapData` reports it with its own message.
  const mapData = arrayOf(spec['mapData']).map((entry) => {
    return isRecord(entry) && entry['mapId'] === undefined
      ? {
          ...entry,
          mapId: mapIdOf({
            mapType: spec['mapType'],
            mapDataId: entry['mapDataId'],
          }),
        }
      : entry;
  });
  const layers = arrayOf(spec['layers']).map((layer) => {
    return isRecord(layer) && layer['id'] === undefined
      ? {
          ...layer,
          id: `${String(layer['sourceId'])}-${String(layer['geometry'])}`,
        }
      : layer;
  });
  const sources = recordsOf(spec['sources']);
  const declared = new Set(
    sources.map((source) => {
      return source['id'];
    })
  );
  const referenced = [
    ...mapData.filter(isRecord).map((entry) => {
      return [entry['mapId'], yearQueryOf(entry['mapDataId'])] as const;
    }),
    ...layers.filter(isRecord).map((layer) => {
      return [layer['sourceId'], ''] as const;
    }),
  ];
  const injected = referenced.flatMap(([id, query]) => {
    if (typeof id !== 'string' || declared.has(id)) {
      return [];
    }
    declared.add(id);
    const source = wellKnownSource(id, query);
    return source ? [source] : [];
  });

  return {
    ...spec,
    ...(Array.isArray(spec['mapData']) ? { mapData } : {}),
    ...(Array.isArray(spec['layers']) ? { layers } : {}),
    sources: [...sources, ...injected],
  };
};

/** The first `mapData` entry no layer paints, if any. */
const unpaintedMapDataId = (spec: UnknownRecord): unknown => {
  const painted = new Set(
    recordsOf(spec['layers']).map((layer) => {
      return layer['mapDataId'];
    })
  );
  return recordsOf(spec['mapData']).find((entry) => {
    return !painted.has(entry['mapDataId']);
  })?.['mapDataId'];
};

/** Narrows a spec to the shape `resolveSpecFromMapType` reads (`sources` and `layers` arrays). */
const isResolvable = (
  spec: UnknownRecord
): spec is UnknownRecord & VisualizationSpec => {
  return Array.isArray(spec['sources']) && Array.isArray(spec['layers']);
};

/**
 * The steps after real `mapData`: `mapType` expanded by the geovis resolver,
 * the app's legend rules, the unpainted-`mapData` check, proportional-circles
 * sizing and real API-backed sources. A spec with no `mapType` and no agent
 * legend only gets its sources resolved.
 */
const finishResolution = async (params: {
  spec: UnknownRecord;
  agentLegends: UnknownRecord[];
}): Promise<UnknownRecord | Response> => {
  const { spec, agentLegends } = params;
  const isTyped = spec['mapType'] !== undefined && isResolvable(spec);
  if (!isTyped && agentLegends.length === 0) {
    return appendRealSourceData(spec);
  }

  const resolved = applyAppLegendRules({
    spec: isTyped ? { ...resolveSpecFromMapType(spec) } : spec,
    agentLegends,
  });
  const unpainted = unpaintedMapDataId(resolved);
  if (unpainted !== undefined) {
    return invalidSpecResponse({
      message: `O dataset "${String(unpainted)}" foi declarado em "mapData", mas nenhuma camada o pinta. Peça um dataset por mapa.`,
      spec: resolved,
    });
  }

  return appendRealSourceData(applyProportionalCirclesDefaults(resolved));
};

/**
 * Turns a base-merged agent spec into the spec that is validated and served:
 * {@link deriveAgentStructure}; real `mapData` (or the `/mapas` cozinhas
 * choropleth, see {@link buildCozinhasChoroplethSpec}); `mapType` resolved by
 * geovis into layers and legends, with the agent's top-level legend text and
 * this app's legend rules ({@link applyAppLegendRules}) and proportional-circles
 * sizing; then real API-backed sources. Answers 422 for a spec that cannot become a map (no or
 * unknown `mapData`, a `mapData` entry no layer paints, an empty source).
 *
 * @param spec - The agent spec merged over the base spec.
 * @returns The resolved spec, or the 422 `Response`.
 *
 * @example
 * const served = await resolveCandidate(mergeSpecs(base, agentSpec));
 */
export const resolveCandidate = async (
  spec: UnknownRecord
): Promise<UnknownRecord | Response> => {
  const derived = deriveAgentStructure(spec);
  if (isCozinhasChoroplethRequest(derived)) {
    return appendRealSourceData(await buildCozinhasChoroplethSpec());
  }

  const { spec: withoutAgentLegends, agentLegends } =
    splitAgentLegends(derived);
  const withMapData = await appendRealMapData(withoutAgentLegends);
  if (withMapData instanceof Response) {
    return withMapData;
  }

  return finishResolution({ spec: withMapData, agentLegends });
};

/**
 * {@link resolveCandidate} for the route: a gateway failure is logged with its
 * cause (see {@link logGeneration}) and answered with a fixed 502.
 */
export const resolveServedSpec = async (params: {
  prompt: string;
  spec: UnknownRecord;
}): Promise<UnknownRecord | Response> => {
  try {
    return await resolveCandidate(params.spec);
  } catch (error) {
    logGeneration({
      prompt: params.prompt,
      reply: {
        cause: error instanceof Error ? error.message : String(error),
      },
    });
    // A gateway rejection after the session exists is a 502, with the session
    // id attached by the caller; the message is fixed so no internal detail leaks.
    return errorResponse({
      status: 502,
      message:
        'Não foi possível carregar os dados do mapa. Tente novamente em instantes.',
    });
  }
};
