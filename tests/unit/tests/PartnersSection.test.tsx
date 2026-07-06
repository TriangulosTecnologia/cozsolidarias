import '@testing-library/jest-dom';

import { screen } from '@testing-library/react';
import type { Partner } from 'src/app/(default)/parceiros/_components/PartnerCard';
import PartnersSection from 'src/app/(default)/parceiros/_components/PartnersSection';

import { renderWithChakra } from './renderWithChakra';

const PARTNERS: Partner[] = [
  { name: 'Unifesp', description: 'Instituição de ensino.', logoSrc: '/a.png' },
  {
    name: 'INCT Combate à Fome',
    description: 'Rede de pesquisa.',
    logoSrc: '/b.png',
  },
];

describe('PartnersSection', () => {
  test('renders the section heading, description, and every partner', () => {
    renderWithChakra(
      <PartnersSection
        id="internal-partners"
        eyebrow="Internos"
        title="Vínculo institucional"
        description="Instituições vinculadas ao projeto."
        partners={PARTNERS}
      />
    );

    expect(
      screen.getByRole('heading', { level: 2, name: 'Vínculo institucional' })
    ).toBeInTheDocument();
    expect(
      screen.getByText('Instituições vinculadas ao projeto.')
    ).toBeInTheDocument();
    expect(screen.getByText('Unifesp')).toBeInTheDocument();
    expect(screen.getByText('INCT Combate à Fome')).toBeInTheDocument();
  });
});
