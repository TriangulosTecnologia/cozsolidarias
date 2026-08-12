/* eslint-disable max-lines -- Cohesive hover-tooltip renderer registry: one
   renderer per map mode (choropleth variants, points, settlements) plus the
   mode→content dispatcher, kept together so the whole hover surface reads as one
   unit. Splitting would scatter closely-related copy. Tracked as a follow-up. */
import { Box, Text } from '@chakra-ui/react';
import type { MapHoverInfo } from '@ttoss/geovis';
import type * as React from 'react';

import type {
  cadinsanByCity,
  cafByCity,
  kitchenRateByCity,
} from '@/data-gateway/schema';

import {
  assentamentoStatusLabel,
  colorForAssentamentoStatus,
} from './geovisAssentamentosScales';
import {
  colorForCozinhaStatus,
  cozinhaStatusShortLabel,
} from './geovisCozinhaStatusScales';
import {
  colorForCadinsan,
  colorForCadUnico,
  colorForCafPercentual,
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
import { TooltipCard } from './mapaTooltipCard';

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

/**
 * CAF-share-mode tooltip: swatch + "X% dos CAFs do Brasil" + a "N CAFs" line with
 * the count in the município, both read from the joined CAF `register`. Municípios
 * absent from the CAF snapshot read "Sem CAF registrado". 4 decimals because the
 * shares are tiny (median ≈ 0,0084%).
 */
const renderCafPercentTooltip = ({
  name,
  register,
}: {
  name: string;
  register?: cafByCity;
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
      swatchColor={colorForCafPercentual(percentual)}
      primary={primary}
      secondary={secondary}
    />
  );
};

/** `"X,y%"` no formato pt-BR, com uma casa decimal. */
const formatPercent = (value: number): string => {
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
};

/** Inteiro no formato pt-BR (separador de milhar). */
const formatFamilias = (value: number): string => {
  return value.toLocaleString('pt-BR');
};

/**
 * Frase do efeito do Bolsa Família na variação CADINSAN, comparando com o
 * cenário oposto: no modo `sem` mostra o alívio ("cai para"); no `com` mostra o
 * contrafactual ("seria"). Retorna `undefined` quando o cenário oposto não tem
 * proporção (sem denominador do CadÚnico).
 */
const cadinsanEffectLine = ({
  variant,
  proporcao,
  absoluto,
}: {
  variant: 'com' | 'sem';
  proporcao: number | null;
  absoluto: number;
}): string | undefined => {
  if (proporcao === null) {
    return undefined;
  }
  const detalhe = `${formatPercent(proporcao)} (${formatFamilias(absoluto)} famílias)`;
  return variant === 'sem'
    ? `Com o Bolsa Família, cai para ${detalhe}`
    : `Sem o Bolsa Família, seria ${detalhe}`;
};

/**
 * CADINSAN-mode tooltip. Destaca a proporção do cenário ativo (com/sem o efeito
 * do Bolsa Família) com a cor da faixa do mapa, a linha "N de M famílias do
 * CadÚnico neste cenário", e — como cada município carrega os dois cenários — uma
 * linha de efeito com a proporção do cenário oposto. Assim o leitor lê os dois
 * números como o mesmo indicador sob dois cenários, nunca como "quem recebe
 * Bolsa Família". Municípios sem denominador do CadÚnico (`proporcao === null`)
 * leem apenas "Sem dado do CadÚnico". `variant` escolhe a métrica ativa; as duas
 * dividem a mesma escala de cor.
 */
const renderCadinsanTooltip = ({
  name,
  register,
  variant,
}: {
  name: string;
  register?: cadinsanByCity;
  variant: 'com' | 'sem';
}) => {
  const semDado = (
    <TooltipCard
      name={name}
      swatchColor={colorForCadinsan(null)}
      primary="Sem dado do CadÚnico"
    />
  );
  if (register === undefined) {
    return semDado;
  }

  const isCom = variant === 'com';
  const activeProporcao = isCom
    ? register.proporcaoComPbf
    : register.proporcaoSemPbf;
  if (activeProporcao === null) {
    return semDado;
  }

  const activeAbsoluto = isCom
    ? register.absolutoComPbf
    : register.absolutoSemPbf;
  const qualifier = isCom ? 'com o Bolsa Família' : 'sem o Bolsa Família';

  const effect = cadinsanEffectLine({
    variant,
    proporcao: isCom ? register.proporcaoSemPbf : register.proporcaoComPbf,
    absoluto: isCom ? register.absolutoSemPbf : register.absolutoComPbf,
  });

  return (
    <TooltipCard
      name={name}
      swatchColor={colorForCadinsan(activeProporcao)}
      primary={`${formatPercent(activeProporcao)} em insegurança alimentar (${qualifier})`}
      secondary={`${formatFamilias(activeAbsoluto)} de ${formatFamilias(register.cadastrosCadunico)} famílias do CadÚnico neste cenário`}
      details={effect === undefined ? undefined : [effect]}
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
 * Choropleth modes whose tooltip reads only `{ name, register }` from the
 * canonical cozinha rate rows. Keyed by {@link MapMode} so the dispatcher
 * resolves them in one lookup instead of a branch each.
 */
const RATE_TOOLTIPS: Partial<
  Record<
    MapMode,
    (args: { name: string; register?: kitchenRateByCity }) => React.ReactNode
  >
> = {
  'coropletico-taxa': renderRateTooltip,
  'coropletico-percentual': renderPercentTooltip,
  'coropletico-cadunico': renderCadUnicoTooltip,
  'coropletico-pessoas-cozinha': renderPessoasPorCozinhaTooltip,
};

/** The two CADINSAN modes and the com/sem-PBF scenario each one shows. */
const CADINSAN_VARIANTS: Partial<Record<MapMode, 'com' | 'sem'>> = {
  'coropletico-cadinsan-com-pbf': 'com',
  'coropletico-cadinsan-sem-pbf': 'sem',
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
}: {
  mode: MapMode;
  name: string;
  register?: kitchenRateByCity;
  cafRegister?: cafByCity;
  cadinsanRegister?: cadinsanByCity;
  value: MapHoverInfo['value'];
}): React.ReactNode => {
  const rateTooltip = RATE_TOOLTIPS[mode];
  if (rateTooltip) {
    return rateTooltip({ name, register });
  }

  if (mode === 'coropletico-cafs-percentual') {
    return renderCafPercentTooltip({ name, register: cafRegister });
  }

  const cadinsanVariant = CADINSAN_VARIANTS[mode];
  if (cadinsanVariant) {
    return renderCadinsanTooltip({
      name,
      register: cadinsanRegister,
      variant: cadinsanVariant,
    });
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
