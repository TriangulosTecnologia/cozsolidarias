import '@testing-library/jest-dom';

import { screen } from '@testing-library/react';
import { TooltipCard } from 'src/app/(features)/mapas/mapaTooltipCard';

import { renderWithChakra } from './renderWithChakra';

describe('TooltipCard', () => {
  test('renders the title and the primary label', () => {
    renderWithChakra(
      <>{TooltipCard({ name: 'São Paulo', primary: '5 cozinhas' })}</>
    );

    expect(screen.getByText('São Paulo')).toBeInTheDocument();
    expect(screen.getByText('5 cozinhas')).toBeInTheDocument();
  });

  test('renders the optional secondary line and detail lines', () => {
    renderWithChakra(
      <>
        {TooltipCard({
          name: 'Alpha',
          primary: 'primary line',
          secondary: 'secondary line',
          details: ['detail A', 'detail B'],
        })}
      </>
    );

    expect(screen.getByText('secondary line')).toBeInTheDocument();
    expect(screen.getByText('detail A')).toBeInTheDocument();
    expect(screen.getByText('detail B')).toBeInTheDocument();
  });
});
