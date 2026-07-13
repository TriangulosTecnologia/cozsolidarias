import '@testing-library/jest-dom';

import { screen } from '@testing-library/react';
import {
  renderFillTooltip,
  renderStatusTooltip,
  toHoverTooltip,
  TooltipCard,
} from 'src/app/(features)/mapas/mapaTooltips';
import type { kitchenRateByCity } from 'src/data-gateway/schema';

import { renderWithChakra } from './renderWithChakra';

describe('toHoverTooltip', () => {
  test('wraps a render callback with the shared card style', () => {
    const render = () => {
      return null;
    };
    const config = toHoverTooltip(render);

    expect(config?.render).toBe(render);
    expect(config?.style).toBeDefined();
  });

  test('returns undefined when no render callback is given', () => {
    expect(toHoverTooltip(undefined)).toBeUndefined();
  });
});

const REGISTER: kitchenRateByCity = {
  codigoIbge: '3550308',
  municipio: 'São Paulo',
  quantidade: 5,
  populacao: 100_000,
  porCemMil: 5,
  percentualDoBrasil: 71.43,
  pessoasCadUnico: 50_000,
  porDezMilCadUnico: 1,
  pessoasPorCozinha: 10_000,
};

describe('TooltipCard', () => {
  test('renders name, primary and secondary lines', () => {
    renderWithChakra(
      <TooltipCard
        name="São Paulo"
        swatchColor="#000"
        primary="5 cozinhas"
        secondary="100.000 hab."
      />
    );

    expect(screen.getByText('São Paulo')).toBeInTheDocument();
    expect(screen.getByText('5 cozinhas')).toBeInTheDocument();
    expect(screen.getByText('100.000 hab.')).toBeInTheDocument();
  });

  test('omits the secondary line when not provided', () => {
    renderWithChakra(
      <TooltipCard name="São Paulo" swatchColor="#000" primary="5 cozinhas" />
    );

    expect(screen.queryByText('100.000 hab.')).not.toBeInTheDocument();
  });
});

describe('renderFillTooltip', () => {
  test('coropletico falls back to the raw count from the feature-state value', () => {
    renderWithChakra(
      <>
        {renderFillTooltip({
          mode: 'coropletico',
          name: 'São Paulo',
          register: REGISTER,
          value: 5,
        })}
      </>
    );

    expect(screen.getByText('5 cozinhas')).toBeInTheDocument();
  });

  test('coropletico with no data reads as "Sem cozinha registrada"', () => {
    renderWithChakra(
      <>
        {renderFillTooltip({
          mode: 'coropletico',
          name: 'Beta',
          register: undefined,
          value: null,
        })}
      </>
    );

    expect(screen.getByText('Sem cozinha registrada')).toBeInTheDocument();
  });

  test('coropletico-taxa renders the rate and population', () => {
    renderWithChakra(
      <>
        {renderFillTooltip({
          mode: 'coropletico-taxa',
          name: 'São Paulo',
          register: REGISTER,
          value: null,
        })}
      </>
    );

    expect(screen.getByText('5 por 100 mil hab.')).toBeInTheDocument();
  });

  test('coropletico-percentual renders the share', () => {
    renderWithChakra(
      <>
        {renderFillTooltip({
          mode: 'coropletico-percentual',
          name: 'São Paulo',
          register: REGISTER,
          value: null,
        })}
      </>
    );

    expect(
      screen.getByText('71,43% das cozinhas do Brasil')
    ).toBeInTheDocument();
  });

  test('coropletico-cadunico renders the CadÚnico rate', () => {
    renderWithChakra(
      <>
        {renderFillTooltip({
          mode: 'coropletico-cadunico',
          name: 'São Paulo',
          register: REGISTER,
          value: null,
        })}
      </>
    );

    expect(screen.getByText('1 por 10 mil no CadÚnico')).toBeInTheDocument();
  });

  test('coropletico-pessoas-cozinha renders the coverage ratio', () => {
    renderWithChakra(
      <>
        {renderFillTooltip({
          mode: 'coropletico-pessoas-cozinha',
          name: 'São Paulo',
          register: REGISTER,
          value: null,
        })}
      </>
    );

    expect(screen.getByText('10.000 pessoas por cozinha')).toBeInTheDocument();
  });

  test.each([
    ['coropletico-ivs', 'IVS'],
    ['coropletico-ivs-infraestrutura', 'Infraestrutura urbana'],
    ['coropletico-ivs-capital-humano', 'Capital humano'],
    ['coropletico-ivs-renda-trabalho', 'Renda e trabalho'],
  ] as const)('%s renders its faixa label with the score', (mode, label) => {
    renderWithChakra(
      <>
        {renderFillTooltip({
          mode,
          name: 'São Paulo',
          register: REGISTER,
          value: 0.15,
        })}
      </>
    );

    expect(
      screen.getByText(`${label} 0,150 · Muito baixa`)
    ).toBeInTheDocument();
  });

  test('coropletico-ivs with no value reads as "Sem dado de IVS"', () => {
    renderWithChakra(
      <>
        {renderFillTooltip({
          mode: 'coropletico-ivs',
          name: 'Beta',
          register: undefined,
          value: null,
        })}
      </>
    );

    expect(screen.getByText('Sem dado de IVS')).toBeInTheDocument();
  });

  test('pontos and circulos also fall back to the raw count, without a color swatch', () => {
    const { container } = renderWithChakra(
      <>
        {renderFillTooltip({
          mode: 'circulos',
          name: 'São Paulo',
          register: REGISTER,
          value: null,
        })}
      </>
    );

    expect(screen.getByText('5 cozinhas')).toBeInTheDocument();
    expect(
      container.querySelector('[data-testid="tooltip-swatch"]')
    ).toBeNull();
  });

  test('coropletico keeps the color swatch', () => {
    const { container } = renderWithChakra(
      <>
        {renderFillTooltip({
          mode: 'coropletico',
          name: 'São Paulo',
          register: REGISTER,
          value: 5,
        })}
      </>
    );

    expect(screen.getByText('5 cozinhas')).toBeInTheDocument();
    expect(
      container.querySelector('[data-testid="tooltip-swatch"]')
    ).not.toBeNull();
  });
});

describe('renderStatusTooltip', () => {
  test('renders the cozinha name and its status', () => {
    renderWithChakra(
      <>
        {renderStatusTooltip({
          code: 'CS1',
          register: { nome: 'Cozinha A', situacao: 'Habilitada' },
        })}
      </>
    );

    expect(screen.getByText('Cozinha A')).toBeInTheDocument();
    expect(screen.getByText('Habilitada')).toBeInTheDocument();
  });

  test('falls back to the code and "Situação desconhecida" when unregistered', () => {
    renderWithChakra(<>{renderStatusTooltip({ code: 'CS9' })}</>);

    expect(screen.getByText('Cozinha CS9')).toBeInTheDocument();
    expect(screen.getByText('Situação desconhecida')).toBeInTheDocument();
  });
});
