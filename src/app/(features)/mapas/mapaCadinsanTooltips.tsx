/**
 * The CADINSAN family's hover card: the food-insecurity share under the active
 * scenario, and the line comparing it with the opposite one.
 *
 * Its own module for the reason the score and assentamento cards have theirs —
 * a family whose copy is about one indicator, kept out of the dispatcher that
 * only has to know which family a mode belongs to.
 */

import type { cadinsanByCity } from '@/data-gateway/schema';

import { colorForCadinsan } from './geovisChoroplethScales';
import { TooltipCard } from './mapaTooltipCard';

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
export const renderCadinsanTooltip = ({
  name,
  register,
  variant,
  rampId,
}: {
  name: string;
  register?: cadinsanByCity;
  variant: 'com' | 'sem';
  rampId?: string;
}) => {
  const semDado = (
    <TooltipCard
      name={name}
      swatchColor={colorForCadinsan(null, rampId)}
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
      swatchColor={colorForCadinsan(activeProporcao, rampId)}
      primary={`${formatPercent(activeProporcao)} em insegurança alimentar (${qualifier})`}
      secondary={`${formatFamilias(activeAbsoluto)} de ${formatFamilias(register.cadastrosCadunico)} famílias do CadÚnico neste cenário`}
      details={effect === undefined ? undefined : [effect]}
    />
  );
};
