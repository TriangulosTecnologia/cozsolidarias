import { toAppCatalogue } from 'src/data-gateway/transformers/toAppCatalogue';
import type { DataCatalogue } from 'src/data-source-static/dataCatalogue';
import { readStaticDataCatalogue } from 'src/data-source-static/readStaticDataCatalogue';

/** Source-native catalogue with one collection and one dataset to vary. */
const buildSource = ({
  dataset = {},
  collectionId = 'ibge',
}: {
  dataset?: Record<string, unknown>;
  collectionId?: string;
} = {}): DataCatalogue => {
  return {
    schema_version: '2.0.0',
    catalog: {
      id: 'catalog',
      title: 'Catálogo',
      description: 'Descrição',
      language: 'pt-BR',
      status: 'draft',
      created_at: '2026-07-07',
      updated_at: '2026-08-14',
      typing_reference: 'src/data-source-static/dataCatalogue.ts',
      quality_notes: [{ id: 'note', severity: 'low', message: 'Mensagem' }],
    },
    collections: {
      ibge: {
        id: 'ibge',
        slug: 'ibge',
        title: 'IBGE',
        description: 'Datasets do IBGE',
        organization: 'Instituto Brasileiro de Geografia e Estatística',
        source_url: 'https://www.ibge.gov.br',
        public_reference_url: 'https://servicodados.ibge.gov.br',
        tags: ['ibge'],
      },
    },
    datasets: {
      malhas: {
        id: 'malhas',
        collection_id: collectionId,
        slug: 'malhas',
        title: 'Malhas',
        description: 'Contornos',
        file: 'public/geo/malhas.json',
        format: 'GeoJSON',
        source: { url: 'https://servicodados.ibge.gov.br/api/v3/malhas/' },
        temporal: { status: 'not_applicable' },
        spatial: { status: 'unknown' },
        access: { level: 'public', contains_personal_data: false },
        schema: { fields: [{ name: 'codarea', description: 'Código' }] },
        ...dataset,
      },
    },
  };
};

