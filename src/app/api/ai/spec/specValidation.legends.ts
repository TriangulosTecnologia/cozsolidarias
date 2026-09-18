import { CANONICAL_SCALES, NO_DATA_COLOR } from './canonicalScales';
import { isRecord, type UnknownRecord } from './specValidation.sources';

export { NO_DATA_COLOR };

/**
 * The `mapData` column every renderable dataset writes. `RENDERABLE_DATASET_FETCHERS`
 * emits rows shaped `{ geometryId, value }`, and the adapter joins them into
 * `feature-state.value` — so a legend colouring by any other property reads a
 * key that is never written and paints every município with `defaultColor`.
 */
const JOINED_VALUE_PROPERTY = 'value';

/**
 * Renderable datasets whose classes are fixed by the institution that
 * publishes the index, not by the data's own distribution — derived from
 * {@link CANONICAL_SCALES} so the breaks this check enforces and the breaks
 * `applyCanonicalScales` writes can never be two different arrays.
 *
 * Re-deriving these breaks from the data (Jenks, quantis, intervalos iguais)
 * produces classes no reader can compare against any published figure, so the
 * route rejects a spec that does — even though the scale would be normalized
 * anyway, because a model that reclassified a published index also chose the
 * wrong reading of the request, and a silent repair would hide that.
 */
export const OFFICIAL_CLASSIFICATIONS: Record<
  string,
  { thresholds: number[]; source: string }
> = Object.fromEntries(
  Object.entries(CANONICAL_SCALES).flatMap(([mapDataId, scale]) => {
    return scale.official
      ? [[mapDataId, { thresholds: scale.thresholds, source: scale.official }]]
      : [];
  })
);

/** Every legend declared by the spec, at either level, paired with its id. */
const collectLegends = (spec: UnknownRecord): Map<string, UnknownRecord> => {
  const legends = new Map<string, UnknownRecord>();

  const add = (candidate: unknown): void => {
    if (!Array.isArray(candidate)) {
      return;
    }
    for (const legend of candidate) {
      if (isRecord(legend) && typeof legend['id'] === 'string') {
        legends.set(legend['id'], legend);
      }
    }
  };

  add(spec['legends']);

  const layers = spec['layers'];
  if (Array.isArray(layers)) {
    for (const layer of layers) {
      if (isRecord(layer)) {
        add(layer['legends']);
      }
    }
  }

  return legends;
};

/** Every layer of the spec, skipping malformed entries. */
const collectLayers = (spec: UnknownRecord): UnknownRecord[] => {
  const layers = spec['layers'];
  if (!Array.isArray(layers)) {
    return [];
  }
  return layers.filter(isRecord);
};

/** A legend's `colorBy`, when it is a threshold scale with explicit breaks. */
const quantitativeColorBy = (legend: UnknownRecord): UnknownRecord | null => {
  const colorBy = legend['colorBy'];
  if (!isRecord(colorBy) || colorBy['type'] !== 'quantitative') {
    return null;
  }
  return Array.isArray(colorBy['thresholds']) ? colorBy : null;
};

/**
 * Finds the first legend whose swatch count contradicts its break count. A
 * `threshold` scale over `n` breaks renders exactly `n + 1` bins — the base bin
 * below the first break plus one per break — so `colors` and, when
 * `labelFormat.type` is `'labels'`, `labels` must both have `n + 1` entries.
 *
 * Neither the JSON Schema nor `validateSpec` enforces the relation: a spec with
 * six breaks and five colours is structurally valid, and the adapter silently
 * recycles or drops the trailing swatch, so the darkest class reads as the
 * second darkest and the legend explains a map that isn't there.
 *
 * @returns The offending legend's id and the counts involved, or `null`.
 *
 * @example
 * findLegendScaleArityMismatch({
 *   legends: [{ id: 'l', colorBy: { type: 'quantitative', scale: 'threshold', thresholds: [1, 3], colors: ['#a', '#b'] } }],
 * });
 * // → { legendId: 'l', field: 'colors', expected: 3, received: 2 }
 */
