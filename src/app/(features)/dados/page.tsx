import type { Metadata } from 'next';

import { gateway } from '../../../gateway';
import CatalogueCollections from './_components/CatalogueCollections';
import CatalogueGaps from './_components/CatalogueGaps';
import CatalogueHero from './_components/CatalogueHero';
import CatalogueLegend from './_components/CatalogueLegend';

export const metadata: Metadata = {
  title: 'Dados — Cozinha Solidária em Rede',
  description:
    'Catálogo de dados do projeto Cozinha Solidária em Rede: origem, cobertura temporal e territorial, volume, restrições de acesso e o dicionário de campos de cada dataset.',
  openGraph: {
    title: 'Dados — Cozinha Solidária em Rede',
    description: 'Nenhum dado sem contexto: origem, cobertura e limitações.',
    type: 'website',
  },
};

/**
 * The catalogue is hand-edited documentation, so the page is rendered per
 * request instead of at build time: editing `public/dataset_catalogue.json`
 * updates `/dados` with no code change and no rebuild. The read is a ~40 KB
 * local file, and the whole page is server-rendered with no client JavaScript,
 * so the cost of skipping the static cache is one file read per request.
 */
export const dynamic = 'force-dynamic';

/**
 * `/dados` page — the project's data catalogue. Everything on it is derived from
 * `public/dataset_catalogue.json`: the sections, counts, gaps and dictionaries
 * all follow the JSON, so adding a dataset there makes it appear here.
 *
 * Origin URLs, repository paths and file checksums never reach this page — the
 * gateway contract has no field for them.
 *
 * @example
 * // Rendered at /dados
 * <DadosPage />
 */
export default async function DadosPage() {
  const catalogue = await gateway.getCatalogue();

  return (
    <>
      <CatalogueHero meta={catalogue.meta} summary={catalogue.summary} />
      <CatalogueGaps
        notes={catalogue.meta.qualityNotes}
        gaps={catalogue.gaps}
      />
      <CatalogueCollections collections={catalogue.collections} />
      <CatalogueLegend />
    </>
  );
}
