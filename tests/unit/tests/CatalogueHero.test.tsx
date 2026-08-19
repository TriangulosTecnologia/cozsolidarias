import '@testing-library/jest-dom';

import { screen } from '@testing-library/react';
import CatalogueHero from 'src/app/(features)/dados/_components/CatalogueHero';

import { buildCatalogue } from './catalogueFixture';
import { renderWithChakra } from './renderWithChakra';

describe('CatalogueHero', () => {
  test('renders the catalogue title, edition state and derived counters', () => {
    const { meta, summary } = buildCatalogue();

    renderWithChakra(<CatalogueHero meta={meta} summary={summary} />);

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

    expect(screen.getByText('datasets')).toBeInTheDocument();
    expect(screen.getByText('fontes')).toBeInTheDocument();
    expect(screen.getByText('campos documentados')).toBeInTheDocument();
    expect(screen.getByText('campos sensíveis')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Formatos: CSV · GeoJSON · JSON · Acesso restrito em 1 de 3 datasets.'
      )
    ).toBeInTheDocument();
  });

  test('formats large counts with pt-BR thousands separators', () => {
    const { meta, summary } = buildCatalogue();

    renderWithChakra(
      <CatalogueHero
        meta={meta}
        summary={{ ...summary, fieldCount: 1089, datasetCount: 1200 }}
      />
    );

    expect(screen.getByText('1.089')).toBeInTheDocument();
    expect(screen.getByText('1.200')).toBeInTheDocument();
  });
});
