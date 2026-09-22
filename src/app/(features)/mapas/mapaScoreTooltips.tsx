/**
 * Hover tooltips for the score families (IVS and IDHM).
 *
 * They share one renderer because they share one shape: an index in `[0, 1]`
 * plus the faixa it falls in. Only the copy and the two scale resolvers differ,
 * which is what {@link SCORE_TOOLTIPS} carries per mode.
 */

import type { MapHoverInfo } from '@ttoss/geovis';

import type { MapMode } from './geovisMapMode';
import {
  colorForIdhm,
  colorForIvs,
  idhmFaixaLabel,
  ivsFaixaLabel,
} from './geovisScoreScales';
import { TooltipCard } from './mapaTooltipCard';

/** A score family's tooltip copy + scale resolvers, shared by every member. */
export type ScoreTooltip = {
  label: string;
  colorFor: (value: number | null, rampId?: string) => string;
  faixaLabel: (value: number | null) => string | null;
};

/**
 * Score-family tooltip (IVS or IDHM): swatch da faixa + "<label> 0,xxx ·
 * <faixa>". Serve qualquer índice na escala `[0, 1]`, variando o `label` e os
 * resolvedores de cor/faixa. O valor vem do feature-state do mapa (o índice já
 * unido ao polígono); municípios ausentes do recorte caem em "Sem dado de
 * <label>".
 */
export const renderScoreTooltip = ({
  name,
  value,
  score,
  rampId,
}: {
  name: string;
  value: MapHoverInfo['value'];
  score: ScoreTooltip;
  /** The ramp the map is being read through, so the swatch names the same band. */
  rampId?: string;
}) => {
  const numeric = typeof value === 'number' ? value : null;
  const faixa = score.faixaLabel(numeric);

  const primary =
    numeric === null || faixa === null
      ? `Sem dado de ${score.label}`
      : `${score.label} ${numeric.toLocaleString('pt-BR', {
          minimumFractionDigits: 3,
          maximumFractionDigits: 3,
        })} · ${faixa}`;

  return (
    <TooltipCard
      name={name}
      swatchColor={score.colorFor(numeric, rampId)}
      primary={primary}
    />
  );
};
/**
 * IVS- and IDHM-family modes and each one's tooltip copy + scale resolvers.
 * Keyed by {@link MapMode} so the dispatcher resolves the whole family in one
 * lookup.
 */
export const SCORE_TOOLTIPS: Partial<Record<MapMode, ScoreTooltip>> = {
  'coropletico-ivs': {
    label: 'IVS',
    colorFor: colorForIvs,
    faixaLabel: ivsFaixaLabel,
  },
  'coropletico-ivs-infraestrutura': {
    label: 'Infraestrutura urbana',
    colorFor: colorForIvs,
    faixaLabel: ivsFaixaLabel,
  },
  'coropletico-ivs-capital-humano': {
    label: 'Capital humano',
    colorFor: colorForIvs,
    faixaLabel: ivsFaixaLabel,
  },
  'coropletico-ivs-renda-trabalho': {
    label: 'Renda e trabalho',
    colorFor: colorForIvs,
    faixaLabel: ivsFaixaLabel,
  },
  'coropletico-idhm': {
    label: 'IDHM',
    colorFor: colorForIdhm,
    faixaLabel: idhmFaixaLabel,
  },
  'coropletico-idhm-longevidade': {
    label: 'IDHM Longevidade',
    colorFor: colorForIdhm,
    faixaLabel: idhmFaixaLabel,
  },
  'coropletico-idhm-educacao': {
    label: 'IDHM Educação',
    colorFor: colorForIdhm,
    faixaLabel: idhmFaixaLabel,
  },
  'coropletico-idhm-renda': {
    label: 'IDHM Renda',
    colorFor: colorForIdhm,
    faixaLabel: idhmFaixaLabel,
  },
  'coropletico-idhm-educacao-escolaridade': {
    label: 'IDHM Escolaridade',
    colorFor: colorForIdhm,
    faixaLabel: idhmFaixaLabel,
  },
  'coropletico-idhm-educacao-frequencia': {
    label: 'IDHM Frequência escolar',
    colorFor: colorForIdhm,
    faixaLabel: idhmFaixaLabel,
  },
};
