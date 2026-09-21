import { Box, Text } from '@chakra-ui/react';
import type { MapHoverInfo } from '@ttoss/geovis';
import type * as React from 'react';

import type {
  cadinsanByCity,
  cafByCity,
  kitchenRateByCity,
} from '@/data-gateway/schema';

import {
  colorForCozinhaStatus,
  cozinhaStatusShortLabel,
} from './geovisCozinhaStatusScales';
import {
  colorForCadUnico,
  colorForCafPercentual,
  colorForPercentual,
  colorForPessoasPorCozinha,
  colorForQuantidade,
  colorForTaxa,
  type MapMode,
} from './geovisScales';
import { renderAssentamentoTooltip } from './mapaAssentamentoTooltip';
import { renderCadinsanTooltip } from './mapaCadinsanTooltips';
import { renderScoreTooltip, SCORE_TOOLTIPS } from './mapaScoreTooltips';
import { TooltipCard } from './mapaTooltipCard';

/** Re-exported so consumers keep importing every tooltip from here. */
export { renderAssentamentoTooltip };

/** `"N cozinhas"` / `"1 cozinha"`, com o número no formato pt-BR. */
const formatCozinhas = (quantidade: number): string => {
  return `${quantidade.toLocaleString('pt-BR')} ${
    quantidade === 1 ? 'cozinha' : 'cozinhas'
  }`;
};

/**
 * Tooltip for a hovered kitchen point: "Nome da cozinha" caption, the name, and
 * the terse operating-status label (Ativo / Reduzido / Inativo / Não informado).
 * The left-border accent is the point's own status color, so the hover reads the
 * name plus the situation that colors the point.
 *
 * @param params.nome - Kitchen display name from `properties.nome`.
 * @param params.statusLabel - Descriptive status label (from
 * `cozinhaStatusLabel(emFuncionamento)`), or `null` when unknown.
 * @returns The tooltip element for the hovered kitchen point.
 *
 * @example
 * renderCozinhaTooltip({ nome: 'Cozinha Esperança', statusLabel: 'Em funcionamento' });
 */
export const renderCozinhaTooltip = ({
  nome,
  statusLabel,
}: {
  nome: string;
  statusLabel: string | null;
}): React.ReactNode => {
  return (
    <Box
      minW="180px"
      maxW="260px"
      borderLeft="3px solid"
      borderLeftColor={colorForCozinhaStatus(statusLabel)}
      pl="2.5"
    >
      <Text fontSize="xs" color="text.secondary" lineHeight="tight" mb="0.5">
        Nome da cozinha
      </Text>
      <Text fontSize="sm" fontWeight="bold" lineHeight="tight" lineClamp="2">
        {nome}
      </Text>
      <Text fontSize="xs" color="text.secondary" lineHeight="tight" mt="1">
        {cozinhaStatusShortLabel(statusLabel)}
      </Text>
    </Box>
  );
};

/** Rate-mode tooltip: swatch da taxa + "N por 100 mil hab." + linha auxiliar. */
const renderRateTooltip = ({
  name,
  register,
  rampId,
}: {
  name: string;
  register?: kitchenRateByCity;
  rampId?: string;
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
      swatchColor={colorForTaxa(taxa, rampId)}
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
  rampId,
}: {
  name: string;
  quantity: number;
  showSwatch: boolean;
  rampId?: string;
}) => {
  return (
    <TooltipCard
      name={name}
      swatchColor={
        showSwatch ? colorForQuantidade(quantity, rampId) : undefined
      }
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
  rampId,
}: {
  name: string;
  register?: kitchenRateByCity;
  rampId?: string;
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
      swatchColor={colorForPercentual(percentual, rampId)}
      primary={primary}
      secondary={secondary}
    />
  );
};

/**
 * CAF-share-mode tooltip: swatch + "X% dos CAFs do Brasil" + a "N CAFs" line with
 * the count in the município, both read from the joined CAF `register`. Municípios
 * absent from the CAF snapshot read "Sem CAF registrado". 4 decimals because the
 * shares are tiny (median ≈ 0,0084%).
 */
const renderCafPercentTooltip = ({
  name,
  register,
  rampId,
}: {
  name: string;
  register?: cafByCity;
  rampId?: string;
}) => {
  const percentual = register?.percentualDoBrasil ?? 0;
  const quantidade = register?.quantidade ?? 0;

  const primary =
    percentual <= 0
      ? 'Sem CAF registrado'
      : `${percentual.toLocaleString('pt-BR', {
          maximumFractionDigits: 4,
        })}% dos CAFs do Brasil`;

  const secondary =
    quantidade > 0
      ? `${quantidade.toLocaleString('pt-BR')} ${
          quantidade === 1 ? 'CAF' : 'CAFs'
        }`
      : undefined;

  return (
    <TooltipCard
      name={name}
      swatchColor={colorForCafPercentual(percentual, rampId)}
      primary={primary}
      secondary={secondary}
    />
  );
};

/** CadÚnico-mode tooltip: swatch da taxa + "N por 10 mil no CadÚnico" + linha auxiliar. */
const renderCadUnicoTooltip = ({
  name,
  register,
  rampId,
}: {
  name: string;
  register?: kitchenRateByCity;
  rampId?: string;
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
      swatchColor={colorForCadUnico(taxa, rampId)}
      primary={primary}
      secondary={secondary}
    />
  );
};

/** Coverage-mode tooltip: swatch + "N pessoas por cozinha" + linha auxiliar. */
const renderPessoasPorCozinhaTooltip = ({
  name,
  register,
  rampId,
}: {
  name: string;
  register?: kitchenRateByCity;
  rampId?: string;
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
      swatchColor={colorForPessoasPorCozinha(pessoasPorCozinha, rampId)}
      primary={primary}
      secondary={secondary}
    />
  );
};

