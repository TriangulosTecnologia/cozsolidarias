import '@testing-library/jest-dom';

import { screen } from '@testing-library/react';
import ParceirosPage from 'src/app/(default)/parceiros/page';

import { renderWithChakra } from './renderWithChakra';

describe('ParceirosPage', () => {
  test('renders the page title and both partner categories', () => {
    renderWithChakra(<ParceirosPage />);

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Instituições e agências que sustentam o projeto',
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Vínculo institucional' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Financiamento' })
    ).toBeInTheDocument();
    expect(screen.getByText('Unifesp')).toBeInTheDocument();
    expect(screen.getByText('INCT Combate à Fome')).toBeInTheDocument();
    expect(screen.getByText('CNPq')).toBeInTheDocument();
    expect(screen.getByText('FAPESP')).toBeInTheDocument();
  });
});
