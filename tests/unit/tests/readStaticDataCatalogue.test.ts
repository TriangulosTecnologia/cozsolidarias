import { readStaticDataCatalogue } from 'src/data-source-static/readStaticDataCatalogue';

describe('readStaticDataCatalogue', () => {
  test('reads and validates the real catalogue from disk', async () => {
    const catalogue = await readStaticDataCatalogue();

    expect(catalogue.catalog.title).toBe(
      'Catálogo de Dados — Cozinhas Solidárias'
    );
    expect(catalogue.catalog.language).toBe('pt-BR');
    expect(Object.keys(catalogue.datasets)).toHaveLength(13);
    // Every dataset must belong to a declared collection.
    for (const dataset of Object.values(catalogue.datasets)) {
      expect(catalogue.collections[dataset.collection_id]).toBeDefined();
    }
  });

  test('re-reads the file on every call so a hand edit reaches the page', async () => {
    const first = await readStaticDataCatalogue();
    const second = await readStaticDataCatalogue();

    // Deliberately not memoized, unlike the other readStatic* readers: the
    // catalogue is documentation edited by hand, and each edit must take effect
    // without restarting the process.
    expect(second).not.toBe(first);
    expect(second).toEqual(first);
  });
});
