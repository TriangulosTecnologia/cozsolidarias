import type { LegendSpec } from '@ttoss/geovis';

import { mapTokens } from '@/config/theme';

/**
 * Light traffic-light hues for the three status classes, sampled from the
 * brand's sequential ramps (green / yellow-orange / red) at a light step so the
 * points read as clearly green / amber / red without the heavier, darker tones
 * of the mid-lightness categorical palette.
 */
const COZINHA_STATUS_GREEN = mapTokens.dataviz.color.sequential[2][6];
const COZINHA_STATUS_AMBER = mapTokens.dataviz.color.sequential[3][2];
const COZINHA_STATUS_RED = mapTokens.dataviz.color.sequential[5][6];

/**
 * The class a cozinha falls into when the source leaves
 * `A cozinha está em funcionamento atualmente?` blank — a large share of the
 * snapshot. Those kitchens carry coordinates and are plotted like any other, so
 * the legend has to name their grey swatch instead of leaving it unexplained.
 *
 * Listed as a status rather than handled as a fallback: being in
 * {@link COZINHA_STATUS} is what puts it in `colorBy.mapping`, and a categorical
 * legend draws one swatch per mapping entry. `raw: ''` is what the source
 * actually carries; any text outside the domain folds here too.
 */
const COZINHA_STATUS_UNKNOWN = {
  raw: '',
  label: 'Não informado',
  short: 'Não informado',
  // The categorical palette's warm gray, not `status.masked`: that token is
  // built for choropleth polygons, where a near-white fill still reads across a
  // whole município. It sits at 1.03:1 against the map's paper background —
  // lighter than the background itself — which a few-pixel dot with no stroke
  // cannot survive. This gray holds 3.11:1, on par with the most visible of the
  // three painted classes, while staying neutral so it reads as absence of data
  // rather than a fourth category competing with the traffic light.
  color: mapTokens.dataviz.color.categorical[1][7],
} as const;

/**
 * Operating-status classes of a cozinha — the single source of truth for the
 * four states. Each entry pins together:
 * - `raw`: the source-native `A cozinha está em funcionamento atualmente?` text;
 * - `label`: the descriptive legend/join label (the categorical join `value`);
 * - `short`: the terse tooltip label (traffic-light wording);
 * - `color`: the point/swatch color (green / amber / red / grey).
 *
 * The categorical join uses `label` as the joined value, so the legend swatch
 * labels and the hovered feature's `value` both read from it. Deriving the
 * tooltip's `short` and `color` from the same array keeps the three views
 * (points, legend, tooltip) from drifting.
 */
const COZINHA_STATUS = [
  {
    raw: 'Sim, está funcionando normalmente',
    label: 'Em funcionamento',
    short: 'Ativo',
    color: COZINHA_STATUS_GREEN,
  },
  {
    raw: 'Está funcionando com carga horária reduzida',
    label: 'Funcionamento reduzido',
    short: 'Reduzido',
    color: COZINHA_STATUS_AMBER,
  },
  {
    raw: 'Não, a Cozinha encontra-se paralisada, sem atividade',
    label: 'Paralisada',
    short: 'Inativo',
    color: COZINHA_STATUS_RED,
  },
  COZINHA_STATUS_UNKNOWN,
] as const;

/**
 * Status label → point color, keyed by the descriptive `label` because the
 * categorical `colorBy.mapping` and the join value are both label-based.
 */
const COZINHA_STATUS_COLORS: Record<string, string> = Object.fromEntries(
  COZINHA_STATUS.map((status) => {
    return [status.label, status.color];
  })
);

/**
 * Fallback color for a value that never reaches {@link COZINHA_STATUS_COLORS}.
 * Read off the unknown class so the swatch the legend draws for "Não informado"
 * and the color an unmapped point gets can never diverge.
 */
const COZINHA_STATUS_DEFAULT_COLOR = COZINHA_STATUS_UNKNOWN.color;

/** Id of the categorical cozinha-status legend; the points layer's `activeLegendId`. */
export const COZINHA_STATUS_LEGEND_ID = 'legenda-cozinhas-status';