/**
 * Choropleth modes whose tooltip reads only `{ name, register }` from the
 * canonical cozinha rate rows. Keyed by {@link MapMode} so the dispatcher
 * resolves them in one lookup instead of a branch each.
 */
const RATE_TOOLTIPS: Partial<
  Record<
    MapMode,
    (args: {
      name: string;
      register?: kitchenRateByCity;
      rampId?: string;
    }) => React.ReactNode
  >
> = {
  'coropletico-taxa': renderRateTooltip,
  'coropletico-percentual': renderPercentTooltip,
  'coropletico-cadunico': renderCadUnicoTooltip,
  'coropletico-pessoas-cozinha': renderPessoasPorCozinhaTooltip,
};

/**
 * Município tooltip for the CAF points view: how many CAFs the município holds.
 *
 * The points themselves carry no properties — the tiles are geometry only — so
 * the count comes from the same per-município aggregate the CAF choropleth
 * paints. Without this the hover would fall through to the kitchen count and
 * report cozinhas while the user is looking at CAF dots.
 */
const renderCafCountTooltip = ({
  name,
  register,
}: {
  name: string;
  register?: cafByCity;
}) => {
  const quantidade = register?.quantidade ?? 0;

  return (
    <TooltipCard
      name={name}
      primary={
        quantidade > 0
          ? `${quantidade.toLocaleString('pt-BR')} ${
              quantidade === 1 ? 'CAF' : 'CAFs'
            }`
          : 'Sem CAF registrado'
      }
    />
  );
};

/** The two CADINSAN modes and the com/sem-PBF scenario each one shows. */
const CADINSAN_VARIANTS: Partial<Record<MapMode, 'com' | 'sem'>> = {
  'coropletico-cadinsan-com-pbf': 'com',
  'coropletico-cadinsan-sem-pbf': 'sem',
};

/**
 * Resolves the hover-tooltip content for a município, dispatching on the active
 * map mode. Each choropleth mode renders the metric it colors by (rate, share,
 * CadÚnico rate, coverage, any IVS- or IDHM-family score), `cafs` renders the
 * município's CAF count; every other mode
 * (`coropletico`, `pontos`, `circulos`) falls back to the raw kitchen count,
 * taken from the map's feature-state `value` when present, otherwise from the
 * joined `register`.
 *
 * @param params.mode - Active {@link MapMode} driving which metric is shown.
 * @param params.name - Resolved município display name (already falls back to
 * `Município <code>` upstream).
 * @param params.register - Canonical cozinha row for the município, or `undefined`
 * when it has no cozinhas (tooltips then read as "Sem cozinha registrada").
 * @param params.cafRegister - Canonical CAF row for the município, or `undefined`
 * when it has no CAF; read only in the `coropletico-cafs-percentual` mode.
 * @param params.cadinsanRegister - Canonical CADINSAN row for the município, or
 * `undefined` when absent; read only in the `coropletico-cadinsan-*` modes.
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
  cafRegister,
  cadinsanRegister,
  value,
  rampId,
}: {
  mode: MapMode;
  name: string;
  register?: kitchenRateByCity;
  cafRegister?: cafByCity;
  cadinsanRegister?: cadinsanByCity;
  value: MapHoverInfo['value'];
  /**
   * The ramp the map is being read through, from the settings zone. The card's
   * swatch has to come from the same one: it is there to tie the hovered
   * município to its band on the map, and a swatch drawn from a palette the map
   * is no longer using would point at the wrong band.
   */
  rampId?: string;
}): React.ReactNode => {
  const rateTooltip = RATE_TOOLTIPS[mode];
  if (rateTooltip) {
    return rateTooltip({ name, register, rampId });
  }

  if (mode === 'coropletico-cafs-percentual') {
    return renderCafPercentTooltip({ name, register: cafRegister, rampId });
  }

  if (mode === 'cafs') {
    return renderCafCountTooltip({ name, register: cafRegister });
  }

  const cadinsanVariant = CADINSAN_VARIANTS[mode];
  if (cadinsanVariant) {
    return renderCadinsanTooltip({
      name,
      register: cadinsanRegister,
      variant: cadinsanVariant,
      rampId,
    });
  }

  const score = SCORE_TOOLTIPS[mode];
  if (score) {
    return renderScoreTooltip({ name, value, score, rampId });
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
    rampId,
  });
};

/**
 * Hover card for the CAF map's country level: the state's name and how many
 * CAFs it holds.
 *
 * Both come straight from the hover info — the `caf-ufs` join promotes each
 * anchor's `nome` to the feature id and carries its total as the value — so the
 * card never disagrees with the number drawn on the circle.
 *
 * @param params.nome - The UF's name, from `MapHoverInfo.featureId`.
 * @param params.quantidade - The UF's CAF total, from `MapHoverInfo.value`, or
 * `null` before the join has loaded.
 * @returns The tooltip card.
 *
 * @example
 * renderCafUfTooltip({ nome: 'Bahia', quantidade: 712480 });
 * // <TooltipCard name="Bahia" primary="712.480 CAFs" />
 */
export const renderCafUfTooltip = ({
  nome,
  quantidade,
}: {
  nome: string;
  quantidade: number | null;
}) => {
  return (
    <TooltipCard
      name={nome}
      primary={
        quantidade === null
          ? 'Carregando…'
          : `${quantidade.toLocaleString('pt-BR')} ${
              quantidade === 1 ? 'CAF' : 'CAFs'
            }`
      }
    />
  );
};
