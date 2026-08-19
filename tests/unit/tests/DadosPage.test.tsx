import '@testing-library/jest-dom';

import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DadosPage from 'src/app/(features)/dados/page';

import { renderWithChakra } from './renderWithChakra';

describe('DadosPage', () => {
  test('renders the real catalogue as a compact grid, one card per dataset', async () => {
    renderWithChakra(await DadosPage());

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Catálogo de Dados — Cozinhas Solidárias',
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Datasets' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Vocabulário' })
    ).toBeInTheDocument();

    expect(screen.getAllByRole('button')).toHaveLength(12);
    // Detail — including every data dictionary — stays out of the initial page.
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  test('opens the full detail of a dataset from its card', async () => {
    const user = userEvent.setup();
    renderWithChakra(await DadosPage());

    await user.click(
      screen.getByRole('button', {
        name: /Cozinhas Solidárias geolocalizadas/,
      })
    );

    await screen.findByRole('dialog');
    expect(screen.getByText('Contém dados pessoais')).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    // The 18-field dictionary publishes the column names, marking the 6
    // sensitive ones — never their values.
    expect(screen.getAllByText('dado sensível')).toHaveLength(6);
    expect(screen.getByText('CNPJ')).toBeInTheDocument();
  });

  test('never renders an origin URL, repository path or checksum', async () => {
    const user = userEvent.setup();
    const { container } = renderWithChakra(await DadosPage());

    await user.click(
      screen.getByRole('button', {
        name: /Cozinhas Solidárias geolocalizadas/,
      })
    );
    await screen.findByRole('dialog');

    // Check the whole document: the drawer renders into a portal.
    const markup = container.innerHTML + document.body.innerHTML;
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