export const findLegendScaleArityMismatch = (
  spec: UnknownRecord
): {
  legendId: string;
  field: 'colors' | 'labels';
  expected: number;
  received: number;
} | null => {
  for (const [legendId, legend] of collectLegends(spec)) {
    const colorBy = quantitativeColorBy(legend);
    if (!colorBy) {
      continue;
    }

    const expected = (colorBy['thresholds'] as unknown[]).length + 1;

    const colors = colorBy['colors'];
    if (Array.isArray(colors) && colors.length !== expected) {
      return { legendId, field: 'colors', expected, received: colors.length };
    }

    const labelFormat = legend['labelFormat'];
    if (isRecord(labelFormat) && labelFormat['type'] === 'labels') {
      const labels = labelFormat['labels'];
      if (Array.isArray(labels) && labels.length !== expected) {
        return { legendId, field: 'labels', expected, received: labels.length };
      }
    }
  }

  return null;
};

/**
 * Finds the first layer whose `activeLegendId` names a legend the spec never
 * declares — at the spec level or on any layer.
 *
 * `GeoVisLegend` resolves the id from the registry and renders `null` when it
 * misses, so the map paints correctly while its legend silently disappears:
 * the one failure `findMissingLegend` cannot see, since the spec does carry
 * legends, just not the one the layer points at.
 *
 * @returns The offending layer id and the dangling id, or `null`.
 *
 * @example
 * findDanglingActiveLegendId({ legends: [{ id: 'a' }], layers: [{ id: 'fill', activeLegendId: 'b' }] });
 * // → { layerId: 'fill', activeLegendId: 'b' }
 */
export const findDanglingActiveLegendId = (
  spec: UnknownRecord
): { layerId: string; activeLegendId: string } | null => {
  const legends = collectLegends(spec);

  for (const layer of collectLayers(spec)) {
    const activeLegendId = layer['activeLegendId'];
    const layerId = layer['id'];
    if (
      typeof activeLegendId === 'string' &&
      typeof layerId === 'string' &&
      !legends.has(activeLegendId)
    ) {
      return { layerId, activeLegendId };
    }
  }

  return null;
};

/**
 * Finds the first join-bound layer whose active legend colours by a property
 * other than {@link JOINED_VALUE_PROPERTY}.
 *
 * A layer with `mapDataId` receives its values through the data join, which
 * writes a single `value` key into feature state. A legend asking for any
 * other property reads `undefined` for every feature, so the whole map falls
 * back to `defaultColor` — a uniformly grey map that raises no error.
 *
 * @returns The offending legend id and the property it declares, or `null`.
 *
 * @example
 * findLegendPropertyMismatch({
 *   legends: [{ id: 'l', colorBy: { type: 'quantitative', scale: 'threshold', thresholds: [1], property: 'ivs' } }],
 *   layers: [{ id: 'fill', mapDataId: 'municipios_ivs', activeLegendId: 'l' }],
 * });
 * // → { legendId: 'l', property: 'ivs' }
 */
export const findLegendPropertyMismatch = (
  spec: UnknownRecord
): { legendId: string; property: string } | null => {
  const legends = collectLegends(spec);

  for (const layer of collectLayers(spec)) {
    const activeLegendId = layer['activeLegendId'];
    if (
      typeof layer['mapDataId'] !== 'string' ||
      typeof activeLegendId !== 'string'
    ) {
      continue;
    }

    const colorBy = legends.get(activeLegendId)?.['colorBy'];
    if (!isRecord(colorBy)) {
      continue;
    }

    const property = colorBy['property'];
    if (typeof property === 'string' && property !== JOINED_VALUE_PROPERTY) {
      return { legendId: activeLegendId, property };
    }
  }

  return null;
};

/**
 * Finds the first quantitative legend whose "sem dado" swatch is not the app's
 * {@link NO_DATA_COLOR}.
 *
 * `defaultColor` paints both the municípios missing from the dataset and every
 * value below the first break, so it appears on every choropleth this app
 * renders. Letting the agent pick it makes the absence of data read as a
 * colour inside the variable's own ramp on one map and as a different neutral
 * on the next — the one swatch that must stay identical across the whole
 * application.
 *
 * @returns The offending legend's id and the colour it declares (`null` when
 * the field is absent, which is itself a violation), or `null` when every
 * legend agrees.
 *
 * @example
 * findForeignNoDataColor({
 *   legends: [{ id: 'l', colorBy: { type: 'quantitative', scale: 'threshold', thresholds: [1], defaultColor: '#ffffff' } }],
 * });
 * // → { legendId: 'l', declared: '#ffffff' }
 */
