import '@testing-library/jest-dom';

import { screen } from '@testing-library/react';
import { renderCafHexbinTooltip } from 'src/app/(features)/mapas/mapaCafHexbinTooltip';

import { renderWithChakra } from './renderWithChakra';

describe('renderCafHexbinTooltip', () => {
  test('shows the cell count with its unit and pt-BR grouping', () => {
    renderWithChakra(<>{renderCafHexbinTooltip({ quantidade: 25358 })}</>);

    expect(screen.getByText('Nº de CAFs')).toBeInTheDocument();
    expect(screen.getByText('25.358 CAFs')).toBeInTheDocument();
  });

  test('keeps the unit singular for a cell holding one', () => {
    renderWithChakra(<>{renderCafHexbinTooltip({ quantidade: 1 })}</>);

    expect(screen.getByText('1 CAF')).toBeInTheDocument();
  });

  test('reads a zero count as empty, like an unjoined cell', () => {
    renderWithChakra(<>{renderCafHexbinTooltip({ quantidade: 0 })}</>);

    expect(screen.getByText('Sem CAF')).toBeInTheDocument();
  });

  test('reports an unjoined cell as zero, not as missing data', () => {
    // Empty cells are left out of the `mapData` join on purpose, so the hover
    // value arrives `null`. The grid covers the whole territory, so `null` there
    // can only mean the cell caught nothing.
    renderWithChakra(<>{renderCafHexbinTooltip({ quantidade: null })}</>);

    expect(screen.getByText('Sem CAF')).toBeInTheDocument();
  });
});
