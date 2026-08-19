import '@testing-library/jest-dom';

import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DatasetSummaryCard from 'src/app/(features)/dados/_components/DatasetSummaryCard';

import {
  describedDataset,
  referenceDataset,
  restrictedDataset,
} from './catalogueFixture';
import { renderWithChakra } from './renderWithChakra';

const noop = () => {};

describe('DatasetSummaryCard', () => {
  test('shows only the source, title, format and volume', () => {
    renderWithChakra(
      <DatasetSummaryCard dataset={describedDataset} onSelect={noop} />
    );

    expect(screen.getByText('SICAR')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 3, name: 'Assentamentos rurais' })
    ).toBeInTheDocument();
    expect(screen.getByText('GeoJSON')).toBeInTheDocument();
    expect(screen.getByText('1.825 feições')).toBeInTheDocument();

    // The detail belongs to the drawer, not the card.
    expect(screen.queryByText(/Perímetros dos assentamentos/)).toBeNull();
    expect(screen.queryByText('cod_imovel')).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
  });

  test('marks a restricted dataset', () => {
    renderWithChakra(
      <DatasetSummaryCard dataset={restrictedDataset} onSelect={noop} />
    );

    expect(screen.getByText('Restrito')).toBeInTheDocument();
    expect(screen.getByText('1.396 linhas')).toBeInTheDocument();
  });

  test('omits the volume badge when the catalogue records no count', () => {
    renderWithChakra(
      <DatasetSummaryCard
        dataset={{ ...referenceDataset, volume: null }}
        onSelect={noop}
      />
    );

    expect(screen.getByText('JSON')).toBeInTheDocument();
    expect(screen.queryByText(/entradas/)).toBeNull();
    expect(screen.queryByText('Restrito')).toBeNull();
  });

  test('is a button that reports selection on click and on keyboard activation', async () => {
    const onSelect = jest.fn();
    const user = userEvent.setup();

    renderWithChakra(
      <DatasetSummaryCard dataset={describedDataset} onSelect={onSelect} />
    );

    const card = screen.getByRole('button');

    // Reachable and activatable without a pointer.
    await user.tab();
    expect(card).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledTimes(1);

    await user.click(card);
    expect(onSelect).toHaveBeenCalledTimes(2);
  });
});
