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
 * Operating-status classes of a cozinha — the single source of truth for the
 * three states. Each entry pins together:
 * - `raw`: the source-native `A cozinha está em funcionamento atualmente?` text;
 * - `label`: the descriptive legend/join label (the categorical join `value`);
 * - `short`: the terse tooltip label (traffic-light wording);
 * - `color`: the point/swatch color (green / amber / red).
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

/** Fallback color for a cozinha whose status is outside the known domain. */
const COZINHA_STATUS_DEFAULT_COLOR = mapTokens.dataviz.color.status.masked;

/** Short label shown for a status outside the known domain (blank/unknown). */
const COZINHA_STATUS_UNKNOWN_SHORT = 'Não informado';

/** Id of the categorical cozinha-status legend; the points layer's `activeLegendId`. */
export const COZINHA_STATUS_LEGEND_ID = 'legenda-cozinhas-status';

/** Title of the cozinha-status legend. */
const COZINHA_STATUS_LEGEND_TITLE = 'Situação das cozinhas';

/**
 * Maps a source-native `emFuncionamento` value to its descriptive status label
 * (the categorical join `value`). Unknown or blank values return `'Outros'` so
 * they still color/join to the fallback swatch instead of leaking the raw text.
 *
 * @param raw - Source-native `emFuncionamento` text (e.g. `'Sim, está funcionando normalmente'`).
 * @returns The descriptive label (e.g. `'Em funcionamento'`), or `'Outros'` when unknown/blank.
 *
 * @example
 * cozinhaStatusLabel('Sim, está funcionando normalmente'); // 'Em funcionamento'
 * cozinhaStatusLabel(''); // 'Outros'
 */
export const cozinhaStatusLabel = (raw: string): string => {
  const match = COZINHA_STATUS.find((entry) => {
    return entry.raw === raw;
  });
  return match?.label ?? 'Outros';
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
  return match?.short ?? COZINHA_STATUS_UNKNOWN_SHORT;
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
    ...(active ? { position: 'bottom-right' as const } : {}),
    colorBy: {
      type: 'categorical',
      property: 'value',
      mapping: COZINHA_STATUS_COLORS,
      defaultColor: COZINHA_STATUS_DEFAULT_COLOR,
    },
  };
};
