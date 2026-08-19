import '@testing-library/jest-dom';

import { screen } from '@testing-library/react';
import CatalogueHero from 'src/app/(features)/dados/_components/CatalogueHero';

import { buildCatalogue } from './catalogueFixture';
import { renderWithChakra } from './renderWithChakra';

describe('CatalogueHero', () => {
  test('renders the catalogue title, purpose and edition state', () => {
    renderWithChakra(<CatalogueHero meta={buildCatalogue().meta} />);

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Catálogo de Dados — Cozinhas Solidárias',
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText('Metadados de todos os datasets do projeto.')
    ).toBeInTheDocument();
    expect(screen.getByText('rascunho')).toBeInTheDocument();
    expect(
      screen.getByText('Atualizado em 14/08/2026 · esquema 2.0.0')
    ).toBeInTheDocument();
  });

  test('falls back to the raw status code when it is not a known stage', () => {
    const { meta } = buildCatalogue();

    renderWithChakra(
      <CatalogueHero meta={{ ...meta, status: 'sunsetting' }} />
    );

    expect(screen.getByText('sunsetting')).toBeInTheDocument();
  });
});
