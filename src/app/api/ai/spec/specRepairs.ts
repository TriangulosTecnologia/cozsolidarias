import { isRecord, type UnknownRecord } from './specValidation';

/**
 * Re-attaches a `mapData` the model left dangling: when exactly one `point`
 * layer has no `mapDataId` and exactly one `mapData` entry is used by no layer,
 * the pair is unambiguous and the layer gets that `mapDataId`. Anything less
 * clear-cut (several candidates on either side) is left for the model.
 *
 * @param spec - The candidate spec.
 * @returns The same reference when there is no unambiguous pair; otherwise the
 * spec with that layer's `mapDataId` filled in.
 *
 * @example
 * linkOrphanMapData({ layers: [{ id: 'dots', geometry: 'point' }], mapData: [{ mapDataId: 'p' }] });
 * // layers => [{ id: 'dots', geometry: 'point', mapDataId: 'p' }]
 */
export const linkOrphanMapData = (spec: UnknownRecord): UnknownRecord => {
  const { layers, mapData } = spec;
  if (!Array.isArray(layers) || !Array.isArray(mapData)) {
    return spec;
  }

  const used = new Set(
    layers.flatMap((layer) => {
      return isRecord(layer) ? [layer['mapDataId']] : [];
    })
  );
  const orphans = mapData.filter((entry): entry is UnknownRecord => {
    return isRecord(entry) && !used.has(entry['mapDataId']);
  });
  const bare = layers.filter((layer): layer is UnknownRecord => {
    return (
      isRecord(layer) &&
      layer['geometry'] === 'point' &&
      layer['mapDataId'] === undefined
    );
  });
  if (orphans.length !== 1 || bare.length !== 1) {
    return spec;
  }

  return {
    ...spec,
    layers: layers.map((layer) => {
      return layer === bare[0]
        ? { ...bare[0], mapDataId: orphans[0]['mapDataId'] }
        : layer;
    }),
  };
};

/**
 * Ties each `mapData` entry to the source its layer actually draws. The model
 * keeps writing a `mapId` that names no declared source (a stale template id),
 * and geovis' own repair for the resulting `source-scope-conflict` points the
 * layer at that nonexistent source — so the layer's `sourceId` is the truth.
 * A missing `joinKey` defaults to `codarea`: every renderable dataset is keyed
 * by the município IBGE code, which the served sources carry as a property.
 *
 * @param spec - The candidate spec.
 * @returns The same reference when there is nothing to align; otherwise the
 * spec with `mapData[].mapId` / `joinKey` filled in.
 *
 * @example
 * alignMapDataJoin({ sources: [{ id: 'b' }], layers: [{ sourceId: 'b', mapDataId: 'p' }], mapData: [{ mapDataId: 'p', mapId: 'x' }] });
 * // mapData => [{ mapDataId: 'p', mapId: 'b', joinKey: 'codarea' }]
 */
export const alignMapDataJoin = (spec: UnknownRecord): UnknownRecord => {
  const { mapData, sources, layers } = spec;
  if (!Array.isArray(mapData) || !Array.isArray(sources)) {
    return spec;
  }

  const sourceIds = new Set(
    sources.flatMap((source) => {
      return isRecord(source) ? [source['id']] : [];
    })
  );
  const layerSourceByMapData = new Map(
    (Array.isArray(layers) ? layers : []).flatMap((layer) => {
      return isRecord(layer) && typeof layer['mapDataId'] === 'string'
        ? [[layer['mapDataId'], layer['sourceId']] as const]
        : [];
    })
  );

  return {
    ...spec,
    mapData: mapData.map((entry) => {
      if (!isRecord(entry)) {
        return entry;
      }
      const layerSource = layerSourceByMapData.get(String(entry['mapDataId']));
      return {
        ...entry,
        ...(!sourceIds.has(entry['mapId']) && sourceIds.has(layerSource)
          ? { mapId: layerSource }
          : {}),
        joinKey: entry['joinKey'] ?? 'codarea',
      };
    }),
  };
};

/**
 * Gives each dimensioned `mapData` entry on a shared source its own
 * `stateKey` (its dimension name), so a color and a size dataset on one source
 * stop writing the same feature-state key — geovis' `state-key-collision`,
 * which carries no repair of its own. A `stateKey` the model declared is kept;
 * the adapter reads each dimension's key itself, so nothing else follows it.
 *
 * @param spec - The candidate spec.
 * @returns The same reference when there is no `mapData`; otherwise the spec
 * with `stateKey` filled in on dimensioned entries that share a `mapId`.
 *
 * @example
 * separateStateKeys({ mapData: [{ mapDataId: 'a', mapId: 's', dimension: 'size' }, { mapDataId: 'b', mapId: 's', dimension: 'color' }] });
 * // => a.stateKey 'size', b.stateKey 'color'
 */
export const separateStateKeys = (spec: UnknownRecord): UnknownRecord => {
  const { mapData } = spec;
  if (!Array.isArray(mapData)) {
    return spec;
  }

  const isDimensioned = (entry: unknown): entry is UnknownRecord => {
    return isRecord(entry) && typeof entry['dimension'] === 'string';
  };

  const separated = mapData.map((entry) => {
    return isDimensioned(entry) &&
      entry['stateKey'] === undefined &&
      mapData.filter((other) => {
        return isDimensioned(other) && other['mapId'] === entry['mapId'];
      }).length > 1
      ? { ...entry, stateKey: entry['dimension'] }
      : entry;
  });
  return separated.some((entry, index) => {
    return entry !== mapData[index];
  })
    ? { ...spec, mapData: separated }
    : spec;
};

/**
 * Applies, in order, the deterministic repairs of the model's `mapData` wiring:
 * {@link linkOrphanMapData}, {@link alignMapDataJoin} and {@link separateStateKeys}.
 *
 * @param spec - The candidate spec.
 * @returns The spec with every applicable link, source id, join key and state key filled in.
 *
 * @example
 * const repaired = repairMapDataWiring(candidate);
 */
export const repairMapDataWiring = (spec: UnknownRecord): UnknownRecord => {
  return separateStateKeys(alignMapDataJoin(linkOrphanMapData(spec)));
};
