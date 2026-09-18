import { gateway } from '@/gateway';

export type UnknownRecord = Record<string, unknown>;

export const KNOWN_SOURCE_URLS = [
  '/geo/geojs-100-mun.json',
  '/geo/estados.json',
  '/api/cozinhas',
  '/api/cozinhas/bolhas',
] as const;

export const isRecord = (value: unknown): value is UnknownRecord => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

export const SOURCE_METADATA: Record<
  (typeof KNOWN_SOURCE_URLS)[number],
  {
    filepath: string | null;
    description: string;
    resolver: (() => Promise<UnknownRecord>) | null;
  }
> = {
  '/geo/geojs-100-mun.json': {
    filepath: 'public/geo/geojs-100-mun.json',
    description: 'Municípios do Brasil (IBGE, Código IBGE como geometryId)',
    resolver: null,
  },
  '/geo/estados.json': {
    filepath: 'public/geo/estados.json',
    description:
      'Estados brasileiros (contexto/contorno, não pode pintar dados)',
    resolver: null,
  },
  '/api/cozinhas': {
    filepath: null,
    description: 'Pontos de cozinhas comunitárias (agregados por município)',
    resolver: async () => {
      return (await gateway.getCozinhas()) as unknown as UnknownRecord;
    },
  },
  '/api/cozinhas/bolhas': {
    filepath: null,
    description: 'Clusters/bolhas de cozinhas (agregação espacial para zoom)',
    resolver: async () => {
      return (await gateway.getCozinhasBubbles()) as unknown as UnknownRecord;
    },
  },
};

/**
 * Sources that may only ever provide context (an outline, a backdrop), never
 * the geometry a variable is painted onto. Today that is the state layer:
 * every renderable dataset joins at municipality grain (`codarea`), so a
 * `mapData` painted against state polygons would silently render a map whose
 * colours answer a different question than the one asked — the same rule
 * `SOURCE_METADATA`'s own description states in prose ("contexto/contorno,
 * não pode pintar dados"), enforced here structurally.
 */
const CONTEXT_ONLY_SOURCES = new Set(['/geo/estados.json'] as const);

const POLYGON_SOURCES = new Set([
  '/geo/geojs-100-mun.json',
  '/geo/estados.json',
] as const);

const POINT_SOURCES = new Set([
  '/api/cozinhas',
  '/api/cozinhas/bolhas',
] as const);

const buildSourceGeometryMap = (
  sources: unknown[]
): Map<string, 'polygon' | 'point'> => {
  const map = new Map<string, 'polygon' | 'point'>();
  for (const source of sources) {
    if (!isRecord(source) || typeof source['id'] !== 'string') continue;
    const data = source['data'];
    if (typeof data !== 'string') continue;
    if ((POLYGON_SOURCES as ReadonlySet<string>).has(data)) {
      map.set(source['id'], 'polygon');
    } else if ((POINT_SOURCES as ReadonlySet<string>).has(data)) {
      map.set(source['id'], 'point');
    }
  }
  return map;
};

const checkLayerGeometryMatch = (
  layer: UnknownRecord,
  sourceGeometries: Map<string, 'polygon' | 'point'>
): { layerId: string; sourceId: string } | null => {
  const layerId = layer['id'];
  const layerGeometry = layer['geometry'];
  const sourceId = layer['sourceId'];
  if (
    typeof layerId !== 'string' ||
    typeof layerGeometry !== 'string' ||
    typeof sourceId !== 'string'
  )
    return null;

  const sourceGeometry = sourceGeometries.get(sourceId);
  if (!sourceGeometry) return null;

  const isPointLayer = layerGeometry === 'point' || layerGeometry === 'symbol';
  if (isPointLayer && sourceGeometry === 'polygon')
    return { layerId, sourceId };
  if (layerGeometry === 'polygon' && sourceGeometry === 'point')
    return { layerId, sourceId };
  return null;
};

export const findSourceGeometryMismatch = (
  spec: UnknownRecord
): { layerId: string; sourceId: string } | null => {
  const sources = spec['sources'];
  if (!Array.isArray(sources)) return null;
  const sourceGeometries = buildSourceGeometryMap(sources);

  const layers = spec['layers'];
  if (!Array.isArray(layers)) return null;

  for (const layer of layers) {
    if (!isRecord(layer)) continue;
    const mismatch = checkLayerGeometryMatch(layer, sourceGeometries);
    if (mismatch) return mismatch;
  }
  return null;
};

/**
 * Finds the first layer that paints a variable (`mapDataId`) onto a
 * context-only source (see {@link CONTEXT_ONLY_SOURCES}). Every renderable
 * dataset joins at municipality grain, so painting one against state polygons
 * renders a map that looks plausible while answering a different question —
 * a failure no schema check catches, because the spec is structurally valid.
 *
 * A context layer with no `mapDataId` (an outline, a backdrop) is exactly the
 * intended use and passes.
 */
const collectContextSourceIds = (sources: unknown[]): Set<string> => {
  const ids = new Set<string>();
  for (const source of sources) {
    if (!isRecord(source) || typeof source['id'] !== 'string') continue;
    const data = source['data'];
    if (
      typeof data === 'string' &&
      (CONTEXT_ONLY_SOURCES as ReadonlySet<string>).has(data)
    ) {
      ids.add(source['id']);
    }
  }
  return ids;
};

export const findPaintedContextLayer = (
  spec: UnknownRecord
): { layerId: string; sourceId: string } | null => {
  const sources = spec['sources'];
  if (!Array.isArray(sources)) return null;

  const contextSourceIds = collectContextSourceIds(sources);
  if (contextSourceIds.size === 0) return null;

  const layers = spec['layers'];
  if (!Array.isArray(layers)) return null;

  for (const layer of layers) {
    if (!isRecord(layer)) continue;
    const layerId = layer['id'];
    const sourceId = layer['sourceId'];
    if (typeof layerId !== 'string' || typeof sourceId !== 'string') continue;
    if (layer['mapDataId'] !== undefined && contextSourceIds.has(sourceId)) {
      return { layerId, sourceId };
    }
  }
  return null;
};

/**
 * Source types this route accepts from the agent. The app itself does serve
 * vector tiles (`/tiles/caf-h3-*`), but those endpoints are wired by the map
 * builder, not exposed to the agent — it only ever knows the GeoJSON URLs in
 * {@link KNOWN_SOURCE_URLS}, so any other type in its reply is a tile/DEM/video
 * URL it invented. Rejecting the type outright also subsumes the
 * "`vector-tiles` needs `sourceLayer`" and "`filter` only works on `geojson`"
 * rules: neither can be violated once every source is `geojson`.
 */
const SUPPORTED_SOURCE_TYPE = 'geojson';

/**
 * Finds the first source whose `type` this route doesn't accept (see
 * {@link SUPPORTED_SOURCE_TYPE}). Complements `findInvalidGeojsonSource`,
 * which only inspects sources already declared `geojson` — a hallucinated
 * `vector-tiles` entry slips past that check untouched.
 *
 * @returns `"<source id> (<type>)"` for the first unsupported source, or `null`.
 */
export const findUnsupportedSourceType = (
  spec: UnknownRecord
): string | null => {
  const sources = spec['sources'];
  if (!Array.isArray(sources)) return null;

  for (const source of sources) {
    if (!isRecord(source)) continue;
    const type = source['type'];
    if (type === SUPPORTED_SOURCE_TYPE) continue;
    const id = typeof source['id'] === 'string' ? source['id'] : 'desconhecida';
    return `${id} (${typeof type === 'string' ? type : 'sem tipo'})`;
  }

  return null;
};
