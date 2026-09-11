import { toAppCatalogue } from 'src/data-gateway/transformers/toAppCatalogue';
import type { DataCatalogue } from 'src/data-source-static/dataCatalogue';
import { readStaticDataCatalogue } from 'src/data-source-static/readStaticDataCatalogue';

/**
 * Minimal source catalogue for the shapes the real file does not contain: an
 * undocumented spatial dimension, an origin without notes and a spatial grain
 * without a label. Everything the real catalogue does exercise is asserted
 * against it directly.
 */
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
      quality_notes: [],
    },
    collections: {
      ibge: {
        id: 'ibge',
        slug: 'ibge',
        title: 'IBGE',
        description: 'Datasets do IBGE',
        organization: 'Instituto Brasileiro de Geografia e Estatística',
        source_url: 'https://www.ibge.gov.br',
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
        source: { url: null },
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
  test('gives the app contract no field for an origin URL, path or checksum', async () => {
    const catalogue = toAppCatalogue(await readStaticDataCatalogue());

    // Redaction is structural, not a view-level filter: the values are absent
    // from the contract, so no component can render them.
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
    expect(serialized).not.toMatch(/https?:\/\//);
  });

  test('resolves publisher, source and volume for every dataset in the real catalogue', async () => {
    const catalogue = toAppCatalogue(await readStaticDataCatalogue());

    expect(catalogue.datasets).toHaveLength(12);
    const byId = (id: string) => {
      return catalogue.datasets.find((dataset) => {
        return dataset.id === id;
      });
    };

    // Most datasets omit their own publisher and inherit the collection's; the
    // two SICAR ones override it.
    expect(byId('municipios_populacao')?.organization).toBe(
      'Instituto Brasileiro de Geografia e Estatística (IBGE)'
    );
    expect(byId('assentamentos')?.organization).toBe(
      'Serviço Florestal Brasileiro (SFB) — SICAR'
    );
    // The collection is denormalized onto the dataset as its source.
    expect(byId('cozinhas_geolocalizadas')?.source.title).toBe(
      'Dados Primários'
    );
    // Volume reads whichever unit the format counts in.
    expect(byId('assentamentos')?.volume).toEqual({
      kind: 'features',
      count: 1825,
    });
    expect(byId('municipios_nomes')?.volume).toEqual({
      kind: 'entries',
      count: 5564,
    });
    expect(byId('cozinhas_geolocalizadas')?.volume).toEqual({
      kind: 'rows',
      count: 1396,
    });
    // `caf_areas` records no size, so it must stay null rather than read 0.
    expect(byId('caf_areas')?.sizeBytes).toBeNull();

    // Gaps are derived from each dataset's own metadata, not authored.
    expect(byId('cozinhas_geolocalizadas')?.gaps).toEqual([
      'temporalUnknown',
      'precisionUnknown',
    ]);
    expect(byId('caf_areas')?.gaps).toEqual([
      'temporalUnknown',
      'precisionUnknown',
      'originUndocumented',
    ]);
    expect(byId('municipios_populacao')?.gaps).toEqual([]);

    // Sorted by title with pt-BR collation, so the grid is stable across reads.
    const titles = catalogue.datasets.map((dataset) => {
      return dataset.title;
    });
    expect(titles).toEqual(
      [...titles].sort((a, b) => {
        return a.localeCompare(b, 'pt-BR');
      })
    );
  });

  test('normalizes vocabularies and nullable slots the real catalogue never uses', () => {
    const undocumented = toAppCatalogue(buildSource()).datasets[0];

    expect(undocumented.temporal).toEqual({ status: 'notApplicable' });
    expect(undocumented.spatial).toEqual({ status: 'unknown' });
    expect(undocumented.gaps).toEqual(['spatialUnknown', 'originUndocumented']);
    // Absent optional slots become explicit nulls, never undefined.
    expect(undocumented.originNotes).toBeNull();
    expect(undocumented.volume).toBeNull();
    expect(undocumented.sizeBytes).toBeNull();
    expect(undocumented.access.notes).toBeNull();
    expect(undocumented.hasDocumentedOrigin).toBe(false);

    const described = toAppCatalogue(
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
    ).datasets[0];

    // snake_case source codes become the repository's camelCase convention.
    expect(described.temporal).toEqual({
      status: 'described',
      extent: [{ start: '2008-01-01', end: null }],
      grain: 'P1Y',
      frequency: 'oneTime',
      history: 'appendOnly',
    });
    expect(described.spatial).toEqual({
      status: 'described',
      extent: [{ scheme: 'iso3166-1', code: 'BR' }],
      coverage: 'exhaustive',
      grain: { code: 'municipality', label: null },
      geometry: 'none',
      precision: 'notApplicable',
      srid: null,
    });
  });

  test('rejects a dataset pointing at a collection that does not exist', () => {
    expect(() => {
      return toAppCatalogue(buildSource({ collectionId: 'inexistente' }));
    }).toThrow(
      '[data-gateway] dataset "malhas" references unknown collection "inexistente".'
    );
  });
});
