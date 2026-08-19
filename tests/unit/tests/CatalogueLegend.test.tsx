import '@testing-library/jest-dom';

import { screen } from '@testing-library/react';
import CatalogueLegend from 'src/app/(features)/dados/_components/CatalogueLegend';

import { renderWithChakra } from './renderWithChakra';

describe('CatalogueLegend', () => {
  test('renders a group per vocabulary used by the dataset cards', () => {
    renderWithChakra(<CatalogueLegend />);

    expect(
      screen.getByRole('heading', { level: 2, name: 'Vocabulário' })
    ).toBeInTheDocument();
    for (const group of [
      'Histórico',
      'Cobertura',
      'Precisão',
      'Granularidade',
    ]) {
      expect(
        screen.getByRole('heading', { level: 3, name: group })
      ).toBeInTheDocument();
    }
  });

  test('defines the terms using the same wording the cards render', () => {
    renderWithChakra(<CatalogueLegend />);

    expect(
      screen.getByText('série acumulada — o passado não é reescrito')
    ).toBeInTheDocument();
    expect(
      screen.getByText('cada versão substitui a anterior')
    ).toBeInTheDocument();
    expect(screen.getByText('um registro por ano')).toBeInTheDocument();
    expect(
      screen.getByText('coordenadas em latitude/longitude (WGS 84)')
    ).toBeInTheDocument();
  });
});
