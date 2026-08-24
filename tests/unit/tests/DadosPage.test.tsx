import '@testing-library/jest-dom';

import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DadosPage from 'src/app/(features)/dados/page';
import { readStaticDataCatalogue } from 'src/data-source-static/readStaticDataCatalogue';

import { renderWithChakra } from './renderWithChakra';

/**
 * The three behaviours `/dados` has to guarantee, exercised end to end over the
 * real `public/dataset_catalogue.json` rather than a fixture — the page being
 * driven by that file is itself one of them.
 *
 * The presentational components are covered through this page (see
 * `coveragePathIgnorePatterns` in the Jest config), so these cases assert what
 * the reader must see, not how each component composes it.
 */
describe('DadosPage', () => {
  test('never renders an origin URL, repository path or checksum', async () => {
    const user = userEvent.setup();
    renderWithChakra(await DadosPage());

    // Open the one restricted dataset: its origin is an internal spreadsheet
    // holding the personal data of every kitchen, so it is the worst case.
    await user.click(
      screen.getByRole('button', {
        name: /Cozinhas Solidárias geolocalizadas/,
      })
    );
    await screen.findByRole('dialog');

    // The whole document, because the drawer renders into a portal.
    const markup = document.body.innerHTML;
    for (const secret of [
      'docs.google.com',
      '1fEt1zRYwajWPqRGDXsHnUoHtEktxKeDC',
      'servicodados.ibge.gov.br',
      'aplicacoes.mds.gov.br',
      'consulta.car.gov.br',
      'ivs.ipea.gov.br',
      'sha256',
      'src/data-source-static/data',
      'public/geo',
      'scripts/generate',
    ]) {
      expect(markup).not.toContain(secret);
    }
  });

  test('renders one card per dataset in the catalogue file, with its identity', async () => {
    const catalogue = await readStaticDataCatalogue();
    const titles = Object.values(catalogue.datasets).map((dataset) => {
      return dataset.title;
    });

    renderWithChakra(await DadosPage());

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: catalogue.catalog.title,
      })
    ).toBeInTheDocument();
    // Every dataset the file declares gets a card — nothing hardcoded, nothing
    // dropped. Editing the catalogue changes this page with no code change.
    expect(screen.getAllByRole('button')).toHaveLength(titles.length);
    for (const title of titles) {
      expect(
        screen.getByRole('heading', { level: 3, name: title })
      ).toBeInTheDocument();
    }
    // The detail — including every data dictionary — stays out of the document
    // until a card is opened.
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  test('opens a dataset detail with its data dictionary, and closes it again', async () => {
    const user = userEvent.setup();
    renderWithChakra(await DadosPage());

    await user.click(
      screen.getByRole('button', {
        name: /Cozinhas Solidárias geolocalizadas/,
      })
    );

    // Scope to the drawer: the card behind it repeats the format and volume.
    const detail = within(await screen.findByRole('dialog'));
    expect(detail.getByText('Contém dados pessoais')).toBeInTheDocument();
    expect(detail.getByRole('table')).toBeInTheDocument();
    // The dictionary publishes the column names of a dataset carrying personal
    // data, marking the sensitive ones — never their values.
    expect(detail.getByText('CNPJ')).toBeInTheDocument();
    expect(detail.getAllByText('dado sensível')).toHaveLength(6);
    // Coverage and provenance translated out of the catalogue's vocabulary.
    expect(detail.getByText('1.396 linhas')).toBeInTheDocument();
    expect(detail.getByText('cozinha · cobertura parcial')).toBeInTheDocument();

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    // Reopening works, so dismissal clears the selection rather than wedging it.
    await user.click(
      screen.getByRole('button', { name: /Assentamentos rurais/ })
    );
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });
});
