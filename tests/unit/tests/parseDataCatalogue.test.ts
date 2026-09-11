import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { parseDataCatalogue } from 'src/data-source-static/readStaticDataCatalogue';

/** Smallest catalogue that satisfies every required field. */
const minimal = {
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
      organization: 'IBGE',
      source_url: null,
      tags: ['ibge'],
    },
  },
  datasets: {
    malhas: {
      id: 'malhas',
      collection_id: 'ibge',
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
    },
  },
};

/** Serializes `minimal` with a patch applied to its one dataset. */
const withDataset = (patch: Record<string, unknown>) => {
  return JSON.stringify({
    ...minimal,
    datasets: { malhas: { ...minimal.datasets.malhas, ...patch } },
  });
};

describe('parseDataCatalogue', () => {
  test('accepts the real catalogue, exposing it source-native and uninterpreted', async () => {
    const text = await readFile(
      join(process.cwd(), 'public', 'dataset_catalogue.json'),
      'utf8'
    );

    const catalogue = parseDataCatalogue(text);

    expect(catalogue.schema_version).toBe('2.0.0');
    expect(Object.keys(catalogue.datasets)).toHaveLength(12);
    expect(Object.keys(catalogue.collections)).toHaveLength(6);

    const cozinhas = catalogue.datasets['cozinhas_geolocalizadas'];
    expect(cozinhas.access.level).toBe('restricted');
    expect(cozinhas.access.contains_personal_data).toBe(true);
    expect(cozinhas.schema.fields).toHaveLength(18);
    // Optional per-dataset publisher: absent here, so it must stay undefined
    // rather than be invented — the transformer inherits the collection's.
    expect(cozinhas.source.organization).toBeUndefined();
    expect(catalogue.datasets['assentamentos'].source.organization).toBe(
      'Serviço Florestal Brasileiro (SFB) — SICAR'
    );
  });

  test('leaves absent optional fields undefined rather than inventing values', () => {
    const catalogue = parseDataCatalogue(JSON.stringify(minimal));

    const dataset = catalogue.datasets['malhas'];
    expect(dataset.stats).toBeUndefined();
    expect(dataset.generated_by).toBeUndefined();
    expect(dataset.source.notes).toBeUndefined();
    expect(dataset.access.notes).toBeUndefined();
    expect(dataset.schema.fields[0].role).toBeUndefined();
    expect(dataset.schema.fields[0].unit).toBeUndefined();
    expect(catalogue.collections['ibge'].public_reference_url).toBeUndefined();
  });

  test.each([
    ['a non-object root', '"text"', 'root must be an object'],
    [
      'a missing top-level string',
      JSON.stringify({ ...minimal, schema_version: '' }),
      'schema_version must be a non-empty string',
    ],
    [
      'a non-object nested member',
      JSON.stringify({ ...minimal, catalog: 42 }),
      'catalog must be an object',
    ],
    [
      'a non-array member',
      JSON.stringify({
        ...minimal,
        catalog: { ...minimal.catalog, quality_notes: {} },
      }),
      'catalog.quality_notes must be an array',
    ],
    [
      'a code outside its vocabulary',
      JSON.stringify({
        ...minimal,
        catalog: {
          ...minimal.catalog,
          quality_notes: [{ id: 'n', severity: 'urgent', message: 'm' }],
        },
      }),
      'catalog.quality_notes[0].severity must be one of: low, medium, high',
    ],
    [
      'a non-string array entry',
      JSON.stringify({
        ...minimal,
        collections: {
          ibge: { ...minimal.collections.ibge, tags: ['ibge', 7] },
        },
      }),
      'collections.ibge.tags[1] must be a non-empty string',
    ],
    [
      'a non-boolean flag',
      withDataset({
        access: { level: 'public', contains_personal_data: 'no' },
      }),
      'datasets.malhas.access.contains_personal_data must be a boolean',
    ],
    [
      'a truncated interval',
      withDataset({
        temporal: {
          status: 'described',
          extent: [['2008-01-01']],
          grain: 'P1D',
          frequency: 'annual',
          history: 'snapshot',
        },
      }),
      'datasets.malhas.temporal.extent[0] must be a [start, end] pair',
    ],
    [
      'a non-finite number',
      withDataset({
        spatial: {
          status: 'described',
          extent: [{ scheme: 'iso3166-1', code: 'BR' }],
          coverage: 'exhaustive',
          grain: { scheme: 'admin', code: 'municipality' },
          geometry: 'point',
          precision: 'exact',
          srid: 'quatro mil',
          field: 'codarea',
        },
      }),
      'datasets.malhas.spatial.srid must be a finite number',
    ],
    [
      'an SRID on geometry-less data',
      withDataset({
        spatial: {
          status: 'described',
          extent: [{ scheme: 'iso3166-1', code: 'BR' }],
          coverage: 'exhaustive',
          grain: { scheme: 'admin', code: 'municipality' },
          geometry: 'none',
          precision: 'not_applicable',
          srid: 4326,
          field: 'codarea',
        },
      }),
      'datasets.malhas.spatial.srid must be absent when geometry is "none"',
    ],
  ])(
    'fails loudly, naming the offending path, on %s',
    (_case, text, message) => {
      expect(() => {
        return parseDataCatalogue(text);
      }).toThrow(`[data-source-static] data catalogue: ${message}.`);
    }
  );
});
