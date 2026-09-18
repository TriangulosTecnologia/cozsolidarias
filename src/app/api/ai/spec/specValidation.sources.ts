import { gateway } from '@/gateway';

export type UnknownRecord = Record<string, unknown>;

export const KNOWN_SOURCE_URLS = [
  '/geo/geojs-100-mun.json',
  '/geo/estados.json',
  '/geo/assentamentos.json',
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
  '/geo/assentamentos.json': {
    filepath: 'public/geo/assentamentos.json',
    description: 'Assentamentos de reforma agrária',
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

const POLYGON_SOURCES = new Set([
  '/geo/geojs-100-mun.json',
  '/geo/estados.json',
  '/geo/assentamentos.json',
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
