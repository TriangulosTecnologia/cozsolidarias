import '@testing-library/jest-dom';

import { screen } from '@testing-library/react';
import CatalogueGaps from 'src/app/(features)/dados/_components/CatalogueGaps';

import { buildCatalogue } from './catalogueFixture';
import { renderWithChakra } from './renderWithChakra';

describe('CatalogueGaps', () => {
  test('renders authored caveats with their severity', () => {
    const catalogue = buildCatalogue();

    renderWithChakra(
      <CatalogueGaps
        notes={catalogue.meta.qualityNotes}
        gaps={catalogue.gaps}
      />
    );

    expect(
      screen.getByRole('heading', { level: 2, name: 'O que ainda não sabemos' })
    ).toBeInTheDocument();
    expect(screen.getByText('Ressalva · severidade baixa')).toBeInTheDocument();
    expect(
      screen.getByText('As URLs de origem precisam ser confirmadas.')
    ).toBeInTheDocument();
  });

  test('groups derived gaps by kind and lists the datasets each affects', () => {
    const catalogue = buildCatalogue();

    renderWithChakra(
      <CatalogueGaps
        notes={catalogue.meta.qualityNotes}
        gaps={catalogue.gaps}
      />
    );

    // Two datasets share no gap kind here, so every group reads "1 dataset".
    expect(
      screen.getByText('Cobertura temporal não documentada — 1 dataset')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Precisão das coordenadas não documentada — 1 dataset')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Origem sem endereço registrado — 1 dataset')
    ).toBeInTheDocument();
    expect(
      screen.getAllByText('Cozinhas Solidárias geolocalizadas').length
    ).toBeGreaterThan(0);
  });

  test('pluralizes and joins when one kind affects several datasets', () => {
    renderWithChakra(
      <CatalogueGaps
        notes={[]}
        gaps={[
          {
            datasetId: 'a',
            datasetTitle: 'Áreas CAF',
            collectionSlug: 'mda',
            kind: 'temporalUnknown',
          },
          {
            datasetId: 'b',
            datasetTitle: 'Produção CAF',
            collectionSlug: 'mda',
            kind: 'temporalUnknown',
          },
        ]}
      />
    );

    expect(
      screen.getByText('Cobertura temporal não documentada — 2 datasets')
    ).toBeInTheDocument();
    expect(screen.getByText('Áreas CAF · Produção CAF')).toBeInTheDocument();
  });

  test('states explicitly when nothing is missing', () => {
    renderWithChakra(<CatalogueGaps notes={[]} gaps={[]} />);

    expect(
      screen.getByText(
        'Todos os datasets declaram cobertura, origem e precisão, e o catálogo não registra ressalvas de qualidade.'
      )
    ).toBeInTheDocument();
  });
});
