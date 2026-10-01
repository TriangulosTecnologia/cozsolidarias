import type { LegendSpec, MapDataRow } from '@ttoss/geovis';

import type { kitchenRateByCity } from '@/data-gateway/schema';

const PESSOAS_LEGEND_ID = 'legenda-pessoas-atendidas';
const PESSOAS_COLOR = '#E4572E';

/**
 * Legend of the `circulos-pessoas` mode. Positioned only while that mode is
 * active; geovis draws the reference circles itself from the spec's
 * `scaleMaxValue` and the layer's sqrt `sizeBy`.
 *
 * @param active - Whether `circulos-pessoas` is the current mode.
 * @returns The legend spec, anchored bottom-right only when `active`.
 *
 * @example
 * buildPessoasLegend(mode === 'circulos-pessoas');
 */
export const buildPessoasLegend = (active: boolean): LegendSpec => {
  return {
    id: PESSOAS_LEGEND_ID,
    title: 'Pessoas atendidas',
    subtitle:
      'A área de cada círculo é proporcional ao total de pessoas atendidas pelas cozinhas do município. Municípios sem total informado ficam sem círculo.',
    icon: 'lucide:users',
    iconColor: PESSOAS_COLOR,
    ...(active ? { position: 'bottom-right' as const, offset: 12 } : {}),
    colorBy: {
      type: 'categorical',
      property: 'value',
      mapping: { 'Pessoas atendidas': PESSOAS_COLOR },
      defaultColor: PESSOAS_COLOR,
    },
    reference: 'Fonte dos dados: Cozinhas Solidárias',
  };
};

/**
 * Bubble-source rows carrying the people served per município. Municípios
 * without a reported total are dropped so they get no circle.
 *
 * @param byCity - Per-município kitchen registers.
 * @returns One `{ geometryId, value }` row per município with a total.
 *
 * @example
 * toPessoasRows([{ codigoIbge: '2927408', pessoasAtendidas: 120 }]);
 */
export const toPessoasRows = (byCity: kitchenRateByCity[]): MapDataRow[] => {
  return byCity.flatMap(({ codigoIbge, pessoasAtendidas }) => {
    return pessoasAtendidas === null
      ? []
      : [{ geometryId: codigoIbge, value: pessoasAtendidas }];
  });
};
