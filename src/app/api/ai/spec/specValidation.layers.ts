import { isRecord, type UnknownRecord } from './specValidation.sources';

/** The `mapType` shorthands whose resolver paints values joined from `mapData`. */
const DATA_DRIVEN_MAP_TYPES = [
  'choropleth',
  'dotDensity',
  'proportionalCircles',
] as const;

/** Whether any layer reads its values straight off feature properties instead of a join. */
const hasPropertyNameLayer = (spec: UnknownRecord): boolean => {
  const layers = spec['layers'];
  if (!Array.isArray(layers)) {
    return false;
  }
  return layers.some((layer) => {
    return isRecord(layer) && typeof layer['propertyName'] === 'string';
  });
};

/** Every `sources[].id` declared in the spec. */
const collectSourceIds = (spec: UnknownRecord): Set<string> => {
  const sources = spec['sources'];
  if (!Array.isArray(sources)) {
    return new Set();
  }
  return new Set(
    sources.flatMap((source) => {
      return isRecord(source) && typeof source['id'] === 'string'
        ? [source['id']]
        : [];
    })
  );
};

/**
 * Whether `mapData` is present in a shape `appendRealMapData` will reject
 * itself. Its message names the offending index, which is strictly more
 * actionable, so {@link findMapTypeWithoutMapData} defers rather than
 * reporting the same spec twice with a vaguer reason.
 */
const hasMalformedMapData = (mapData: unknown): boolean => {
  if (mapData === undefined) {
    return false;
  }
  return (
    !Array.isArray(mapData) ||
    mapData.some((entry) => {
      return !isRecord(entry);
    })
  );
};

/** Whether some `mapData[].mapId` points at a source the spec actually declares. */
const joinsDeclaredSource = (
  mapData: unknown,
  sourceIds: Set<string>
): boolean => {
  if (!Array.isArray(mapData)) {
    return false;
  }
  return mapData.some((entry) => {
    return (
      isRecord(entry) &&
      typeof entry['mapId'] === 'string' &&
      sourceIds.has(entry['mapId'])
    );
  });
};

/**
 * Finds a `mapType` shorthand that will resolve to nothing: one of
 * {@link DATA_DRIVEN_MAP_TYPES} with no `mapData[]` entry whose `mapId`
 * matches a declared source.
 *
 * This is the one structural failure that survives every other gate. The
 * resolver (`resolveSpecFromMapType`) runs client-side, after validation, and
 * degrades silently — `choropleth` falls back to "the first geojson source",
 * and when it finds none it returns `{ layers: [], legends: [] }` without
 * raising. The spec is schema-valid, `validateSpec` reports `resolved`, and
 * the user gets a blank map with no error anywhere.
 *
 * `proportionalCircles` is exempt when a layer carries `propertyName`: that
 * variant sizes circles straight off feature properties and legitimately has
 * no `mapData`.
 *
 * @returns The offending `mapType`, or `null` when it resolves against real data.
 */
export const findMapTypeWithoutMapData = (
  spec: UnknownRecord
): string | null => {
  const mapType = spec['mapType'];
  if (
    typeof mapType !== 'string' ||
    !(DATA_DRIVEN_MAP_TYPES as readonly string[]).includes(mapType)
  ) {
    return null;
  }

  const mapData = spec['mapData'];
  if (hasMalformedMapData(mapData)) {
    return null;
  }

  if (joinsDeclaredSource(mapData, collectSourceIds(spec))) {
    return null;
  }

  if (mapType === 'proportionalCircles' && hasPropertyNameLayer(spec)) {
    return null;
  }

  return mapType;
};

/**
 * Finds the first layer that declares both `mapDataId` and `propertyName`.
 * The two are mutually exclusive value bindings — `mapDataId` joins values by
 * `geometryId`, `propertyName` reads them off `feature.properties` — and
 * `mapDataId` silently wins, so a spec carrying both paints one variable while
 * naming another. Rejected rather than auto-stripped: which binding the agent
 * meant is exactly the ambiguity worth surfacing.
 *
 * @returns The offending layer's `id`, or `null`.
 */
