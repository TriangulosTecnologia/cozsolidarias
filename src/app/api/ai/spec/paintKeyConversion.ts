import { isRecord, type UnknownRecord } from './specValidation';

/** MapLibre kebab-case paint keys whose spec key is not their plain camelCase form. */
const PAINT_KEY_ALIASES: Record<string, string> = {
  'fill-outline-color': 'lineColor',
  'fill-extrusion-color': 'fillColor',
  'fill-extrusion-opacity': 'fillOpacity',
};

/** `fill-color` → `fillColor`, or the alias when MapLibre's key has a different spec name. */
const specPaintKey = (key: string): string => {
  return (
    PAINT_KEY_ALIASES[key] ??
    key.replace(/-([a-z])/g, (_, letter: string) => {
      return letter.toUpperCase();
    })
  );
};

/**
 * Renames each kebab-case key of one `paint` record to its spec key. A camelCase
 * key already present wins over its kebab-case twin, which is dropped. Two
 * kebab-case keys naming the same spec key are both left as written: converting
 * either would drop the other's value, so the validator reports them instead.
 */
const convertPaint = (paint: UnknownRecord): UnknownRecord => {
  const keys = Object.keys(paint);
  const camelKeys = new Set(
    keys.filter((key) => {
      return !key.includes('-');
    })
  );
  const kebabKeys = keys.filter((key) => {
    return key.includes('-');
  });
  return Object.fromEntries(
    Object.entries(paint).flatMap(([key, value]) => {
      if (!key.includes('-')) {
        return [[key, value]];
      }
      const specKey = specPaintKey(key);
      if (camelKeys.has(specKey)) {
        return [];
      }
      const twins = kebabKeys.filter((kebabKey) => {
        return specPaintKey(kebabKey) === specKey;
      });
      return twins.length > 1 ? [[key, value]] : [[specKey, value]];
    })
  );
};

/**
 * Converts every layer's kebab-case `paint` keys to the camelCase keys the
 * geovis schema accepts, before any check reads them. A kebab-case key the
 * validator would otherwise reject, or drop at render time, is never left
 * behind.
 *
 * @param spec - The candidate spec; `layers[].paint` records are rewritten.
 * @returns The spec with converted paint keys; the same reference when it has no `layers` array.
 *
 * @example
 * convertPaintKeys({ layers: [{ id: 'a', paint: { 'fill-color': '#fff' } }] });
 * // → { layers: [{ id: 'a', paint: { fillColor: '#fff' } }] }
 */
export const convertPaintKeys = (spec: UnknownRecord): UnknownRecord => {
  const layers = spec['layers'];
  if (!Array.isArray(layers)) {
    return spec;
  }
  return {
    ...spec,
    layers: layers.map((layer) => {
      const paint = isRecord(layer) ? layer['paint'] : undefined;
      return isRecord(layer) && isRecord(paint)
        ? { ...layer, paint: convertPaint(paint) }
        : layer;
    }),
  };
};
