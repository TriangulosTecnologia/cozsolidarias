import { buildCatalogueContext } from 'src/app/api/ai/spec/mapDataCatalogue';

import { gateway } from '@/gateway';

type CatalogEntry = { id: string; fields?: unknown[] };

const entriesOf = (text: string): CatalogEntry[] => {
  return (JSON.parse(text) as { catalogue: { datasets: CatalogEntry[] } })
    .catalogue.datasets;
};

describe('buildCatalogueContext focus', () => {
  test('keeps the full detail of every dataset when no family is focused', async () => {
    const entries = entriesOf(
      buildCatalogueContext(await gateway.getCatalogue())
    );
    const ivs = entries.find((entry) => {
      return entry.id === 'municipios_ivs';
    });

    expect(ivs?.fields).toBeDefined();
  });

  test('reduces every dataset outside the focused family to its index entry', async () => {
    const entries = entriesOf(
      buildCatalogueContext(await gateway.getCatalogue(), 'cozinhas')
    );
    const ivs = entries.find((entry) => {
      return entry.id === 'municipios_ivs';
    });
    const cozinhas = entries.find((entry) => {
      return entry.id === 'cozinhas_geolocalizadas';
    });

    expect(ivs).not.toHaveProperty('fields');
    expect(cozinhas?.fields).toBeDefined();
  });
});