export const findLayerWithBothDataBindings = (
  spec: UnknownRecord
): string | null => {
  const layers = spec['layers'];
  if (!Array.isArray(layers)) {
    return null;
  }

  for (const layer of layers) {
    if (!isRecord(layer)) {
      continue;
    }
    if (
      layer['mapDataId'] !== undefined &&
      typeof layer['propertyName'] === 'string'
    ) {
      return typeof layer['id'] === 'string' ? layer['id'] : 'desconhecida';
    }
  }

  return null;
};

/** The colour scale a `mapData` entry's resolved values actually support. */
const classifyValueKind = (
  entry: UnknownRecord
): 'categorical' | 'quantitative' | null => {
  const data = entry['data'];
  if (!Array.isArray(data)) {
    return null;
  }

  let sawNumber = false;
  for (const row of data) {
    if (!isRecord(row)) {
      continue;
    }
    const value = row['value'];
    if (typeof value === 'string') {
      return 'categorical';
    }
    if (typeof value === 'number') {
      sawNumber = true;
    }
  }

  return sawNumber ? 'quantitative' : null;
};

/**
 * Resolves a layer's active legend, layer-scoped first, then spec-level.
 * Returns the resolved `id` alongside the legend so callers never have to
 * re-narrow it — it is `activeLegendId` by construction.
 */
const findActiveLegend = (
  spec: UnknownRecord,
  layer: UnknownRecord
): { id: string; legend: UnknownRecord } | null => {
  const activeLegendId = layer['activeLegendId'];
  if (typeof activeLegendId !== 'string') {
    return null;
  }

  for (const pool of [layer['legends'], spec['legends']]) {
    if (!Array.isArray(pool)) {
      continue;
    }
    const match = pool.find((legend) => {
      return isRecord(legend) && legend['id'] === activeLegendId;
    });
    if (isRecord(match)) {
      return { id: activeLegendId, legend: match };
    }
  }

  return null;
};

/** The scale a layer's active legend declares, paired with what its values support. */
const compareLayerLegend = (
  spec: UnknownRecord,
  layer: UnknownRecord,
  mapData: unknown[]
): { legendId: string; expected: string; declared: string } | null => {
  const mapDataId = layer['mapDataId'];
  if (mapDataId === undefined) {
    return null;
  }

  const entry = mapData.find((candidate) => {
    return isRecord(candidate) && candidate['mapDataId'] === mapDataId;
  });
  if (!isRecord(entry)) {
    return null;
  }

  const expected = classifyValueKind(entry);
  const active = findActiveLegend(spec, layer);
  if (!expected || !active) {
    return null;
  }

  const colorBy = active.legend['colorBy'];
  const declared = isRecord(colorBy) ? colorBy['type'] : undefined;
  if (typeof declared !== 'string' || declared === expected) {
    return null;
  }

  return { legendId: active.id, expected, declared };
};

/**
 * Finds a legend whose colour scale contradicts the values it describes — a
 * `quantitative` (threshold) legend over categorical strings, or a
 * `categorical` legend over numbers.
 *
 * Unlike every other check here this one runs *after* `appendRealMapData`,
 * against the real `data-gateway` values rather than the agent's placeholder.
 * That ordering is the whole point: the agent picks a legend type from the
 * dataset's *description*, having never seen a single value, so this is a
 * class of error it cannot self-correct and only the resolved spec can reveal.
 *
 * @returns The legend id plus both scales, or `null` when they agree.
 */
export const findLegendValueTypeMismatch = (
  spec: UnknownRecord
): { legendId: string; expected: string; declared: string } | null => {
  const layers = spec['layers'];
  const mapData = spec['mapData'];
  if (!Array.isArray(layers) || !Array.isArray(mapData)) {
    return null;
  }

  for (const layer of layers) {
    if (!isRecord(layer)) {
      continue;
    }
    const mismatch = compareLayerLegend(spec, layer, mapData);
    if (mismatch) {
      return mismatch;
    }
  }

  return null;
};