/** Title of the cozinha-status legend. */
const COZINHA_STATUS_LEGEND_TITLE = 'Situação das cozinhas';

/**
 * Maps a source-native `emFuncionamento` value to its descriptive status label
 * (the categorical join `value`). Unknown or blank values return
 * `'Não informado'` so they join to that legend swatch instead of leaking the
 * raw text.
 *
 * @param raw - Source-native `emFuncionamento` text (e.g. `'Sim, está funcionando normalmente'`).
 * @returns The descriptive label (e.g. `'Em funcionamento'`), or `'Não informado'` when unknown/blank.
 *
 * @example
 * cozinhaStatusLabel('Sim, está funcionando normalmente'); // 'Em funcionamento'
 * cozinhaStatusLabel(''); // 'Não informado'
 */
export const cozinhaStatusLabel = (raw: string): string => {
  const match = COZINHA_STATUS.find((entry) => {
    return entry.raw === raw;
  });
  return match?.label ?? COZINHA_STATUS_UNKNOWN.label;
};

/**
 * Maps a descriptive status label (the map's feature-state `value`) to its terse
 * tooltip label. Any label outside the known domain (including `null`, i.e. a
 * point with no bound status) returns `'Não informado'`.
 *
 * @param label - Descriptive status label from feature-state, or `null`.
 * @returns The terse label: `'Ativo'`, `'Reduzido'`, `'Inativo'`, or `'Não informado'`.
 *
 * @example
 * cozinhaStatusShortLabel('Em funcionamento'); // 'Ativo'
 * cozinhaStatusShortLabel('Paralisada'); // 'Inativo'
 * cozinhaStatusShortLabel(null); // 'Não informado'
 */
export const cozinhaStatusShortLabel = (label: string | null): string => {
  const match = COZINHA_STATUS.find((entry) => {
    return entry.label === label;
  });
  return match?.short ?? COZINHA_STATUS_UNKNOWN.short;
};

/**
 * Resolves the point/swatch color for a descriptive status label, mirroring the
 * categorical `colorBy.mapping` that paints the points so the tooltip accent
 * can't drift. Any label outside {@link COZINHA_STATUS_COLORS} (including `null`)
 * resolves to the masked fallback.
 *
 * @param label - Descriptive status label (e.g. `'Em funcionamento'`), or `null`.
 * @returns The hex color for the status.
 *
 * @example
 * colorForCozinhaStatus('Em funcionamento'); // green
 * colorForCozinhaStatus(null); // masked fallback
 */
export const colorForCozinhaStatus = (label: string | null): string => {
  if (label === null) {
    return COZINHA_STATUS_DEFAULT_COLOR;
  }
  return COZINHA_STATUS_COLORS[label] ?? COZINHA_STATUS_DEFAULT_COLOR;
};

/**
 * Builds the categorical cozinha-status legend (status → color). It's positioned
 * at `bottom-right` only when the `pontos` mode is active; otherwise it's
 * returned without a `position` so it stays hidden, mirroring how the choropleth
 * and settlement legends are positioned only for their own mode.
 *
 * @param active - Whether the `pontos` mode is the active one.
 * @returns The cozinha-status {@link LegendSpec}.
 *
 * @example
 * buildCozinhaStatusLegend(true).position; // 'bottom-right'
 * buildCozinhaStatusLegend(false).position; // undefined
 */
export const buildCozinhaStatusLegend = (active: boolean): LegendSpec => {
  return {
    id: COZINHA_STATUS_LEGEND_ID,
    title: COZINHA_STATUS_LEGEND_TITLE,
    subtitle: 'Cor pela situação de funcionamento informada pela cozinha.',
    ...(active ? { position: 'bottom-right' as const, offset: 12 } : {}),
    colorBy: {
      type: 'categorical',
      property: 'value',
      mapping: COZINHA_STATUS_COLORS,
      defaultColor: COZINHA_STATUS_DEFAULT_COLOR,
    },
  };
};
