import { isRecord, type UnknownRecord } from './specValidation.sources';

/** The app-wide "sem dado" swatch (`mapTokens.dataviz.color.status.masked`). */
export const NO_DATA_COLOR = '#EEE6DA';

/**
 * The one painted scale a renderable dataset may carry: break points, one
 * colour and one label per rendered bin, and the source attribution the legend
 * footer shows.
 *
 * `official` names the institution that published the class breaks, when they
 * are published — see {@link CANONICAL_SCALES}.
 */
export type CanonicalScale = {
  thresholds: number[];
  colors: string[];
  labels: string[];
  reference: string;
  official: string | null;
};

/**
 * The painted scale of every renderable dataset that can be a choropleth —
 * the values the application's own maps already use, transcribed from
 * `geovisChoroplethScales.ts`/`geovisScoreScales.ts`.
 *
 * Transcribed rather than imported: those modules resolve their ramps through
 * `mapTokens`, which pulls `@chakra-ui/react` in at module load. A route
 * handler has no business mounting the UI theme system to learn six hex
 * values, so the values live here and `canonicalScales.test.ts` pins them
 * against the feature modules — drift fails the suite instead of silently
 * splitting the palette in two.
 *
 * `cozinhas_pessoas_atendidas` is absent on purpose: it is an absolute total,
 * never a choropleth (see `ABSOLUTE_TOTAL_DATASET_IDS`).
 *
 * The IVS entry is the only `official` one. Secondary coverage of the MDS
 * CADINSAN indicator reports municipal bands with a 5% split the app's scale
 * does not have, but the primary document carries its map legends as images,
 * so the cutpoints are not confirmable from the source — `municipios_cadinsan`
 * stays a reference scale until they are.
 */
export const CANONICAL_SCALES: Record<string, CanonicalScale> = {
  cozinhas_geolocalizadas: {
    thresholds: [1, 3, 6, 11, 26],
    colors: ['#C6DBEF', '#86BCDC', '#58A0CE', '#2E7CBB', '#1761A8', '#08306B'],
    labels: ['Sem cozinha', '1–2', '3–5', '6–10', '11–25', '26+'],
    reference: 'Fonte dos dados: © Cozinhas Solidárias',
    official: null,
  },
  cozinhas_geolocalizadas_2025: {
    thresholds: [1, 3, 6, 11, 26],
    colors: ['#C6DBEF', '#86BCDC', '#58A0CE', '#2E7CBB', '#1761A8', '#08306B'],
    labels: ['Sem cozinha', '1–2', '3–5', '6–10', '11–25', '26+'],
    reference: 'Fonte dos dados: © Cozinhas Solidárias',
    official: null,
  },
  municipios_cadinsan: {
    thresholds: [0, 10, 20, 30, 40],
    colors: ['#C6DBEF', '#86BCDC', '#58A0CE', '#2E7CBB', '#1761A8', '#08306B'],
    labels: ['Sem dado', '< 10%', '10 – 20%', '20 – 30%', '30 – 40%', '40%+'],
    reference: 'Fonte dos dados: MDS — CADINSAN 2025 (base do CadÚnico)',
    official: null,
  },
  municipios_ivs: {
    thresholds: [0.001, 0.2, 0.3, 0.4, 0.5],
    colors: [
      NO_DATA_COLOR,
      '#FCBBA1',
      '#FC7E5E',
      '#EF3B2C',
      '#B81419',
      '#4F000A',
    ],
    labels: [
      'Sem dado',
      'Muito baixa (≤ 0,200)',
      'Baixa (0,201–0,300)',
      'Média (0,301–0,400)',
      'Alta (0,401–0,500)',
      'Muito alta (≥ 0,501)',
    ],
    reference:
      'Fonte dos dados: Atlas da Vulnerabilidade Social — IPEA (2010). Faixas de classificação conforme IPEA, Atlas da Vulnerabilidade Social nos Municípios Brasileiros (2015), seção “Como ler o IVS”.',
    official: 'IPEA — Atlas da Vulnerabilidade Social (faixas oficiais do IVS)',
  },
};

/**
 * Renders {@link CANONICAL_SCALES} as the markdown table `INSTRUCTIONS`
 * shows the agent — the same trick `buildSourcesTable` uses, so the prompt
 * can never describe a scale the route does not apply.
 *
 * @returns The markdown table, one row per choropleth-able dataset.
 *
 * @example
 * buildCanonicalScalesTable().includes('municipios_ivs'); // true
 */
