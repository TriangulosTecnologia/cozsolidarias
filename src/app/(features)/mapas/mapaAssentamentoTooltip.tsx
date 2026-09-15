/**
 * Hover tooltip for the assentamentos mode.
 *
 * Titled by `cod_imovel` rather than a name: the SICAR source carries no
 * settlement name, so the registration code is the only stable identity the
 * cursor can report.
 */

import type { MapHoverInfo } from '@ttoss/geovis';
import type * as React from 'react';

import type { AssentamentoAtributo } from './geovisAssentamentos';
import {
  assentamentoStatusLabel,
  colorForAssentamentoStatus,
} from './geovisAssentamentosScales';
import { TooltipCard } from './mapaTooltipCard';

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
