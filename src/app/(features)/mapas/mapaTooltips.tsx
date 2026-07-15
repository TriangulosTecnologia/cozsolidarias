import { Box, Text } from '@chakra-ui/react';
import type { MapHoverInfo } from '@ttoss/geovis';
import type * as React from 'react';

import type { kitchenRateByCity } from '@/data-gateway/schema';

import {
  assentamentoStatusLabel,
  colorForAssentamentoStatus,
} from './geovisAssentamentosScales';
import {
  colorForCadUnico,
  colorForPercentual,
  colorForPessoasPorCozinha,
  colorForQuantidade,
  colorForTaxa,
  type MapMode,
} from './geovisScales';
import {
  colorForIdhm,
  colorForIvs,
  idhmFaixaLabel,
  ivsFaixaLabel,
} from './geovisScoreScales';
import type { AssentamentoAtributo } from './geovisSpec';

/** `"N cozinhas"` / `"1 cozinha"`, com o número no formato pt-BR. */
const formatCozinhas = (quantidade: number): string => {
  return `${quantidade.toLocaleString('pt-BR')} ${
    quantidade === 1 ? 'cozinha' : 'cozinhas'
  }`;
};

/**
 * Card do tooltip: título + swatch da faixa (opcional) + rótulo, com linha
 * auxiliar opcional e linhas de detalhe extras opcionais. Omita `swatchColor`
 * em modos sem paint data-driven (ex.: `pontos`), onde o quadrado colorido não
 * representaria nenhuma faixa.
 */
const TooltipCard = ({
  name,
  swatchColor,
  primary,
  secondary,
  details,
}: {
  name: string;
  swatchColor?: string;
  primary: string;
  secondary?: string;
  details?: string[];
}) => {
  return (
    <Box display="flex" flexDirection="column" gap="1.5" minW="180px">
      <Text fontWeight="bold" fontSize="sm" lineHeight="tight">
        {name}
      </Text>
      <Box display="flex" alignItems="center" gap="2">
        {swatchColor === undefined ? null : (
          <Box
            w="12px"
            h="12px"
            borderRadius="sm"
            flexShrink={0}
            bg={swatchColor}
          />
        )}
        <Text fontSize="xs" color="text.secondary" lineHeight="tight">
          {primary}
        </Text>
      </Box>
      {secondary === undefined ? null : (
        <Text fontSize="xs" color="text.secondary" lineHeight="tight">
          {secondary}
        </Text>
      )}
      {details?.map((line) => {
        return (
          <Text
            key={line}
            fontSize="xs"
            color="text.secondary"
            lineHeight="tight"
          >
            {line}
          </Text>
        );
      })}
    </Box>
  );
};

