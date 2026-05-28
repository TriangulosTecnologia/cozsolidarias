import type { Metadata } from 'next';

import HomeAudiences from './_components/HomeAudiences';
import HomeCallToAction from './_components/HomeCallToAction';
import HomeCatalog from './_components/HomeCatalog';
import HomeContext from './_components/HomeContext';
import HomeFeatures from './_components/HomeFeatures';
import HomeHero from './_components/HomeHero';

export const metadata: Metadata = {
  title:
    'Cozinhas Solidárias — Territórios que alimentam. Dados que fortalecem.',
  description:
    'Plataforma de inteligência territorial para mapear, documentar e apoiar Cozinhas Solidárias no Brasil.',
};

/**
 * Homepage
 */
export default function Page() {
  return (
    <>
      <HomeHero />
      <HomeContext />
      <HomeFeatures />
      <HomeAudiences />
      <HomeCatalog />
      <HomeCallToAction />
    </>
  );
}
