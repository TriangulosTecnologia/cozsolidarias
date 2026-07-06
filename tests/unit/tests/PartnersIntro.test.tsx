import '@testing-library/jest-dom';

import { screen } from '@testing-library/react';
import PartnersIntro from 'src/app/(default)/parceiros/_components/PartnersIntro';

import { renderWithChakra } from './renderWithChakra';

describe('PartnersIntro', () => {
  test('renders the page title as an h1', () => {
    renderWithChakra(<PartnersIntro />);

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Instituições e agências que sustentam o projeto',
      })
    ).toBeInTheDocument();
  });
});
