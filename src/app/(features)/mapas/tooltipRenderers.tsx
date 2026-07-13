'use client';

import { Box, Text } from '@chakra-ui/react';
import type * as React from 'react';

import type { CozinhaSituacao, kitchenRateByCity } from '@/data-gateway/schema';

import {
  colorForCadUnico,
  colorForIvs,
  colorForPercentual,
  colorForPessoasPorCozinha,
  colorForQuantidade,
  colorForSituacao,
  colorForTaxa,
  ivsFaixaLabel,
} from './geovisSpec';
import type { MapMode } from './mapDataBuilders';

/** `"N cozinhas"` / `"1 cozinha"`, com o número no formato pt-BR. */
const formatCozinhas = (quantidade: number): string => {
  return `${quantidade.toLocaleString('pt-BR')} ${
    quantidade === 1 ? 'cozinha' : 'cozinhas'
  }`;
};

/** Card do tooltip: título + swatch da faixa + rótulo, com linha auxiliar opcional. */
export const TooltipCard = ({
  name,
  swatchColor,
  primary,
  secondary,
}: {
  name: string;
  swatchColor: string;
  primary: string;
  secondary?: string;
}) => {
  return (
    <Box display="flex" flexDirection="column" gap="1.5" minW="180px">
      <Text fontWeight="bold" fontSize="sm" lineHeight="tight">
        {name}
      </Text>
      <Box display="flex" alignItems="center" gap="2">
        <Box
          w="12px"
          h="12px"
          borderRadius="sm"
          flexShrink={0}
          bg={swatchColor}
        />
        <Text fontSize="xs" color="text.secondary" lineHeight="tight">
          {primary}
        </Text>
      </Box>
      {secondary === undefined ? null : (
        <Text fontSize="xs" color="text.secondary" lineHeight="tight">
          {secondary}
        </Text>
      )}
    </Box>
  );
};

/** Rate-mode tooltip: swatch da taxa + "N por 100 mil hab." + linha auxiliar. */
export const renderRateTooltip = ({
  name,
  register,
}: {
  name: string;
  register?: kitchenRateByCity;
}) => {
  const taxa = register?.porCemMil ?? null;
  const populacao = register?.populacao ?? null;
  const quantidade = register?.quantidade ?? 0;

  const primary =
    taxa === null
      ? 'Sem cozinha registrada'
      : `${taxa.toLocaleString('pt-BR', {
          maximumFractionDigits: 1,
        })} por 100 mil hab.`;

  const secondary =
    taxa !== null && populacao !== null
      ? `${formatCozinhas(quantidade)} · ${populacao.toLocaleString('pt-BR')} hab.`
      : undefined;

  return (
    <TooltipCard
      name={name}
      swatchColor={colorForTaxa(taxa)}
      primary={primary}
      secondary={secondary}
    />
  );
};

/** Count-mode tooltip (modos `coropletico`, `pontos`, `circulos`): swatch + "N cozinhas". */
export const renderCountTooltip = ({
  name,
  quantity,
}: {
  name: string;
  quantity: number;
}) => {
  return (
    <TooltipCard
      name={name}
      swatchColor={colorForQuantidade(quantity)}
      primary={
        quantity === 0 ? 'Sem cozinha registrada' : formatCozinhas(quantity)
      }
    />
  );
};

/** Status-mode tooltip: nome da cozinha + swatch da situação + situação. */
export const renderStatusTooltip = ({
  code,
  register,
}: {
  code: string;
  register?: { nome: string; situacao: CozinhaSituacao };
}) => {
  const situacao = register?.situacao ?? null;
  return (
    <TooltipCard
      name={register?.nome ?? `Cozinha ${code}`}
      swatchColor={colorForSituacao(situacao)}
      primary={situacao ?? 'Situação desconhecida'}
    />
  );
};

/** Share-mode tooltip: swatch da fatia + "X% das cozinhas do Brasil" + linha auxiliar. */
export const renderPercentTooltip = ({
  name,
  register,
}: {
  name: string;
  register?: kitchenRateByCity;
}) => {
  const percentual = register?.percentualDoBrasil ?? 0;
  const quantidade = register?.quantidade ?? 0;

  const primary =
    percentual <= 0
      ? 'Sem cozinha registrada'
      : `${percentual.toLocaleString('pt-BR', {
          maximumFractionDigits: 2,
        })}% das cozinhas do Brasil`;

  const secondary = percentual > 0 ? formatCozinhas(quantidade) : undefined;

  return (
    <TooltipCard
      name={name}
      swatchColor={colorForPercentual(percentual)}
      primary={primary}
      secondary={secondary}
    />
  );
};

/** CadÚnico-mode tooltip: swatch da taxa + "N por 10 mil no CadÚnico" + linha auxiliar. */
export const renderCadUnicoTooltip = ({
  name,
  register,
}: {
  name: string;
  register?: kitchenRateByCity;
}) => {
  const taxa = register?.porDezMilCadUnico ?? null;
  const pessoas = register?.pessoasCadUnico ?? null;
  const quantidade = register?.quantidade ?? 0;

  const primary =
    taxa === null
      ? 'Sem cozinha registrada'
      : `${taxa.toLocaleString('pt-BR', {
          maximumFractionDigits: 2,
        })} por 10 mil no CadÚnico`;

  const secondary =
    taxa !== null && pessoas !== null
      ? `${formatCozinhas(quantidade)} · ${pessoas.toLocaleString('pt-BR')} no CadÚnico`
      : undefined;

  return (
    <TooltipCard
      name={name}
      swatchColor={colorForCadUnico(taxa)}
      primary={primary}
      secondary={secondary}
    />
  );
};

