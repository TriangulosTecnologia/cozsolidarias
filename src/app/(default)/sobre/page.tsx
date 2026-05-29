import type { Metadata } from 'next';

import AboutHero from './_components/AboutHero';
import CommitmentsSection from './_components/CommitmentsSection';
import FinalCTA from './_components/FinalCTA';
import LimitsSection from './_components/LimitsSection';
import MethodSection from './_components/MethodSection';
import PurposeSection from './_components/PurposeSection';
import RecognitionSection from './_components/RecognitionSection';

export const metadata: Metadata = {
  title: 'Sobre — Cozinha Solidária em Rede',
  description:
    'Conheça o projeto Cozinha Solidária em Rede: uma plataforma pública de inteligência territorial para organizar dados, fontes, mapas e evidências sobre cozinhas solidárias no Brasil.',
  openGraph: {
    title: 'Sobre — Cozinha Solidária em Rede',
    description: 'Dados, território e cuidado como infraestrutura pública.',
    type: 'website',
  },
};

/**
 * `/sobre` page — operational manifesto for the Cozinha Solidária em Rede platform.
 * Seven sections explain what the project is, why it exists, how it works,
 * what limits it assumes, and which commitments govern data use.
 *
 * @example
 * // Rendered at /sobre
 * <SobrePage />
 */
export default function SobrePage() {
  return (
    <>
      <AboutHero />
      <RecognitionSection />
      <PurposeSection />
      <MethodSection />
      <LimitsSection />
      <CommitmentsSection />
      <FinalCTA />
    </>
  );
}
