import '@testing-library/jest-dom';

import { screen } from '@testing-library/react';
import PartnerCard from 'src/app/(default)/parceiros/_components/PartnerCard';

import { renderWithChakra } from './renderWithChakra';

describe('PartnerCard', () => {
  test('renders the partner name, description, and logo alt text', () => {
    renderWithChakra(
      <PartnerCard
        partner={{
          name: 'CNPq',
          description: 'Agência federal de fomento à pesquisa.',
          logoSrc: '/images/partners/cnpq.webp',
        }}
      />
    );

    expect(screen.getByText('CNPq')).toBeInTheDocument();
    expect(
      screen.getByText('Agência federal de fomento à pesquisa.')
    ).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'CNPq' })).toBeInTheDocument();
  });
});
