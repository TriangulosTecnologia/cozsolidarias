import '@testing-library/jest-dom';

import { screen } from '@testing-library/react';
import DatasetGrid from 'src/app/(features)/dados/_components/DatasetGrid';

import { renderWithChakra } from './renderWithChakra';

/**
 * The grid's populated path — cards, drawer and dismissal — is covered end to
 * end by `DadosPage.test.tsx` over the real catalogue. Only the empty state
 * lives here, because a catalogue with no dataset is the one shape that file
 * cannot produce.
 */
describe('DatasetGrid', () => {
  test('states explicitly when nothing is catalogued', () => {
    renderWithChakra(<DatasetGrid datasets={[]} />);

    expect(
      screen.getByText('Nenhum dataset está catalogado ainda.')
    ).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
