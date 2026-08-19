import '@testing-library/jest-dom';

import { screen } from '@testing-library/react';
import CatalogueBadge from 'src/app/(features)/dados/_components/CatalogueBadge';

import { renderWithChakra } from './renderWithChakra';

describe('CatalogueBadge', () => {
  test('renders its label with the default neutral tone', () => {
    renderWithChakra(<CatalogueBadge>CSV</CatalogueBadge>);

    expect(screen.getByText('CSV')).toBeInTheDocument();
  });

  test.each(['neutral', 'positive', 'alert'] as const)(
    'renders the %s tone',
    (tone) => {
      renderWithChakra(<CatalogueBadge tone={tone}>Restrito</CatalogueBadge>);

      expect(screen.getByText('Restrito')).toBeInTheDocument();
    }
  );
});