export const findForeignNoDataColor = (
  spec: UnknownRecord
): { legendId: string; declared: string | null } | null => {
  for (const [legendId, legend] of collectLegends(spec)) {
    const colorBy = quantitativeColorBy(legend);
    if (!colorBy) {
      continue;
    }

    const declared = colorBy['defaultColor'];
    if (typeof declared !== 'string') {
      return { legendId, declared: null };
    }
    if (declared.toUpperCase() !== NO_DATA_COLOR) {
      return { legendId, declared };
    }
  }

  return null;
};

/**
 * Finds the first layer painting a dataset with {@link OFFICIAL_CLASSIFICATIONS}
 * whose active legend re-derives the class breaks instead of using the
 * published faixas.
 *
 * Data-driven classification (Jenks, quantis, intervalos iguais) is the right
 * default for a variable this application measures itself, and the wrong one
 * for a published index: readers compare an IVS map against IPEA's own faixa
 * names, and breaks fitted to the snapshot make "alta vulnerabilidade" mean
 * something different on every map.
 *
 * @returns The offending layer's dataset id with the expected breaks, or `null`.
 *
 * @example
 * findReclassifiedOfficialIndex({
 *   legends: [{ id: 'l', colorBy: { type: 'quantitative', scale: 'threshold', thresholds: [0.19, 0.28, 0.37] } }],
 *   layers: [{ id: 'fill', mapDataId: 'municipios_ivs', activeLegendId: 'l' }],
 * });
 * // → { mapDataId: 'municipios_ivs', expected: [0.001, 0.2, 0.3, 0.4, 0.5], source: 'IPEA — …' }
 */
export const findReclassifiedOfficialIndex = (
  spec: UnknownRecord
): { mapDataId: string; expected: number[]; source: string } | null => {
  const legends = collectLegends(spec);

  for (const layer of collectLayers(spec)) {
    const mapDataId = layer['mapDataId'];
    const activeLegendId = layer['activeLegendId'];
    if (typeof mapDataId !== 'string' || typeof activeLegendId !== 'string') {
      continue;
    }

    const official = OFFICIAL_CLASSIFICATIONS[mapDataId];
    const legend = legends.get(activeLegendId);
    if (!official || !legend) {
      continue;
    }

    const colorBy = quantitativeColorBy(legend);
    if (!colorBy) {
      continue;
    }

    const thresholds = colorBy['thresholds'] as unknown[];
    const matches =
      thresholds.length === official.thresholds.length &&
      official.thresholds.every((expected, index) => {
        return thresholds[index] === expected;
      });

    if (!matches) {
      return {
        mapDataId,
        expected: official.thresholds,
        source: official.source,
      };
    }
  }

  return null;
};

/**
 * Whether a `dotDensity` spec omits the dot-to-quantity ratio from its legends.
 *
 * A dot-density map is unreadable without it: the reader counts dots and has
 * no way to turn that count into a quantity. The ratio may live in any legend
 * text (`title`, `subtitle`, `noDataLabel` or an explicit label), which is why
 * this looks for the `= <number>` pattern rather than a dedicated field the
 * schema does not have.
 *
 * @returns `true` when the spec declares `mapType: 'dotDensity'` and no legend
 * states a ratio.
 *
 * @example
 * findDotDensityWithoutRatio({ mapType: 'dotDensity', legends: [{ id: 'l', title: 'Cozinhas' }] }); // true
 * findDotDensityWithoutRatio({ mapType: 'dotDensity', legends: [{ id: 'l', subtitle: '1 ponto = 100 cozinhas' }] }); // false
 */
export const findDotDensityWithoutRatio = (spec: UnknownRecord): boolean => {
  if (spec['mapType'] !== 'dotDensity') {
    return false;
  }

  const ratio = /\bpontos?\b[^=]{0,40}=\s*[\d.,]+/i;

  for (const legend of collectLegends(spec).values()) {
    const texts: unknown[] = [
      legend['title'],
      legend['subtitle'],
      legend['noDataLabel'],
    ];

    const labelFormat = legend['labelFormat'];
    if (isRecord(labelFormat) && Array.isArray(labelFormat['labels'])) {
      texts.push(...(labelFormat['labels'] as unknown[]));
    }

    const stated = texts.some((text) => {
      return typeof text === 'string' && ratio.test(text);
    });

    if (stated) {
      return false;
    }
  }

  return true;
};
