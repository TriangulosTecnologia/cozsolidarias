import '@testing-library/jest-dom';

import { screen } from '@testing-library/react';
import MapLoadingIndicator from 'src/app/(features)/mapas/MapLoadingIndicator';

import { renderWithChakra } from './renderWithChakra';

describe('MapLoadingIndicator', () => {
  test('exposes a status region labelled "Carregando mapa"', () => {
    renderWithChakra(<MapLoadingIndicator />);

    expect(
      screen.getByRole('status', { name: 'Carregando mapa' })
    ).toBeInTheDocument();
  });

  test('renders the decorative brand mark', () => {
    const { container } = renderWithChakra(<MapLoadingIndicator />);

    const image = container.querySelector('img');
    expect(image).not.toBeNull();
    expect(image).toHaveAttribute('alt', '');
  });
});