export const buildCanonicalScalesTable = (): string => {
  const rows = Object.entries(CANONICAL_SCALES)
    .map(([mapDataId, scale]) => {
      const origin = scale.official
        ? `faixas oficiais — ${scale.official}`
        : 'escala de referência do app';
      return `| \`${mapDataId}\` | \`[${scale.thresholds.join(', ')}]\` | \`[${scale.labels
        .map((label) => {
          return `"${label}"`;
        })
        .join(', ')}]\` | ${origin} |`;
    })
    .join('\n');

  return `| \`mapDataId\` | \`thresholds\` | \`labelFormat.labels\` | origem dos cortes |
|---|---|---|---|
${rows}`;
};

/** The canonical `colorBy` for a dataset — always quantitative over the join's `value`. */
const canonicalColorBy = (scale: CanonicalScale): UnknownRecord => {
  return {
    type: 'quantitative',
    property: 'value',
    scale: 'threshold',
    thresholds: scale.thresholds,
    colors: scale.colors,
    defaultColor: NO_DATA_COLOR,
  };
};

/** Every `mapDataId` the spec's layers bind to a legend, keyed by legend id. */
const scaleByLegendId = (spec: UnknownRecord): Map<string, CanonicalScale> => {
  const byLegendId = new Map<string, CanonicalScale>();

  const layers = spec['layers'];
  if (!Array.isArray(layers)) {
    return byLegendId;
  }

  for (const layer of layers) {
    if (!isRecord(layer)) {
      continue;
    }
    const mapDataId = layer['mapDataId'];
    const activeLegendId = layer['activeLegendId'];
    if (typeof mapDataId !== 'string' || typeof activeLegendId !== 'string') {
      continue;
    }
    const scale = CANONICAL_SCALES[mapDataId];
    if (scale) {
      byLegendId.set(activeLegendId, scale);
    }
  }

  return byLegendId;
};

/** One legend with its painted scale replaced by the canonical one. */
const withCanonicalScale = (
  legend: unknown,
  byLegendId: Map<string, CanonicalScale>
): unknown => {
  if (!isRecord(legend) || typeof legend['id'] !== 'string') {
    return legend;
  }

  const scale = byLegendId.get(legend['id']);
  if (!scale) {
    return legend;
  }

  return {
    ...legend,
    colorBy: canonicalColorBy(scale),
    labelFormat: { type: 'labels', labels: scale.labels },
    reference: scale.reference,
  };
};

/**
 * Replaces the painted scale of every legend a layer binds to a dataset in
 * {@link CANONICAL_SCALES} — its `colorBy`, its bin labels and its source
 * attribution — with the application's own.
 *
 * This is what makes the output deterministic where determinism is possible.
 * The session API this route calls exposes no temperature or seed, so the
 * agent's reply varies run to run by construction; the break points, the
 * colour ramp and the bin labels of a given dataset, however, are a pure
 * function of `mapDataId`. Resolving them here means the same request paints
 * the same map even when the two replies differ, and that a published index
 * can never be silently reclassified.
 *
 * Everything the model legitimately chooses is untouched: the legend's
 * `title`/`subtitle` (which carry the user's own phrasing), the layers, the
 * sources, and any legend no layer binds to one of these datasets.
 *
 * @param spec - The spec, after `appendRealMapData` resolved its values.
 * @returns A new spec with the canonical scales applied, or `spec` itself when
 * no layer binds a dataset this module knows.
 *
 * @example
 * applyCanonicalScales({
 *   legends: [{ id: 'l', colorBy: { type: 'quantitative', thresholds: [9] } }],
 *   layers: [{ id: 'fill', mapDataId: 'municipios_ivs', activeLegendId: 'l' }],
 * });
 * // → legends[0].colorBy.thresholds === [0.001, 0.2, 0.3, 0.4, 0.5]
 */
export const applyCanonicalScales = (spec: UnknownRecord): UnknownRecord => {
  const byLegendId = scaleByLegendId(spec);
  if (byLegendId.size === 0) {
    return spec;
  }

  const next: UnknownRecord = { ...spec };

  const legends = spec['legends'];
  if (Array.isArray(legends)) {
    next['legends'] = legends.map((legend) => {
      return withCanonicalScale(legend, byLegendId);
    });
  }

  const layers = spec['layers'];
  if (Array.isArray(layers)) {
    next['layers'] = layers.map((layer) => {
      if (!isRecord(layer) || !Array.isArray(layer['legends'])) {
        return layer;
      }
      return {
        ...layer,
        legends: (layer['legends'] as unknown[]).map((legend) => {
          return withCanonicalScale(legend, byLegendId);
        }),
      };
    });
  }

  return next;
};
