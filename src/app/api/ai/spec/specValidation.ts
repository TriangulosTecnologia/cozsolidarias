import {
  ABSOLUTE_TOTAL_DATASET_IDS,
  isRenderableDatasetId,
  RENDERABLE_DATASET_FETCHERS,
  RENDERABLE_DATASET_IDS,
} from './mapDataCatalogue';
import { SOURCE_METADATA } from './specValidation.sources';

export { buildSourcesTable } from './specValidation.helpers';
export { findSourceGeometryMismatch } from './specValidation.sources';

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

/**
 * The only MapLibre style URLs this app allows for `basemap.styleUrl` — a
 * style JSON endpoint (tile *layer definitions*), never a raw raster tile
 * template like `https://tile.openstreetmap.org/{z}/{x}/{y}.png`. MapLibre
 * fetches `styleUrl` as a style document, so a tile template 404s/CORS-fails
 * client-side instead of rendering a basemap.
 */
export const KNOWN_BASEMAP_STYLE_URLS = [
  'https://tiles.openfreemap.org/styles/positron',
] as const;

/**
 * Finds an invalid `basemap.styleUrl` — present but outside
 * {@link KNOWN_BASEMAP_STYLE_URLS} (a hallucinated or raster-tile-template
 * URL, see {@link KNOWN_BASEMAP_STYLE_URLS}'s docs). A spec with no
 * `basemap.styleUrl` at all is fine — the app's own default style applies.
 */
export const findInvalidBasemapStyleUrl = (
  spec: UnknownRecord
): string | null => {
  const basemap = spec['basemap'];
  if (!isRecord(basemap)) {
    return null;
  }

  const styleUrl = basemap['styleUrl'];
  if (styleUrl === undefined) {
    return null;
  }

  if (
    typeof styleUrl !== 'string' ||
    !(KNOWN_BASEMAP_STYLE_URLS as readonly string[]).includes(styleUrl)
  ) {
    return typeof styleUrl === 'string' ? styleUrl : 'desconhecido';
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

/** Whether a `legends[]` value carries at least one entry. */
const hasLegendEntries = (legends: unknown): boolean => {
  return Array.isArray(legends) && legends.length > 0;
};

/**
 * Whether any `layers[]` entry declares its own non-empty `legends[]` — a
 * legend scoped to one layer, as valid per `@ttoss/geovis` as the spec-level
 * `legends[]` (see `GeoVisLegend.utils.tsx`'s `layer.legends?.find(...) ??
 * specLegends?.find(...)` resolution order).
 */
const hasLayerLegend = (spec: UnknownRecord): boolean => {
  const layers = spec['layers'];
  if (!Array.isArray(layers)) {
    return false;
  }

  return layers.some((layer) => {
    return isRecord(layer) && hasLegendEntries(layer['legends']);
  });
};

/**
 * Whether the spec paints a variable (a non-empty `mapData[]`) without
 * declaring at least one legend to describe it — either at the top level
 * (`spec.legends[]`) or scoped to a layer (`layers[].legends[]`, see
 * {@link hasLayerLegend}). A spec with no `mapData` at all (a bare base map)
 * needs no legend — there is nothing painted to explain.
 */
export const findMissingLegend = (spec: UnknownRecord): boolean => {
  const mapData = spec['mapData'];
  const paintsAVariable = Array.isArray(mapData) && mapData.length > 0;
  if (!paintsAVariable) {
    return false;
  }

  return !hasLegendEntries(spec['legends']) && !hasLayerLegend(spec);
};

/**
 * Finds the first `mapData[].mapDataId` that references an absolute-total
 * dataset (see {@link ABSOLUTE_TOTAL_DATASET_IDS}) while the spec paints it
 * as a choropleth (`spec.mapType === 'choropleth'`) — Bertin's area-bias
 * rule, already stated in prose in both the dataset's own catalogue
 * `description` and `route.ts`'s `INSTRUCTIONS`, enforced here structurally
 * instead of trusting the model to follow the prompt.
 *
 * A spec with no `mapType` (or a hand-built spec that never sets it) isn't
 * checked — this guard only catches the `mapType` shorthand the agent is
 * instructed to use, the same scope as the rest of this file's structural
 * checks.
 */
export const findChoroplethOnAbsoluteTotal = (
  spec: UnknownRecord
): string | null => {
  if (spec['mapType'] !== 'choropleth') {
    return null;
  }

  const mapData = spec['mapData'];
  if (!Array.isArray(mapData)) {
    return null;
  }

  for (const entry of mapData) {
    if (!isRecord(entry)) {
      continue;
    }
    const mapDataId = entry['mapDataId'];
    if (
      typeof mapDataId === 'string' &&
      (ABSOLUTE_TOTAL_DATASET_IDS as readonly string[]).includes(mapDataId)
    ) {
      return mapDataId;
    }
  }

  return null;
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
  for (const [index, entry] of mapData.entries()) {
    if (!isRecord(entry)) {
      return invalidSpecResponse({
        message: `O item ${index} de "mapData" precisa ser um objeto, mas veio ${typeof entry}.`,
        spec,
      });
    }
    if (typeof entry['mapDataId'] !== 'string') {
      return invalidSpecResponse({
        message: `O item ${index} de "mapData" precisa ter "mapDataId" em formato de texto, mas veio ${typeof entry['mapDataId']}.`,
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

/**
 * Sources Append: resolves each `sources[]` entry whose `data` URL carries a
 * {@link SOURCE_METADATA} `resolver` (an API-backed source, e.g.
 * `/api/cozinhas`) against its real `data-gateway` value, replacing the
 * agent's URL string with the fetched GeoJSON — the same ADR-0001 pattern
 * {@link appendRealMapData} applies to `mapData`. A source with no resolver
 * (a static file under `public/geo/`) is left untouched; the client fetches
 * that URL itself.
 *
 * Must run after {@link findInvalidGeojsonSource} — that check only knows
 * the URL is one of {@link KNOWN_SOURCE_URLS}; only once the resolver's
 * promise settles here can an unexpectedly empty real result (e.g. no
 * cozinhas for the requested year) be told apart from the model's own
 * placeholder empty `FeatureCollection`, which is why this returns a 422
 * `Response` on that case instead of shipping an empty layer to the client.
 */
export const appendRealSourceData = async (
  spec: UnknownRecord
): Promise<UnknownRecord | Response> => {
  const sources = spec['sources'];
  if (!Array.isArray(sources)) {
    return spec;
  }

  const resolvedSources: unknown[] = [];
  for (const source of sources) {
    if (!isRecord(source) || source['type'] !== 'geojson') {
      resolvedSources.push(source);
      continue;
    }

    const data = source['data'];
    const resolver =
      typeof data === 'string' &&
      (KNOWN_SOURCE_URLS as readonly string[]).includes(data)
        ? SOURCE_METADATA[data as (typeof KNOWN_SOURCE_URLS)[number]].resolver
        : null;

    if (!resolver) {
      resolvedSources.push(source);
      continue;
    }

    const resolved = await resolver();
    if (isEmptyInlineFeatureCollection(resolved)) {
      return invalidSpecResponse({
        message: `A source "${typeof source['id'] === 'string' ? source['id'] : 'desconhecida'}" (${data}) não retornou nenhuma feição para este pedido. Tente reformular ou escolher outro recorte.`,
        spec,
      });
    }

    resolvedSources.push({ ...source, data: resolved });
  }

  return { ...spec, sources: resolvedSources };
};
