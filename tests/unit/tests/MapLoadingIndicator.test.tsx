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

  /*
   * The overlay covers a map that is on screen, so the caption cannot borrow
   * the page's background: it needs one of its own, or its contrast changes
   * with whatever choropleth class happens to be underneath.
   */
  test('draws the overlay variant on a surface of its own', () => {
    renderWithChakra(
      <MapLoadingIndicator variant="overlay" label="Atualizando o mapa" />
    );

    const status = screen.getByRole('status', { name: 'Atualizando o mapa' });

    expect(status).toBeInTheDocument();
    expect(status).toHaveTextContent('Atualizando o mapa…');
    // The scrim is what explains a map that has stopped answering drags.
    expect(status).toHaveStyle({
      backgroundColor: 'rgba(244, 240, 232, 0.72)',
    });
  });

  test('keeps the same mark in both variants', () => {
    const { container } = renderWithChakra(
      <MapLoadingIndicator variant="overlay" />
    );

    expect(container.querySelector('img')).toHaveAttribute('alt', '');
  });
});
