import '@testing-library/jest-dom';

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DatasetGrid from 'src/app/(features)/dados/_components/DatasetGrid';

import { buildCatalogue } from './catalogueFixture';
import { renderWithChakra } from './renderWithChakra';

describe('DatasetGrid', () => {
  test('renders one compact card per dataset and no detail up front', () => {
    renderWithChakra(<DatasetGrid datasets={buildCatalogue().datasets} />);

    expect(
      screen.getByRole('heading', { level: 2, name: 'Datasets' })
    ).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(3);

    // No dictionary and no drawer are mounted until a card is opened.
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  test('opens the drawer with the selected dataset detail', async () => {
    const user = userEvent.setup();
    renderWithChakra(<DatasetGrid datasets={buildCatalogue().datasets} />);

    await user.click(
      screen.getByRole('button', {
        name: /Cozinhas Solidárias geolocalizadas/,
      })
    );

    const drawer = await screen.findByRole('dialog');
    expect(drawer).toBeInTheDocument();
    expect(
      screen.getByText('Cadastro das cozinhas solidárias com coordenadas.')
    ).toBeInTheDocument();
    expect(screen.getByText('Contém dados pessoais')).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('dado sensível')).toBeInTheDocument();
  });

  test('mounts only the selected dataset detail, not every dataset', async () => {
    const user = userEvent.setup();
    renderWithChakra(<DatasetGrid datasets={buildCatalogue().datasets} />);

    await user.click(
      screen.getByRole('button', { name: /Assentamentos rurais/ })
    );

    await screen.findByRole('dialog');
    expect(screen.getByText('Fonte · SICAR')).toBeInTheDocument();
    // The other datasets' details stay unmounted.
    expect(screen.queryByText('Fonte · IBGE')).toBeNull();
    expect(screen.getAllByRole('table')).toHaveLength(1);
  });

  test('closes the drawer with the close button', async () => {
    const user = userEvent.setup();
    renderWithChakra(<DatasetGrid datasets={buildCatalogue().datasets} />);

    await user.click(
      screen.getByRole('button', { name: /Assentamentos rurais/ })
    );
    await screen.findByRole('dialog');

    await user.click(screen.getByRole('button', { name: 'Fechar detalhes' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  test('closes the drawer with the Escape key', async () => {
    const user = userEvent.setup();
    renderWithChakra(<DatasetGrid datasets={buildCatalogue().datasets} />);

    await user.click(
      screen.getByRole('button', { name: /Nomes dos municípios/ })
    );
    await screen.findByRole('dialog');

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  test('states explicitly when nothing is catalogued', () => {
    renderWithChakra(<DatasetGrid datasets={[]} />);

    expect(
      screen.getByText('Nenhum dataset está catalogado ainda.')
    ).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
