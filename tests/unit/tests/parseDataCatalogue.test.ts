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

/** Serializes `minimal` with a deep patch applied to one dataset. */
const withDataset = (patch: Record<string, unknown>) => {
  return JSON.stringify({
    ...minimal,
    datasets: { malhas: { ...minimal.datasets.malhas, ...patch } },
  });
};

describe('parseDataCatalogue', () => {
  test('parses the real catalogue served at public/dataset_catalogue.json', async () => {
    const { readFile } = await import('node:fs/promises');
    const { join } = await import('node:path');
    const text = await readFile(
      join(process.cwd(), 'public', 'dataset_catalogue.json'),
      'utf8'
    );

    const catalogue = parseDataCatalogue(text);

    expect(catalogue.schema_version).toBe('2.0.0');
    expect(Object.keys(catalogue.datasets)).toHaveLength(12);
    expect(Object.keys(catalogue.collections)).toHaveLength(6);
    expect(catalogue.catalog.quality_notes[0].severity).toBe('low');

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

  test('parses a minimal catalogue, defaulting every optional field to undefined', () => {
    const catalogue = parseDataCatalogue(JSON.stringify(minimal));

    const dataset = catalogue.datasets['malhas'];
    expect(dataset.generated_by).toBeUndefined();
    expect(dataset.stats).toBeUndefined();
    expect(dataset.source.notes).toBeUndefined();
    expect(dataset.access.notes).toBeUndefined();
    expect(dataset.schema.fields[0].role).toBeUndefined();
    expect(catalogue.collections['ibge'].public_reference_url).toBeUndefined();
  });

  test('reads a described temporal dimension, including open-ended bounds', () => {
    const catalogue = parseDataCatalogue(
      withDataset({
        temporal: {
          status: 'described',
          extent: [['2008-01-01', null]],
          grain: 'P1D',
          frequency: 'annual',
          history: 'append_only',
          timezone: 'America/Sao_Paulo',
        },
      })
    );

    const { temporal } = catalogue.datasets['malhas'];
    expect(temporal.status).toBe('described');
    expect(temporal).toMatchObject({
      extent: [['2008-01-01', null]],
      grain: 'P1D',
      frequency: 'annual',
      history: 'append_only',
    });
  });

  test('reads a described spatial dimension with its geometry and SRID', () => {
    const catalogue = parseDataCatalogue(
      withDataset({
        spatial: {
          status: 'described',
          extent: [{ scheme: 'iso3166-1', code: 'BR' }],
          coverage: 'exhaustive',
          grain: { scheme: 'admin', code: 'municipality' },
          geometry: 'multipolygon',
          precision: 'not_applicable',
          srid: 4326,
          field: 'codarea',
        },
      })
    );

    expect(catalogue.datasets['malhas'].spatial).toMatchObject({
      status: 'described',
      geometry: 'multipolygon',
      srid: 4326,
    });
  });

  test('reads the open-ended stats bag, keeping numbers and strings apart', () => {
    const catalogue = parseDataCatalogue(
      withDataset({
        stats: { features: 5564, checkSum: 'sha256:abc', size_bytes: 42 },
        generated_by: 'scripts/generate.mjs',
      })
    );

    expect(catalogue.datasets['malhas'].stats).toEqual({
      features: 5564,
      checkSum: 'sha256:abc',
      size_bytes: 42,
    });
    expect(catalogue.datasets['malhas'].generated_by).toBe(
      'scripts/generate.mjs'
    );
  });

  test('reads a sensitive field flag', () => {
    const catalogue = parseDataCatalogue(
      withDataset({
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
      })
    );

    expect(catalogue.datasets['malhas'].schema.fields[0]).toEqual({
      name: 'CNPJ',
      description: 'CNPJ',
      role: 'identifier',
      unit: 'BRL',
      sensitive: true,
    });
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
  ])('rejects %s', (_case, text, message) => {
    expect(() => {
      return parseDataCatalogue(text);
    }).toThrow(`[data-source-static] data catalogue: ${message}.`);
  });
});