describe('toAppCatalogue', () => {
  test('redacts origin URLs, repository paths and checksums from the real catalogue', async () => {
    const catalogue = toAppCatalogue(await readStaticDataCatalogue());

    // The contract has no field for any of these, so a component cannot leak
    // them — including the internal spreadsheet holding personal data.
    const serialized = JSON.stringify(catalogue);
    for (const secret of [
      'docs.google.com',
      '1fEt1zRYwajWPqRGDXsHnUoHtEktxKeDC',
      'servicodados.ibge.gov.br',
      'aplicacoes.mds.gov.br',
      'sha256:',
      'src/data-source-static/data',
      'public/geo',
      'scripts/generate',
      'typing_reference',
    ]) {
      expect(serialized).not.toContain(secret);
    }
  });

  test('derives the summary counts from the datasets themselves', async () => {
    const catalogue = toAppCatalogue(await readStaticDataCatalogue());

    const datasets = catalogue.collections.flatMap((collection) => {
      return collection.datasets;
    });
    expect(catalogue.summary.datasetCount).toBe(datasets.length);
    expect(catalogue.summary.collectionCount).toBe(
      catalogue.collections.length
    );
    expect(catalogue.summary.fieldCount).toBe(
      datasets.reduce((total, dataset) => {
        return total + dataset.fields.length;
      }, 0)
    );
    expect(catalogue.summary.formats).toEqual(['CSV', 'GeoJSON', 'JSON']);
    expect(catalogue.summary.restrictedDatasetCount).toBe(1);
    expect(catalogue.summary.sensitiveFieldCount).toBe(6);
  });

  test('sorts collections and their datasets by title with pt-BR collation', async () => {
    const catalogue = toAppCatalogue(await readStaticDataCatalogue());

    const titles = catalogue.collections.map((collection) => {
      return collection.title;
    });
    expect(titles).toEqual(
      [...titles].sort((a, b) => {
        return a.localeCompare(b, 'pt-BR');
      })
    );

    const mda = catalogue.collections.find((collection) => {
      return collection.id === 'mda';
    });
    // "Áreas" before "Produção" only under accent-aware collation.
    expect(
      mda?.datasets.map((dataset) => {
        return dataset.id;
      })
    ).toEqual(['caf_areas', 'caf_producao']);
  });

  test('inherits the collection publisher unless the dataset overrides it', async () => {
    const catalogue = toAppCatalogue(await readStaticDataCatalogue());

    const datasets = catalogue.collections.flatMap((collection) => {
      return collection.datasets;
    });
    const inherited = datasets.find((dataset) => {
      return dataset.id === 'municipios_populacao';
    });
    const overridden = datasets.find((dataset) => {
      return dataset.id === 'assentamentos';
    });

    expect(inherited?.organization).toBe(
      'Instituto Brasileiro de Geografia e Estatística (IBGE)'
    );
    expect(overridden?.organization).toBe(
      'Serviço Florestal Brasileiro (SFB) — SICAR'
    );
  });

  test('flattens every derived gap, attributed to its dataset and collection', async () => {
    const catalogue = toAppCatalogue(await readStaticDataCatalogue());

    expect(catalogue.gaps).toContainEqual({
      datasetId: 'cozinhas_geolocalizadas',
      datasetTitle: 'Cozinhas Solidárias geolocalizadas',
      collectionSlug: 'dados-primarios',
      kind: 'temporalUnknown',
    });
    expect(catalogue.gaps).toContainEqual({
      datasetId: 'caf_producao',
      datasetTitle: 'Produção e renda CAF — Cadastro Ambiental Rural',
      collectionSlug: 'mda',
      kind: 'originUndocumented',
    });
    // Every gap must name a dataset that the page actually renders.
    const ids = catalogue.collections.flatMap((collection) => {
      return collection.datasets.map((dataset) => {
        return dataset.id;
      });
    });
    for (const gap of catalogue.gaps) {
      expect(ids).toContain(gap.datasetId);
    }
  });

  test('normalizes the source vocabularies to camelCase', () => {
    const catalogue = toAppCatalogue(
      buildSource({
        dataset: {
          temporal: {
            status: 'described',
            extent: [['2008-01-01', null]],
            grain: 'P1Y',
            frequency: 'one_time',
            history: 'append_only',
          },
          spatial: {
            status: 'described',
            extent: [{ scheme: 'iso3166-1', code: 'BR' }],
            coverage: 'exhaustive',
            grain: { scheme: 'admin', code: 'municipality' },
            geometry: 'none',
            precision: 'not_applicable',
            field: 'codarea',
          },
        },
      })
    );

    const dataset = catalogue.collections[0].datasets[0];
    expect(dataset.temporal).toEqual({
      status: 'described',
      extent: [{ start: '2008-01-01', end: null }],
      grain: 'P1Y',
      frequency: 'oneTime',
      history: 'appendOnly',
    });
    expect(dataset.spatial).toEqual({
      status: 'described',
      extent: [{ scheme: 'iso3166-1', code: 'BR' }],
      coverage: 'exhaustive',
      // `label` is optional at source and normalizes to an explicit null.
      grain: { code: 'municipality', label: null },
      geometry: 'none',
      precision: 'notApplicable',
      srid: null,
    });
  });

  test('maps both undocumented dimension statuses', () => {
    const unknown = toAppCatalogue(
      buildSource({
        dataset: {
          temporal: { status: 'unknown' },
          spatial: { status: 'unknown' },
        },
      })
    ).collections[0].datasets[0];
    const notApplicable = toAppCatalogue(
      buildSource({
        dataset: {
          temporal: { status: 'not_applicable' },
          spatial: { status: 'not_applicable' },
        },
      })
    ).collections[0].datasets[0];

    expect(unknown.temporal).toEqual({ status: 'unknown' });
    expect(unknown.spatial).toEqual({ status: 'unknown' });
    expect(unknown.gaps).toEqual(['temporalUnknown', 'spatialUnknown']);
    expect(notApplicable.temporal).toEqual({ status: 'notApplicable' });
    expect(notApplicable.spatial).toEqual({ status: 'notApplicable' });
    expect(notApplicable.gaps).toEqual([]);
  });

  test.each([
    ['features', { features: 1825 }, { kind: 'features', count: 1825 }],
    ['entries', { entries: 5564 }, { kind: 'entries', count: 5564 }],
    ['rows', { rows: 999 }, { kind: 'rows', count: 999 }],
  ])('reads the %s volume from the stats bag', (_kind, stats, expected) => {
    const catalogue = toAppCatalogue(buildSource({ dataset: { stats } }));

    expect(catalogue.collections[0].datasets[0].volume).toEqual(expected);
  });

  test('leaves volume and size null when the stats bag records neither', () => {
    const withoutCounts = toAppCatalogue(
      buildSource({ dataset: { stats: { checkSum: 'sha256:abc' } } })
    ).collections[0].datasets[0];
    const withoutStats =
      toAppCatalogue(buildSource()).collections[0].datasets[0];

    expect(withoutCounts.volume).toBeNull();
    expect(withoutCounts.sizeBytes).toBeNull();
    expect(withoutStats.volume).toBeNull();
    expect(withoutStats.sizeBytes).toBeNull();
  });

  test('carries size, origin notes and sensitive flags through', () => {
    const dataset = toAppCatalogue(
      buildSource({
        dataset: {
          stats: { rows: 10, size_bytes: 2048 },
          source: { url: null, notes: 'Delimitador: ponto e vírgula.' },
          access: {
            level: 'restricted',
            contains_personal_data: true,
            notes: 'Publicar apenas agregado.',
          },
          schema: {
            fields: [
              {
                name: 'CNPJ',
                description: 'CNPJ',
                role: 'identifier',
                unit: 'BRL',
                sensitive: true,
              },
            ],
          },
        },
      })
    ).collections[0].datasets[0];

    expect(dataset.sizeBytes).toBe(2048);
    expect(dataset.originNotes).toBe('Delimitador: ponto e vírgula.');
    expect(dataset.hasDocumentedOrigin).toBe(false);
    expect(dataset.gaps).toContain('originUndocumented');
    expect(dataset.access).toEqual({
      level: 'restricted',
      containsPersonalData: true,
      notes: 'Publicar apenas agregado.',
    });
    expect(dataset.fields[0]).toEqual({
      name: 'CNPJ',
      description: 'CNPJ',
      role: 'identifier',
      unit: 'BRL',
      sensitive: true,
    });
  });

  test('flags unknown coordinate precision as a gap', () => {
    const dataset = toAppCatalogue(
      buildSource({
        dataset: {
          spatial: {
            status: 'described',
            extent: [{ scheme: 'iso3166-1', code: 'BR' }],
            coverage: 'partial',
            grain: { scheme: 'custom', code: 'kitchen', label: 'cozinha' },
            geometry: 'point',
            precision: 'unknown',
            field: 'codigo',
          },
        },
      })
    ).collections[0].datasets[0];

    expect(dataset.gaps).toEqual(['precisionUnknown']);
  });

  test('rejects a dataset pointing at a collection that does not exist', () => {
    expect(() => {
      return toAppCatalogue(buildSource({ collectionId: 'inexistente' }));
    }).toThrow(
      '[data-gateway] dataset "malhas" references unknown collection "inexistente".'
    );
  });
});
