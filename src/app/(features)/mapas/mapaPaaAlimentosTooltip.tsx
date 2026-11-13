/**
 * The PAA family's hover cards: the share of the planned food bought from the
 * município's suppliers, and the planned kg per person its cozinhas serve.
 *
 * Their own module for the reason the CADINSAN card has one — cards whose copy
 * is about one source, kept out of the dispatcher.
 */

import type {
  PaaAlimentosByCity,
  PaaKgPorPessoaByCity,
} from '@/data-gateway/schema';

import {
  colorForPaaAlimentos,
  colorForPaaKgPorPessoa,
} from './geovisChoroplethScales';
import { TooltipCard } from './mapaTooltipCard';

/** `"N produto(s)"` / `"N fornecedor(es)"`, com o número no formato pt-BR. */
const formatContagem = ({
  quantidade,
  singular,
  plural,
}: {
  quantidade: number;
  singular: string;
  plural: string;
}): string => {
  return `${quantidade.toLocaleString('pt-BR')} ${quantidade === 1 ? singular : plural}`;
};

/** Toneladas com uma casa decimal, no formato pt-BR. */
const formatToneladas = (kg: number): string => {
  return `${(Math.round(kg / 100) / 10).toLocaleString('pt-BR')} t`;
};

/**
 * Tooltip do modo `coropletico-paa-alimentos`. Destaca a parcela (%) dos
 * alimentos previstos no Brasil com a cor da faixa do mapa, mostra as
 * toneladas e quantos produtos e fornecedores a compõem. Municípios sem compra
 * prevista leem "Sem compra prevista no PAA".
 *
 * @param params.name - Nome do município já resolvido.
 * @param params.register - Linha do município, ou `undefined` sem compra.
 * @param params.rampId - Rampa ativa, para o swatch bater com o mapa.
 * @returns O card do tooltip.
 *
 * @example
 * renderPaaAlimentosTooltip({ name: 'Eldorado do Sul', register });
 * // <TooltipCard primary="6,699% dos alimentos previstos no PAA" ... />
 */
export const renderPaaAlimentosTooltip = ({
  name,
  register,
  rampId,
}: {
  name: string;
  register?: PaaAlimentosByCity;
  rampId?: string;
}) => {
  if (register === undefined) {
    return (
      <TooltipCard
        name={name}
        swatchColor={colorForPaaAlimentos(null, rampId)}
        primary="Sem compra prevista no PAA"
      />
    );
  }

  return (
    <TooltipCard
      name={name}
      swatchColor={colorForPaaAlimentos(register.percentualDoBrasil, rampId)}
      primary={`${register.percentualDoBrasil.toLocaleString('pt-BR', {
        maximumFractionDigits: 3,
      })}% dos alimentos previstos no PAA`}
      secondary={`${formatToneladas(register.quantidadeKg)} (${register.quantidadeKg.toLocaleString('pt-BR')} kg)`}
      details={[
        `${formatContagem({ quantidade: register.produtos, singular: 'produto', plural: 'produtos' })} · ${formatContagem({ quantidade: register.fornecedores, singular: 'fornecedor', plural: 'fornecedores' })}`,
      ]}
    />
  );
};

/**
 * Tooltip do modo `coropletico-paa-kg-por-pessoa`. Destaca os kg previstos por
 * pessoa atendida com a cor da faixa do mapa, mostra as toneladas destinadas às
 * cozinhas do município e quantas pessoas e cozinhas as recebem. Municípios sem
 * cozinha recebedora (ou sem pessoas declaradas) leem "Sem cozinha recebedora
 * no PAA".
 *
 * @param params.name - Nome do município já resolvido.
 * @param params.register - Linha do município, ou `undefined` sem cozinha.
 * @param params.rampId - Rampa ativa, para o swatch bater com o mapa.
 * @returns O card do tooltip.
 *
 * @example
 * renderPaaKgPorPessoaTooltip({ name: 'Rio Branco', register });
 * // <TooltipCard primary="4,5 kg por pessoa atendida" ... />
 */
export const renderPaaKgPorPessoaTooltip = ({
  name,
  register,
  rampId,
}: {
  name: string;
  register?: PaaKgPorPessoaByCity;
  rampId?: string;
}) => {
  if (register === undefined || register.kgPorPessoa === null) {
    return (
      <TooltipCard
        name={name}
        swatchColor={colorForPaaKgPorPessoa(null, rampId)}
        primary="Sem cozinha recebedora no PAA"
      />
    );
  }

  return (
    <TooltipCard
      name={name}
      swatchColor={colorForPaaKgPorPessoa(register.kgPorPessoa, rampId)}
      primary={`${register.kgPorPessoa.toLocaleString('pt-BR')} kg por pessoa atendida`}
      secondary={`${formatToneladas(register.kgPrevistos)} para ${formatContagem({ quantidade: register.pessoasAtendidas, singular: 'pessoa', plural: 'pessoas' })}`}
      details={[
        formatContagem({
          quantidade: register.cozinhas,
          singular: 'cozinha recebedora',
          plural: 'cozinhas recebedoras',
        }),
      ]}
    />
  );
};
