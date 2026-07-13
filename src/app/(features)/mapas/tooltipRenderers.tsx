'use client';

import { Box, Text } from '@chakra-ui/react';

import type { CozinhaSituacao, kitchenRateByCity } from '@/data-gateway/schema';

import {
  colorForPercentual,
  colorForQuantidade,
  colorForSituacao,
  colorForTaxa,
} from './geovisSpec';

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
