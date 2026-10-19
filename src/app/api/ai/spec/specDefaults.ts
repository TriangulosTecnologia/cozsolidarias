import { isRecord, type UnknownRecord } from './specValidation';

const PROPORTIONAL_CIRCLES_RADIUS_RANGE: [number, number] = [6, 28];

const idOf = (item: unknown): unknown => {
  return isRecord(item) ? item['id'] : undefined;
};

const mergeById = (base: unknown[], override: unknown[]): unknown[] => {
  const overrideById = new Map(
    override.map((item) => {
      return [idOf(item), item];
    })
  );
  const baseIds = new Set(
    base.map((item) => {
      return idOf(item);
    })
  );

  return [
    ...base.map((item) => {
      return overrideById.get(idOf(item)) ?? item;
    }),
    ...override.filter((item) => {
      return !baseIds.has(idOf(item));
    }),
  ];
};

/**
 * Merges the agent's spec over the base spec. Top-level arrays merge by `id`:
 * an entry sharing an id replaces the base entry in place, and new ids are
 * appended. Every other key takes the override's value. Neither input is
 * mutated.
 *
 * @param base - Default spec the override is merged onto.
 * @param override - Spec whose keys win over `base`.
 * @returns A new spec object.
 * @example
 * mergeSpecs({ layers: [{ id: 'a' }] }, { layers: [{ id: 'a', x: 1 }, { id: 'b' }] });
 * // { layers: [{ id: 'a', x: 1 }, { id: 'b' }] }
 */
export const mergeSpecs = (
  base: UnknownRecord,
  override: UnknownRecord
): UnknownRecord => {
  const merged: UnknownRecord = { ...base };

  for (const [key, value] of Object.entries(override)) {
    const baseValue = base[key];
    merged[key] =
      Array.isArray(baseValue) && Array.isArray(value)
        ? mergeById(baseValue, value)
        : value;
  }

  return merged;
};

// `concat` wraps a non-array value and flattens an array, so no branch is needed.
const sizeDatasetOf = (spec: UnknownRecord): UnknownRecord | undefined => {
  const entries = ([] as unknown[]).concat(spec['mapData']).filter(isRecord);
  return (
    entries.find((entry) => {
      return entry['dimension'] === 'size';
    }) ?? entries[0]
  );
};

const maxValueOf = (dataset: UnknownRecord): number | undefined => {
  const rows = ([] as unknown[]).concat(dataset['data']).filter(isRecord);
  const values = rows
    .map((row) => {
      return row['value'];
    })
    .filter((value): value is number => {
      return typeof value === 'number' && Number.isFinite(value);
    });
  return values.length > 0
    ? values.reduce((a, b) => {
        return Math.max(a, b);
      })
    : undefined;
};

// The size dataset's id and scale ceiling, or undefined when either is unusable.
const sizeBindingOf = (
  spec: UnknownRecord
): { mapDataId: string; max: number } | undefined => {
  const sizeDataset = sizeDatasetOf(spec);
  if (!sizeDataset || typeof sizeDataset['mapDataId'] !== 'string') {
    return undefined;
  }
  const max = maxValueOf(sizeDataset);
  return max !== undefined && max > 0
    ? { mapDataId: sizeDataset['mapDataId'], max }
    : undefined;
};

/**
 * Applies the `proportionalCircles` defaults to a resolved spec. The scale
 * ceiling becomes the largest value of the size dataset (the `mapData` entry
 * with `dimension: 'size'`, else the first). Each point layer bound to that
 * dataset gets `sizeBy` `{ range: [6, 28], transform: 'sqrt', thresholds:
 * [0, max] }`. Specs with another `mapType`, no size dataset or no positive
 * value are returned unchanged.
 *
 * @param spec - A spec whose `mapData` already carries real values.
 * @returns A new spec object, or `spec` itself when no default applies.
 * @example
 * applyProportionalCirclesDefaults({ mapType: 'choropleth', layers: [] });
 * // returned unchanged
 */
export const applyProportionalCirclesDefaults = (
  spec: UnknownRecord
): UnknownRecord => {
  const binding = sizeBindingOf(spec);
  if (spec['mapType'] !== 'proportionalCircles' || !binding) {
    return spec;
  }

  const { mapDataId, max } = binding;
  const sizedLayers = ([] as unknown[]).concat(spec['layers']).map((layer) => {
    return isRecord(layer) &&
      layer['geometry'] === 'point' &&
      layer['mapDataId'] === mapDataId
      ? {
          ...layer,
          sizeBy: {
            range: PROPORTIONAL_CIRCLES_RADIUS_RANGE,
            transform: 'sqrt',
            thresholds: [0, max],
          },
        }
      : layer;
  });

  return { ...spec, scaleMaxValue: max, layers: sizedLayers };
};
