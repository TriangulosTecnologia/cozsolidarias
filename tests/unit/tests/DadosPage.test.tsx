import '@testing-library/jest-dom';

import { screen } from '@testing-library/react';
import DadosPage from 'src/app/(features)/dados/page';

import { renderWithChakra } from './renderWithChakra';

describe('DadosPage', () => {
  test('renders the real catalogue end to end, from JSON to data dictionaries', async () => {
    renderWithChakra(await DadosPage());

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Catálogo de Dados — Cozinhas Solidárias',
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'O que ainda não sabemos' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Vocabulário' })
    ).toBeInTheDocument();

    // One card and one dictionary per dataset in the catalogue.
    expect(screen.getAllByRole('article')).toHaveLength(12);
    expect(screen.getAllByRole('table')).toHaveLength(12);
    expect(
      screen.getByRole('heading', {
        level: 4,
        name: 'Cozinhas Solidárias geolocalizadas',
      })
    ).toBeInTheDocument();
    expect(screen.getByText('Contém dados pessoais')).toBeInTheDocument();
  });

  test('never renders an origin URL, repository path or checksum', async () => {
    const { container } = renderWithChakra(await DadosPage());

    const markup = container.innerHTML;
    for (const secret of [
      'docs.google.com',
      '1fEt1zRYwajWPqRGDXsHnUoHtEktxKeDC',
      'servicodados.ibge.gov.br',
      'aplicacoes.mds.gov.br',
      'consulta.car.gov.br',
      'sha256',
      'src/data-source-static/data',
      'public/geo',
      'scripts/generate',
    ]) {
      expect(markup).not.toContain(secret);
    }
  });
});
