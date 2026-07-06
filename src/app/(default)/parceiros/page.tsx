import type { Metadata } from 'next';

import type { Partner } from './_components/PartnerCard';
import PartnersIntro from './_components/PartnersIntro';
import PartnersSection from './_components/PartnersSection';

const INTERNAL_PARTNERS: Partner[] = [
  {
    name: 'Unifesp',
    description:
      'Universidade Federal de São Paulo — instituição de ensino e pesquisa pública federal à qual o projeto está vinculado.',
    logoSrc: '/images/partners/unifesp.png',
  },
  {
    name: 'INCT Combate à Fome',
    description:
      'Instituto Nacional de Ciência e Tecnologia dedicado à pesquisa e à ação contra a fome e a insegurança alimentar no Brasil.',
    logoSrc: '/images/partners/inctCombateFome.png',
  },
];

const EXTERNAL_PARTNERS: Partner[] = [
  {
    name: 'CNPq',
    description:
      'Conselho Nacional de Desenvolvimento Científico e Tecnológico — agência federal de fomento à pesquisa. Financiamento referente ao processo 406774/2022-6.',
    logoSrc: '/images/partners/cnpq.webp',
  },
  {
    name: 'FAPESP',
    description:
      'Fundação de Amparo à Pesquisa do Estado de São Paulo — agência estadual de fomento à pesquisa. Financiamento referente ao processo 2023/10095-0.',
    logoSrc: '/images/partners/fapesp.png',
  },
];

export const metadata: Metadata = {
  title: 'Parceiros — Cozinha Solidária em Rede',
  description:
    'Instituições, redes de pesquisa e agências de fomento que sustentam o projeto Cozinha Solidária em Rede.',
};

/**
 * `/parceiros` page — lists the institutions and funding agencies behind the
 * project, grouped as internal (institutional/research ties) and external
 * (funding agencies).
 *
 * @example
 * // Rendered at /parceiros
 * <ParceirosPage />
 */
export default function ParceirosPage() {
  return (
    <>
      <PartnersIntro />
      <PartnersSection
        id="internal-partners"
        eyebrow="Internos"
        title="Vínculo institucional"
        description="Instituições e redes de pesquisa às quais o projeto está diretamente vinculado."
        partners={INTERNAL_PARTNERS}
        bg="ivory.100"
      />
      <PartnersSection
        id="external-partners"
        eyebrow="Externos"
        title="Financiamento"
        description="Agências de fomento que financiam o desenvolvimento do projeto."
        partners={EXTERNAL_PARTNERS}
        bg="ivory.50"
      />
    </>
  );
}
