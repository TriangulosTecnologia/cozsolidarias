import { geovisTokens } from './themeGeovis';

type Tokens = typeof geovisTokens;

/** Resolves a dot-path (e.g. `core.dataviz.color.data.sequential.green`). */
type PathValue<T, P extends string> = P extends `${infer K}.${infer Rest}`
  ? K extends keyof T
    ? PathValue<T[K], Rest>
    : never
  : P extends keyof T
    ? T[P]
    : never;

/** Recursively replaces every `{path}` reference string with its value. */
type Resolved<T> = T extends `{${infer P}}`
  ? Resolved<PathValue<Tokens, P>>
  : T extends readonly unknown[]
    ? { -readonly [K in keyof T]: Resolved<T[K]> }
    : T extends object
      ? { -readonly [K in keyof T]: Resolved<T[K]> }
      : T;

const isRef = (value: unknown): value is string => {
  return (
    typeof value === 'string' && value.startsWith('{') && value.endsWith('}')
  );
};

const resolve = (value: unknown): unknown => {
  if (isRef(value)) {
    const path = value.slice(1, -1).split('.');
    let current: unknown = geovisTokens;
    for (const key of path) {
      current = (current as Record<string, unknown>)[key];
    }
    return resolve(current);
  }

  if (Array.isArray(value)) {
    return value.map((item) => {
      return resolve(item);
    });
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, val]) => {
        return [key, resolve(val)];
      })
    );
  }

  return value;
};

/**
 * Geovis design tokens with all `{path}` references resolved to concrete values
 * (colors, opacities, dash arrays). This is the only sanctioned entry point for
 * map styling — consumers import `mapTokens` from here, never from
 * `themeGeovis.ts` directly.
 */
export const mapTokens = resolve(geovisTokens.semantic) as Resolved<
  Tokens['semantic']
>;
