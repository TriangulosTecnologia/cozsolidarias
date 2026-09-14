import {
  isRenderableDatasetId,
  RENDERABLE_DATASET_FETCHERS,
  RENDERABLE_DATASET_IDS,
} from './mapDataCatalogue';

export type UnknownRecord = Record<string, unknown>;

export const isRecord = (value: unknown): value is UnknownRecord => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

export const invalidSpecResponse = (params?: {
  message?: string;
  issues?: Array<{ code: string; message: string }>;
  spec?: unknown;
}): Response => {
  return Response.json(
    {
      error:
        params?.message ??
        'O modelo retornou uma resposta inválida. Tente reformular o pedido.',
      ...(params?.issues ? { issues: params.issues } : {}),
      ...(params?.spec !== undefined ? { spec: params.spec } : {}),
    },
    { status: 422 }
  );
};

const unsupportedDatasetResponse = (
  mapDataId: string,
  spec: unknown
): Response => {
  return Response.json(
    {
      error: `Dataset "${mapDataId}" ainda não está disponível para visualização. Datasets suportados: ${RENDERABLE_DATASET_IDS.join(', ')}.`,
      spec,
    },
    { status: 422 }
  );
};

/**
 * The only `geojson` source URLs this app actually serves. A source's `data`
 * is never rewritten after generation (unlike `mapData[].data`), so a URL
 * outside this list — or an inline placeholder — silently ships a map with no
 * real data (404, or a literal empty `FeatureCollection`).
 */
export const KNOWN_SOURCE_URLS = [
  '/geo/geojs-100-mun.json',
  '/geo/estados.json',
  '/geo/assentamentos.json',
  '/api/cozinhas',
  '/api/cozinhas/bolhas',
] as const;

/** An inline, empty `FeatureCollection` — a placeholder the model sometimes emits instead of a real endpoint. */
const isEmptyInlineFeatureCollection = (data: unknown): boolean => {
  return (
    isRecord(data) &&
    data['type'] === 'FeatureCollection' &&
    Array.isArray(data['features']) &&
    data['features'].length === 0
  );
};

/** A URL string outside {@link KNOWN_SOURCE_URLS} — a hallucinated path that 404s client-side. */
const isUnknownSourceUrl = (data: unknown): boolean => {
  return (
    typeof data === 'string' &&
    !(KNOWN_SOURCE_URLS as readonly string[]).includes(data)
  );
};

/**
 * Finds the first `geojson` source whose `data` can't produce real geometry
 * (see {@link isEmptyInlineFeatureCollection} and {@link isUnknownSourceUrl}).
 */
export const findInvalidGeojsonSource = (
  spec: UnknownRecord
): string | null => {
  const sources = spec['sources'];
  if (!Array.isArray(sources)) {
    return null;
  }

  for (const source of sources) {
    if (!isRecord(source) || source['type'] !== 'geojson') {
      continue;
    }
    const data = source['data'];
    if (isEmptyInlineFeatureCollection(data) || isUnknownSourceUrl(data)) {
      return typeof source['id'] === 'string' ? source['id'] : 'desconhecida';
    }
  }

  return null;
};

/** A `mapData[]` entry's own `data`, when it's an inline `FeatureCollection` (geometry, not a join value). */
const isFeatureCollection = (data: unknown): boolean => {
  return isRecord(data) && data['type'] === 'FeatureCollection';
};

/**
 * Finds the first `mapData[]` entry that smuggles geometry instead of a join
 * value: either its `mapDataId` doubles as a `sources[].id` (so the agent
 * pointed the join at a geometry source itself, not a value keyed by
 * `geometryId`), or its own `data` is an inline `FeatureCollection`. Both
 * shapes pass `appendRealMapData`'s structural checks (a string
 * `mapDataId`), so this runs separately and first — `mapData` is a join,
 * never geometry, and a `sources[].id` collision or an embedded
 * `FeatureCollection` proves the model conflated the two.
 *
 * Ignores a non-array `mapData` (or non-record `sources`/entries) — those
 * shapes are already rejected by {@link appendRealMapData} and
 * {@link findInvalidGeojsonSource} respectively.
 */
export const findGeometryInMapData = (spec: UnknownRecord): string | null => {
  const mapData = spec['mapData'];
  if (!Array.isArray(mapData)) {
    return null;
  }

  const sources = spec['sources'];
  const sourceIds = new Set(
    Array.isArray(sources)
      ? sources.flatMap((source) => {
          return isRecord(source) && typeof source['id'] === 'string'
            ? [source['id']]
            : [];
        })
      : []
  );

  for (const entry of mapData) {
    if (!isRecord(entry)) {
      continue;
    }
    const mapDataId = entry['mapDataId'];
    const pointsAtASource =
      typeof mapDataId === 'string' && sourceIds.has(mapDataId);
    if (pointsAtASource || isFeatureCollection(entry['data'])) {
      return typeof mapDataId === 'string' ? mapDataId : 'desconhecido';
    }
  }

  return null;
};

/**
 * Whether the spec paints a variable (a non-empty `mapData[]`) without
 * declaring at least one `legends[]` entry to describe it. A spec with no
 * `mapData` at all (a bare base map) needs no legend — there is nothing
 * painted to explain.
 */
export const findMissingLegend = (spec: UnknownRecord): boolean => {
  const mapData = spec['mapData'];
  const paintsAVariable = Array.isArray(mapData) && mapData.length > 0;
  if (!paintsAVariable) {
    return false;
  }

  const legends = spec['legends'];
  return !Array.isArray(legends) || legends.length === 0;
};

/**
 * MapData Append (ADR-0001): resolves each `mapData[].mapDataId` the agent
 * emitted against {@link RENDERABLE_DATASET_FETCHERS} and replaces its
 * placeholder `data` with real `data-gateway` values. Returns a `Response`
 * (422) instead of the spec when an entry references a dataset outside
 * {@link RENDERABLE_DATASET_IDS} or the shape is malformed — never a spec
 * with stale/fictitious `data` reaches the client.
 */
export const appendRealMapData = async (
  spec: UnknownRecord
): Promise<UnknownRecord | Response> => {
  const mapData = spec['mapData'];
  if (mapData === undefined) {
    return spec;
  }
  if (!Array.isArray(mapData)) {
    return invalidSpecResponse({
      message: `O campo "mapData" deveria ser uma lista, mas o modelo retornou ${typeof mapData}.`,
      spec,
    });
  }

  const resolvedMapData: UnknownRecord[] = [];
  for (const entry of mapData) {
    if (!isRecord(entry) || typeof entry['mapDataId'] !== 'string') {
      return invalidSpecResponse({
        message:
          'Cada item de "mapData" precisa ser um objeto com "mapDataId" em formato de texto.',
        spec,
      });
    }

    const mapDataId = entry['mapDataId'];
    if (!isRenderableDatasetId(mapDataId)) {
      return unsupportedDatasetResponse(mapDataId, spec);
    }

    const data = await RENDERABLE_DATASET_FETCHERS[mapDataId]();
    resolvedMapData.push({ ...entry, data });
  }

  return { ...spec, mapData: resolvedMapData };
};