/** Coverage-mode tooltip: swatch + "N pessoas por cozinha" + linha auxiliar. */
export const renderPessoasPorCozinhaTooltip = ({
  name,
  register,
}: {
  name: string;
  register?: kitchenRateByCity;
}) => {
  const pessoasPorCozinha = register?.pessoasPorCozinha ?? null;
  const pessoas = register?.pessoasCadUnico ?? null;
  const quantidade = register?.quantidade ?? 0;

  const primary =
    pessoasPorCozinha === null
      ? 'Sem cozinha registrada'
      : `${pessoasPorCozinha.toLocaleString('pt-BR')} pessoas por cozinha`;

  const secondary =
    pessoasPorCozinha !== null && pessoas !== null
      ? `${formatCozinhas(quantidade)} · ${pessoas.toLocaleString('pt-BR')} no CadÚnico`
      : undefined;

  return (
    <TooltipCard
      name={name}
      swatchColor={colorForPessoasPorCozinha(pessoasPorCozinha)}
      primary={primary}
      secondary={secondary}
    />
  );
};

/**
 * IVS-family tooltip: swatch da faixa + "<label> 0,xxx · <faixa>". Serve o IVS
 * geral e cada subíndice (mesma escala e faixas IPEA), variando só o `label`. O
 * valor vem do feature-state do mapa (o índice já unido ao polígono); municípios
 * ausentes do recorte caem em "Sem dado de <label>".
 */
export const renderIvsTooltip = ({
  name,
  value,
  label,
}: {
  name: string;
  value: number | string | null;
  label: string;
}) => {
  const ivs = typeof value === 'number' ? value : null;
  const faixa = ivsFaixaLabel(ivs);

  const primary =
    ivs === null || faixa === null
      ? `Sem dado de ${label}`
      : `${label} ${ivs.toLocaleString('pt-BR', {
          minimumFractionDigits: 3,
          maximumFractionDigits: 3,
        })} · ${faixa}`;

  return (
    <TooltipCard name={name} swatchColor={colorForIvs(ivs)} primary={primary} />
  );
};

/**
 * IVS-family modes and the metric label their tooltip shows. Keyed by
 * {@link MapMode} so {@link renderFillTooltip} resolves the whole family in one
 * lookup instead of a branch per sub-index.
 */
const IVS_TOOLTIP_LABELS: Partial<Record<MapMode, string>> = {
  'coropletico-ivs': 'IVS',
  'coropletico-ivs-infraestrutura': 'Infraestrutura urbana',
  'coropletico-ivs-capital-humano': 'Capital humano',
  'coropletico-ivs-renda-trabalho': 'Renda e trabalho',
};

/** Fill-tooltip renderers keyed by the mode they serve, one metric each. */
const FILL_TOOLTIP_RENDERERS: Partial<
  Record<
    MapMode,
    (params: { name: string; register?: kitchenRateByCity }) => React.ReactNode
  >
> = {
  'coropletico-taxa': renderRateTooltip,
  'coropletico-percentual': renderPercentTooltip,
  'coropletico-cadunico': renderCadUnicoTooltip,
  'coropletico-pessoas-cozinha': renderPessoasPorCozinhaTooltip,
};

/**
 * Resolves the município fill's hover-tooltip content, dispatching on the
 * active map mode. Each choropleth mode renders the metric it colors by (rate,
 * share, CadÚnico rate, coverage, overall IVS and each IVS sub-index); every
 * other mode (`coropletico`, `pontos`, `pontos-status`, `circulos`) falls back
 * to the raw kitchen count, taken from the map's feature-state `value` when
 * present, otherwise from the joined `register`.
 *
 * @param params.mode active {@link MapMode} driving which metric is shown.
 * @param params.name resolved município display name (already falls back to
 * `Município <code>` upstream).
 * @param params.register canonical row for the município, or `undefined` when
 * it has no cozinhas (tooltips then read as "Sem cozinha registrada").
 * @param params.value the hovered feature's `value` from geovis feature-state
 * (the painted count/score), used by the IVS-family and count renderers.
 * @returns the tooltip card element for the hovered município.
 *
 * @example
 * renderFillTooltip({ mode: 'coropletico', name: 'São Paulo', register, value: 5 });
 */
export const renderFillTooltip = ({
  mode,
  name,
  register,
  value,
}: {
  mode: MapMode;
  name: string;
  register?: kitchenRateByCity;
  value: number | string | null;
}): React.ReactNode => {
  const renderMetric = FILL_TOOLTIP_RENDERERS[mode];
  if (renderMetric) {
    return renderMetric({ name, register });
  }

  const ivsLabel = IVS_TOOLTIP_LABELS[mode];
  if (ivsLabel) {
    return renderIvsTooltip({ name, value, label: ivsLabel });
  }

  const quantity =
    typeof value === 'number' ? value : (register?.quantidade ?? 0);
  return renderCountTooltip({ name, quantity });
};
