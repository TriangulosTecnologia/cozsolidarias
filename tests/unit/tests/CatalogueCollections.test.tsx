import '@testing-library/jest-dom';

import { screen } from '@testing-library/react';
import CatalogueCollections from 'src/app/(features)/dados/_components/CatalogueCollections';

import { buildCatalogue } from './catalogueFixture';
import { renderWithChakra } from './renderWithChakra';

describe('CatalogueCollections', () => {
  test('renders each source with its publisher, description and tags', () => {
    renderWithChakra(
      <CatalogueCollections collections={buildCatalogue().collections} />
    );

    expect(
      screen.getByRole('heading', {
        level: 2,
        name: 'Cada dataset e o que se sabe sobre ele',
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 3, name: 'Dados Primários' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 3, name: 'SICAR' })
    ).toBeInTheDocument();
    expect(
      screen.getByText('Datasets coletados pela equipe do projeto.')
    ).toBeInTheDocument();
    expect(screen.getByText('dados-primarios')).toBeInTheDocument();
  });

  test('renders an anchor index linking to every source', () => {
    renderWithChakra(
      <CatalogueCollections collections={buildCatalogue().collections} />
    );

    const index = screen.getByRole('navigation', {
      name: 'Índice de fontes',
    });
    expect(index).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Dados Primários 1' })
    ).toHaveAttribute('href', '#dados-primarios');
    expect(screen.getByRole('link', { name: 'SICAR 2' })).toHaveAttribute(
      'href',
      '#sicar'
    );
  });

  test('renders every dataset of every source', () => {
    renderWithChakra(
      <CatalogueCollections collections={buildCatalogue().collections} />
    );

    expect(screen.getAllByRole('article')).toHaveLength(3);
    expect(
      screen.getByRole('heading', {
        level: 4,
        name: 'Cozinhas Solidárias geolocalizadas',
      })
    ).toBeInTheDocument();
  });

  test('states explicitly when a source has no catalogued dataset', () => {
    const [collection] = buildCatalogue().collections;

    renderWithChakra(
      <CatalogueCollections collections={[{ ...collection, datasets: [] }]} />
    );

    expect(
      screen.getByText('Nenhum dataset desta fonte está catalogado ainda.')
    ).toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });
});
