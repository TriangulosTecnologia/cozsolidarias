import '@testing-library/jest-dom';

import { screen } from '@testing-library/react';
import type {
  AssentamentoAtributo,
  MapMode,
} from 'src/app/(features)/mapas/geovisSpec';
import {
  renderAssentamentoTooltip,
  renderMunicipioTooltip,
} from 'src/app/(features)/mapas/mapaTooltips';
import type { kitchenRateByCity } from 'src/data-gateway/schema';

import { renderWithChakra } from './renderWithChakra';

const REGISTER: kitchenRateByCity = {
  codigoIbge: '3550308',
  municipio: 'São Paulo',
  quantidade: 5,
  populacao: 11_451_999,
  porCemMil: 0.04,
  percentualDoBrasil: 12.5,
  pessoasCadUnico: 3_884_884,
  porDezMilCadUnico: 0.01,
  pessoasPorCozinha: 776_977,
};

/** Renders a tooltip for the given mode/register into the DOM under Chakra. */
const renderTooltip = (args: {
  mode: MapMode;
  register?: kitchenRateByCity;
  value?: number | null;
}) => {
  return renderWithChakra(
    <>
      {renderMunicipioTooltip({
        mode: args.mode,
        name: 'São Paulo',
        register: args.register,
        value: args.value ?? null,
      })}
    </>
  );
};

describe('renderMunicipioTooltip', () => {
  test('count mode shows the painted feature-state value over the joined count', () => {
    renderTooltip({ mode: 'coropletico', register: REGISTER, value: 7 });

    expect(screen.getByText('São Paulo')).toBeInTheDocument();
    expect(screen.getByText('7 cozinhas')).toBeInTheDocument();
  });

  test('count mode falls back to the joined count when there is no feature-state value', () => {
    renderTooltip({ mode: 'coropletico', register: REGISTER, value: null });

    expect(screen.getByText('5 cozinhas')).toBeInTheDocument();
  });

  test('count mode reads "sem cozinha" for a zero count', () => {
    renderTooltip({ mode: 'coropletico', register: undefined, value: 0 });

    expect(screen.getByText('Sem cozinha registrada')).toBeInTheDocument();
  });

  test('rate mode shows the per-100k rate and the auxiliary population line', () => {
    renderTooltip({ mode: 'coropletico-taxa', register: REGISTER });

    expect(screen.getByText(/por 100 mil hab\./)).toBeInTheDocument();
    // Auxiliary line (only the secondary line carries the "cozinhas ·" prefix).
    expect(screen.getByText(/cozinhas ·.*hab\./)).toBeInTheDocument();
  });

  test('rate mode reads "sem cozinha" and drops the auxiliary line without data', () => {
    renderTooltip({ mode: 'coropletico-taxa', register: undefined });

    expect(screen.getByText('Sem cozinha registrada')).toBeInTheDocument();
    expect(screen.queryByText(/cozinhas ·/)).not.toBeInTheDocument();
  });

  test('share mode shows the % of Brazil', () => {
    renderTooltip({ mode: 'coropletico-percentual', register: REGISTER });

    expect(screen.getByText(/% das cozinhas do Brasil/)).toBeInTheDocument();
  });

  test('share mode reads "sem cozinha" for a zero share', () => {
    renderTooltip({ mode: 'coropletico-percentual', register: undefined });

    expect(screen.getByText('Sem cozinha registrada')).toBeInTheDocument();
  });

  test('CadÚnico mode shows the per-10k-CadÚnico rate', () => {
    renderTooltip({ mode: 'coropletico-cadunico', register: REGISTER });

    expect(screen.getByText(/por 10 mil no CadÚnico/)).toBeInTheDocument();
    // Auxiliary line (only the secondary line carries the "cozinhas ·" prefix).
    expect(screen.getByText(/cozinhas ·.*no CadÚnico/)).toBeInTheDocument();
  });

  test('CadÚnico mode reads "sem cozinha" without data', () => {
    renderTooltip({ mode: 'coropletico-cadunico', register: undefined });

    expect(screen.getByText('Sem cozinha registrada')).toBeInTheDocument();
  });

  test('coverage mode shows the people-per-cozinha value', () => {
    renderTooltip({ mode: 'coropletico-pessoas-cozinha', register: REGISTER });

    expect(screen.getByText(/pessoas por cozinha/)).toBeInTheDocument();
  });

  test('coverage mode reads "sem cozinha" without data', () => {
    renderTooltip({ mode: 'coropletico-pessoas-cozinha', register: undefined });

    expect(screen.getByText('Sem cozinha registrada')).toBeInTheDocument();
  });

  test('IVS mode shows the score and its faixa', () => {
    renderTooltip({ mode: 'coropletico-ivs', value: 0.15 });

    expect(screen.getByText(/IVS 0,150 · Muito baixa/)).toBeInTheDocument();
  });

  test.each([
    {
      mode: 'coropletico-ivs-infraestrutura' as const,
      label: 'Infraestrutura urbana',
    },
    {
      mode: 'coropletico-ivs-capital-humano' as const,
      label: 'Capital humano',
    },
    {
      mode: 'coropletico-ivs-renda-trabalho' as const,
      label: 'Renda e trabalho',
    },
  ])('$mode labels the sub-index and its faixa', ({ mode, label }) => {
    renderTooltip({ mode, value: 0.6 });

    expect(
      screen.getByText(new RegExp(`${label} 0,600 · Muito alta`))
    ).toBeInTheDocument();
  });

  test('IVS-family mode reads "sem dado" without a joined value', () => {
    renderTooltip({ mode: 'coropletico-ivs-capital-humano', value: null });

    expect(screen.getByText('Sem dado de Capital humano')).toBeInTheDocument();
  });
});

const ATRIBUTO: AssentamentoAtributo = {
  codImovel: 'SP-1-AAA',
  municipio: 'Alpha',
  areaHa: 274.3,
  status: 'AT',
  condicao: 'Aguardando analise',
};

describe('renderAssentamentoTooltip', () => {
  test('shows the município, the painted status and the area/condition line', () => {
    renderWithChakra(
      <>{renderAssentamentoTooltip({ atributo: ATRIBUTO, value: 'Ativo' })}</>
    );

    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Situação: Ativo')).toBeInTheDocument();
    expect(
      screen.getByText(/274,3 ha · Aguardando analise/)
    ).toBeInTheDocument();
  });

  test('derives the status label from the attribute when no feature-state value', () => {
    renderWithChakra(
      <>{renderAssentamentoTooltip({ atributo: ATRIBUTO, value: null })}</>
    );

    expect(screen.getByText('Situação: Ativo')).toBeInTheDocument();
  });

  test('falls back to a generic name and unknown status without an attribute', () => {
    renderWithChakra(
      <>{renderAssentamentoTooltip({ atributo: undefined, value: null })}</>
    );

    expect(screen.getByText('Assentamento')).toBeInTheDocument();
    expect(screen.getByText('Situação desconhecida')).toBeInTheDocument();
  });
});