/** Rate-mode tooltip: swatch da taxa + "N por 100 mil hab." + linha auxiliar. */
const renderRateTooltip = ({
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

/**
 * Count-mode tooltip (modos `coropletico`, `pontos`, `circulos`): "N cozinhas".
 * O swatch da faixa só aparece no coroplético de contagem — em `pontos` e
 * `circulos` os municípios não são pintados por quantidade, então o quadrado
 * colorido seria enganoso e é omitido.
 */
const renderCountTooltip = ({
  name,
  quantity,
  showSwatch,
}: {
  name: string;
  quantity: number;
  showSwatch: boolean;
}) => {
  return (
    <TooltipCard
      name={name}
      swatchColor={showSwatch ? colorForQuantidade(quantity) : undefined}
      primary={
        quantity === 0 ? 'Sem cozinha registrada' : formatCozinhas(quantity)
      }
    />
  );
};

/** Share-mode tooltip: swatch da fatia + "X% das cozinhas do Brasil" + linha auxiliar. */
const renderPercentTooltip = ({
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
const renderCadUnicoTooltip = ({
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
const renderPessoasPorCozinhaTooltip = ({
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

/** A score family's tooltip copy + scale resolvers, shared by every member. */
type ScoreTooltip = {
  label: string;
  colorFor: (value: number | null) => string;
  faixaLabel: (value: number | null) => string | null;
};

/**
 * Score-family tooltip (IVS or IDHM): swatch da faixa + "<label> 0,xxx ·
 * <faixa>". Serve qualquer índice na escala `[0, 1]`, variando o `label` e os
 * resolvedores de cor/faixa. O valor vem do feature-state do mapa (o índice já
 * unido ao polígono); municípios ausentes do recorte caem em "Sem dado de
 * <label>".
 */
const renderScoreTooltip = ({
  name,
  value,
  score,
}: {
  name: string;
  value: MapHoverInfo['value'];
  score: ScoreTooltip;
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
      swatchColor={score.colorFor(numeric)}
      primary={primary}
    />
  );
};

/** Linhas de detalhe do tooltip de assentamento, a partir dos atributos do bruto. */
const assentamentoDetails = (atributo: AssentamentoAtributo): string[] => {
  const area = atributo.areaHa.toLocaleString('pt-BR', {
    maximumFractionDigits: 1,
  });
  const modulos = atributo.modulosFiscais.toLocaleString('pt-BR', {
    maximumFractionDigits: 2,
  });
  return [
    `${atributo.municipio} — ${atributo.uf}`,
    `Área: ${area} ha · ${modulos} módulos fiscais`,
    `Condição: ${atributo.condicao}`,
    `Criado em ${atributo.dtCriacao} · atualizado em ${atributo.dtAtualizacao}`,
  ];
};

/**
 * Assentamentos-mode tooltip: título = `cod_imovel` (a base bruta não tem nome
 * de assentamento), swatch da situação + "Situação: <label>" e linhas de detalhe
 * com município/UF, área, módulos fiscais, condição ambiental e datas. O rótulo
 * de situação vem do `value` do feature-state (o que o mapa pintou) quando
 * presente; senão é derivado do `atributo`.
 *
 * @param params.atributo - Atributos do assentamento sob o cursor, ou
 * `undefined` quando o `cod_imovel` não está no sidecar.
 * @param params.value - `value` do feature-state (o rótulo de situação pintado).
 * @returns O card de tooltip do assentamento.
 *
 * @example
 * renderAssentamentoTooltip({ atributo, value: 'Ativo' });
 * // <TooltipCard> com "Situação: Ativo" e os detalhes do imóvel
 */
export const renderAssentamentoTooltip = ({
  atributo,
  value,
}: {
  atributo?: AssentamentoAtributo;
  value: MapHoverInfo['value'];
}): React.ReactNode => {
  const label =
    typeof value === 'string'
      ? value
      : atributo
        ? assentamentoStatusLabel(atributo.status)
        : null;

  const name = atributo?.codImovel ?? 'Assentamento';
  const primary =
    label === null ? 'Situação desconhecida' : `Situação: ${label}`;

  return (
    <TooltipCard
      name={name}
      swatchColor={colorForAssentamentoStatus(label)}
      primary={primary}
      details={
        atributo === undefined ? undefined : assentamentoDetails(atributo)
      }
    />
  );
};

/**
 * IVS- and IDHM-family modes and each one's tooltip copy + scale resolvers.
 * Keyed by {@link MapMode} so the dispatcher resolves the whole family in one
 * lookup.
 */
const SCORE_TOOLTIPS: Partial<Record<MapMode, ScoreTooltip>> = {
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

/**
 * Resolves the hover-tooltip content for a município, dispatching on the active
 * map mode. Each choropleth mode renders the metric it colors by (rate, share,
 * CadÚnico rate, coverage, any IVS- or IDHM-family score); every other mode
 * (`coropletico`, `pontos`, `circulos`) falls back to the raw kitchen count,
 * taken from the map's feature-state `value` when present, otherwise from the
 * joined `register`.
 *
 * @param params.mode - Active {@link MapMode} driving which metric is shown.
 * @param params.name - Resolved município display name (already falls back to
 * `Município <code>` upstream).
 * @param params.register - Canonical row for the município, or `undefined` when
 * it has no cozinhas (tooltips then read as "Sem cozinha registrada").
 * @param params.value - The hovered feature's `value` from geovis feature-state
 * (the painted count), used only by the count fallback.
 * @returns The tooltip card element for the hovered município.
 *
 * @example
 * renderMunicipioTooltip({ mode: 'coropletico', name: 'São Paulo', register, value: 5 });
 * // <TooltipCard> showing "5 cozinhas"
 */
export const renderMunicipioTooltip = ({
  mode,
  name,
  register,
  value,
}: {
  mode: MapMode;
  name: string;
  register?: kitchenRateByCity;
  value: MapHoverInfo['value'];
}): React.ReactNode => {
  if (mode === 'coropletico-taxa') {
    return renderRateTooltip({ name, register });
  }

  if (mode === 'coropletico-percentual') {
    return renderPercentTooltip({ name, register });
  }

  if (mode === 'coropletico-cadunico') {
    return renderCadUnicoTooltip({ name, register });
  }

  if (mode === 'coropletico-pessoas-cozinha') {
    return renderPessoasPorCozinhaTooltip({ name, register });
  }

  const score = SCORE_TOOLTIPS[mode];
  if (score) {
    return renderScoreTooltip({ name, value, score });
  }

  // Contagem bruta: vem do feature-state quando presente, senão dos dados
  // (ausente => 0). O swatch da faixa só faz sentido no coroplético de
  // contagem; em `pontos` e `circulos` os municípios usam a cor padrão.
  const quantity =
    typeof value === 'number' ? value : (register?.quantidade ?? 0);

  return renderCountTooltip({
    name,
    quantity,
    showSwatch: mode === 'coropletico',
  });
};
