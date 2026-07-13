import type { LegendSpec } from '@ttoss/geovis';

import { mapTokens } from '@/config/theme';

/**
 * Registration-status classes of a SICAR settlement (`ind_status`), with the
 * human label the map colors and labels by. The map's categorical join uses the
 * **label** (not the code) as the joined value, so the legend swatch labels and
 * the tooltip text read straight from it. `code → label` is the only mapping
 * that must stay in sync with the source's `ind_status` domain.
 */
const ASSENTAMENTO_STATUS = [
  { code: 'AT', label: 'Ativo' },
  { code: 'CA', label: 'Cancelado' },
  { code: 'PE', label: 'Pendente' },
] as const;

/** Discrete brand categorical hues (nominal), reused for the status classes. */
const ASSENTAMENTO_CATEGORICAL = mapTokens.dataviz.color.categorical[1];

/**
 * Status label → fill color. Green = active, brick-red = cancelled, amber =
 * pending, drawn from the brand categorical palette. Keyed by label because the
 * categorical `colorBy.mapping` and the join value are both label-based.
 */
const ASSENTAMENTO_STATUS_COLORS: Record<string, string> = {
  Ativo: ASSENTAMENTO_CATEGORICAL[2],
  Cancelado: ASSENTAMENTO_CATEGORICAL[6],
  Pendente: ASSENTAMENTO_CATEGORICAL[4],
};

/** Fallback fill for a settlement whose status is outside the known domain. */
const ASSENTAMENTO_DEFAULT_COLOR = mapTokens.dataviz.color.status.masked;

/** Id of the categorical settlement legend; the assentamentos fill's `activeLegendId`. */
export const ASSENTAMENTO_LEGEND_ID = 'legenda-assentamentos';

/** Title of the settlement legend; also the menu label for the assentamentos mode. */
const ASSENTAMENTO_LEGEND_TITLE = 'Assentamentos rurais';

/**
 * Maps a SICAR `ind_status` code to its human label. Unknown codes return
 * `'Outros'` so they still color/join to the fallback swatch instead of leaking
 * the raw code.
 *
 * @param code - Raw `ind_status` from the source (e.g. `'AT'`).
 * @returns The human label (e.g. `'Ativo'`), or `'Outros'` when unknown.
 *
 * @example
 * assentamentoStatusLabel('AT'); // 'Ativo'
 * assentamentoStatusLabel('ZZ'); // 'Outros'
 */
export const assentamentoStatusLabel = (code: string): string => {
  const match = ASSENTAMENTO_STATUS.find((entry) => {
    return entry.code === code;
  });
  return match?.label ?? 'Outros';
};

/**
 * Resolves the fill color for a settlement status label, mirroring the
 * categorical `colorBy.mapping` that paints the polygons so the tooltip swatch
 * can't drift. Any label outside {@link ASSENTAMENTO_STATUS_COLORS} (including
 * `null`) resolves to the masked fallback.
 *
 * @param label - Status label (e.g. `'Ativo'`), or `null` when unknown.
 * @returns The hex color for the status.
 *
 * @example
 * colorForAssentamentoStatus('Cancelado'); // brick-red
 * colorForAssentamentoStatus(null); // masked fallback
 */
export const colorForAssentamentoStatus = (label: string | null): string => {
  if (label === null) {
    return ASSENTAMENTO_DEFAULT_COLOR;
  }
  return ASSENTAMENTO_STATUS_COLORS[label] ?? ASSENTAMENTO_DEFAULT_COLOR;
};

/**
 * Builds the categorical settlement legend (status → color). It's positioned at
 * `bottom-right` only when the assentamentos mode is active; otherwise it's
 * returned without a `position` so it stays hidden, mirroring how the choropleth
 * legends are positioned only for their own mode.
 *
 * @param active - Whether the assentamentos mode is the active one.
 * @returns The settlement {@link LegendSpec}.
 *
 * @example
 * buildAssentamentoLegend(true).position; // 'bottom-right'
 * buildAssentamentoLegend(false).position; // undefined
 */
export const buildAssentamentoLegend = (active: boolean): LegendSpec => {
  return {
    id: ASSENTAMENTO_LEGEND_ID,
    title: ASSENTAMENTO_LEGEND_TITLE,
    subtitle: 'Cor pela situação do cadastro do assentamento no CAR.',
    ...(active ? { position: 'bottom-right' as const } : {}),
    colorBy: {
      type: 'categorical',
      property: 'value',
      mapping: ASSENTAMENTO_STATUS_COLORS,
      defaultColor: ASSENTAMENTO_DEFAULT_COLOR,
    },
    reference:
      'Fonte dos dados: SICAR / Serviço Florestal Brasileiro — {link:consulta.car.gov.br|https://consulta.car.gov.br/geoservices}',
  };
};
