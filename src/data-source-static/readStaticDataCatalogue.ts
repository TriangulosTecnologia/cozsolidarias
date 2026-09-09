import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type {
  CatalogueAccess,
  CatalogueCollection,
  CatalogueDataset,
  CatalogueField,
  CatalogueMeta,
  CatalogueQualityNote,
  CatalogueSource,
  CatalogueSpatial,
  CatalogueSpatialExtent,
  CatalogueSpatialGrain,
  CatalogueTemporal,
  DataCatalogue,
} from './dataCatalogue';

/**
 * The catalogue is authored by hand and kept under `public/` (so it is also
 * downloadable as a raw artifact). This reader loads it from disk rather than
 * over HTTP, which keeps the source package filesystem-based like every other
 * `readStatic*` reader.
 *
 * Because the path is built at runtime, Next.js cannot trace it statically —
 * `outputFileTracingIncludes` in `next.config.ts` pins the file into the
 * serverless bundle so the read also works in production.
 */
const CATALOGUE_PATH = join(
  process.cwd(),
  'public',
  'filtered_dataset_catalogue.json'
);

const SEVERITIES = ['low', 'medium', 'high'] as const;
const ACCESS_LEVELS = ['public', 'restricted'] as const;
const DIMENSION_STATUSES = ['described', 'not_applicable', 'unknown'] as const;
const FREQUENCIES = [
  'daily',
  'monthly',
  'annual',
  'irregular',
  'one_time',
] as const;
const HISTORIES = ['append_only', 'overwrite', 'revised', 'snapshot'] as const;
const EXTENT_SCHEMES = ['iso3166-1', 'iso3166-2'] as const;
const COVERAGES = ['exhaustive', 'partial', 'sample', 'unknown'] as const;
const GEOMETRIES = [
  'none',
  'point',
  'multipoint',
  'line',
  'polygon',
  'multipolygon',
  'geometrycollection',
] as const;
const PRECISIONS = [
  'exact',
  'approximate',
  'centroid',
  'not_applicable',
  'unknown',
] as const;
const GRAIN_SCHEMES = ['admin', 'custom'] as const;

/** Raises a validation error naming the offending JSON path. */
const fail = (path: string, expected: string): never => {
  throw new Error(
    `[data-source-static] data catalogue: ${path} must be ${expected}.`
  );
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const readRecord = (value: unknown, path: string): Record<string, unknown> => {
  return isRecord(value) ? value : fail(path, 'an object');
};

const readString = (value: unknown, path: string): string => {
  return typeof value === 'string' && value !== ''
    ? value
    : fail(path, 'a non-empty string');
};

const readOptionalString = (
  value: unknown,
  path: string
): string | undefined => {
  return value === undefined ? undefined : readString(value, path);
};

const readNullableString = (value: unknown, path: string): string | null => {
  return value === null ? null : readString(value, path);
};

const readNumber = (value: unknown, path: string): number => {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : fail(path, 'a finite number');
};

const readBoolean = (value: unknown, path: string): boolean => {
  return typeof value === 'boolean' ? value : fail(path, 'a boolean');
};

const readArray = (value: unknown, path: string): unknown[] => {
  return Array.isArray(value) ? value : fail(path, 'an array');
};

const readStringArray = (value: unknown, path: string): string[] => {
  return readArray(value, path).map((entry, index) => {
    return readString(entry, `${path}[${index}]`);
  });
};

/** Validates that a string cell is one of a closed set of source-native codes. */
const readEnum = <T extends string>(
  value: unknown,
  path: string,
  allowed: readonly T[]
): T => {
  const candidate = readString(value, path);
  return (allowed as readonly string[]).includes(candidate)
    ? (candidate as T)
    : fail(path, `one of: ${allowed.join(', ')}`);
};

const toQualityNote = (value: unknown, path: string): CatalogueQualityNote => {
  const note = readRecord(value, path);
  return {
    id: readString(note['id'], `${path}.id`),
    severity: readEnum(note['severity'], `${path}.severity`, SEVERITIES),
    message: readString(note['message'], `${path}.message`),
  };
};

const toMeta = (value: unknown): CatalogueMeta => {
  const meta = readRecord(value, 'catalog');
  return {
    id: readString(meta['id'], 'catalog.id'),
    title: readString(meta['title'], 'catalog.title'),
    description: readString(meta['description'], 'catalog.description'),
    language: readString(meta['language'], 'catalog.language'),
    status: readString(meta['status'], 'catalog.status'),
    created_at: readString(meta['created_at'], 'catalog.created_at'),
    updated_at: readString(meta['updated_at'], 'catalog.updated_at'),
    typing_reference: readString(
      meta['typing_reference'],
      'catalog.typing_reference'
    ),
    quality_notes: readArray(
      meta['quality_notes'],
      'catalog.quality_notes'
    ).map((entry, index) => {
      return toQualityNote(entry, `catalog.quality_notes[${index}]`);
    }),
  };
};

const toCollection = (value: unknown, path: string): CatalogueCollection => {
  const collection = readRecord(value, path);
  return {
    id: readString(collection['id'], `${path}.id`),
    slug: readString(collection['slug'], `${path}.slug`),
    title: readString(collection['title'], `${path}.title`),
    description: readString(collection['description'], `${path}.description`),
    organization: readString(
      collection['organization'],
      `${path}.organization`
    ),
    source_url: readNullableString(
      collection['source_url'],
      `${path}.source_url`
    ),
    public_reference_url: readOptionalString(
      collection['public_reference_url'],
      `${path}.public_reference_url`
    ),
    tags: readStringArray(collection['tags'], `${path}.tags`),
  };
};

const toSource = (value: unknown, path: string): CatalogueSource => {
  const source = readRecord(value, path);
  return {
    organization: readOptionalString(
      source['organization'],
      `${path}.organization`
    ),
    url: readNullableString(source['url'], `${path}.url`),
    notes: readOptionalString(source['notes'], `${path}.notes`),
  };
};

const toTemporal = (value: unknown, path: string): CatalogueTemporal => {
  const temporal = readRecord(value, path);
  const status = readEnum(
    temporal['status'],
    `${path}.status`,
    DIMENSION_STATUSES
  );

  if (status !== 'described') {
    return { status };
  }

  return {
    status,
    extent: readArray(temporal['extent'], `${path}.extent`).map(
      (entry, index) => {
        const bounds = readArray(entry, `${path}.extent[${index}]`);
        if (bounds.length !== 2) {
          fail(`${path}.extent[${index}]`, 'a [start, end] pair');
        }
        const pair: [string | null, string | null] = [
          readNullableString(bounds[0], `${path}.extent[${index}][0]`),
          readNullableString(bounds[1], `${path}.extent[${index}][1]`),
        ];
        return pair;
      }
    ),
    grain: readString(temporal['grain'], `${path}.grain`),
    frequency: readEnum(
      temporal['frequency'],
      `${path}.frequency`,
      FREQUENCIES
    ),
    history: readEnum(temporal['history'], `${path}.history`, HISTORIES),
    timezone: readOptionalString(temporal['timezone'], `${path}.timezone`),
  };
};

const toSpatialExtent = (
  value: unknown,
  path: string
): CatalogueSpatialExtent => {
  const extent = readRecord(value, path);
  return {
    scheme: readEnum(extent['scheme'], `${path}.scheme`, EXTENT_SCHEMES),
    code: readString(extent['code'], `${path}.code`),
  };
};

const toSpatialGrain = (
  value: unknown,
  path: string
): CatalogueSpatialGrain => {
  const grain = readRecord(value, path);
  return {
    scheme: readEnum(grain['scheme'], `${path}.scheme`, GRAIN_SCHEMES),
    code: readString(grain['code'], `${path}.code`),
    label: readOptionalString(grain['label'], `${path}.label`),
  };
};

const toSpatial = (value: unknown, path: string): CatalogueSpatial => {
  const spatial = readRecord(value, path);
  const status = readEnum(
    spatial['status'],
    `${path}.status`,
    DIMENSION_STATUSES
  );

  if (status !== 'described') {
    return { status };
  }

  const geometry = readEnum(
    spatial['geometry'],
    `${path}.geometry`,
    GEOMETRIES
  );
  const srid = spatial['srid'];

  // `srid` describes stored coordinates, so it is meaningful only alongside a
  // geometry; the type documents that pairing and the data must honour it.
  if (geometry === 'none' && srid !== undefined) {
    fail(`${path}.srid`, 'absent when geometry is "none"');
  }

  return {
    status,
    extent: readArray(spatial['extent'], `${path}.extent`).map(
      (entry, index) => {
        return toSpatialExtent(entry, `${path}.extent[${index}]`);
      }
    ),
    coverage: readEnum(spatial['coverage'], `${path}.coverage`, COVERAGES),
    grain: toSpatialGrain(spatial['grain'], `${path}.grain`),
    geometry,
    precision: readEnum(spatial['precision'], `${path}.precision`, PRECISIONS),
    ...(srid === undefined ? {} : { srid: readNumber(srid, `${path}.srid`) }),
    field: readString(spatial['field'], `${path}.field`),
  };
};

const toAccess = (value: unknown, path: string): CatalogueAccess => {
  const access = readRecord(value, path);
  return {
    level: readEnum(access['level'], `${path}.level`, ACCESS_LEVELS),
    contains_personal_data: readBoolean(
      access['contains_personal_data'],
      `${path}.contains_personal_data`
    ),
    notes: readOptionalString(access['notes'], `${path}.notes`),
  };
};

const toField = (value: unknown, path: string): CatalogueField => {
  const field = readRecord(value, path);
  return {
    name: readString(field['name'], `${path}.name`),
    description: readString(field['description'], `${path}.description`),
    role: readOptionalString(field['role'], `${path}.role`),
    unit: readOptionalString(field['unit'], `${path}.unit`),
    ...(field['sensitive'] === undefined
      ? {}
      : { sensitive: readBoolean(field['sensitive'], `${path}.sensitive`) }),
  };
};

/**
 * Reads the `stats` bag, which is intentionally open-ended: keys differ per
 * dataset (`rows`, `entries`, `features`, `size_bytes`, `checkSum`).
 */
const toStats = (
  value: unknown,
  path: string
): Record<string, number | string> => {
  const stats = readRecord(value, path);
  return Object.fromEntries(
    Object.entries(stats).map(([key, entry]) => {
      if (typeof entry === 'number' && Number.isFinite(entry)) {
        return [key, entry];
      }
      return [key, readString(entry, `${path}.${key}`)];
    })
  );
};

const toDataset = (value: unknown, path: string): CatalogueDataset => {
  const dataset = readRecord(value, path);
  const schema = readRecord(dataset['schema'], `${path}.schema`);
  const stats = dataset['stats'];

  return {
    id: readString(dataset['id'], `${path}.id`),
    collection_id: readString(
      dataset['collection_id'],
      `${path}.collection_id`
    ),
    slug: readString(dataset['slug'], `${path}.slug`),
    title: readString(dataset['title'], `${path}.title`),
    description: readString(dataset['description'], `${path}.description`),
    file: readString(dataset['file'], `${path}.file`),
    format: readString(dataset['format'], `${path}.format`),
    source: toSource(dataset['source'], `${path}.source`),
    generated_by: readOptionalString(
      dataset['generated_by'],
      `${path}.generated_by`
    ),
    temporal: toTemporal(dataset['temporal'], `${path}.temporal`),
    spatial: toSpatial(dataset['spatial'], `${path}.spatial`),
    access: toAccess(dataset['access'], `${path}.access`),
    ...(stats === undefined ? {} : { stats: toStats(stats, `${path}.stats`) }),
    schema: {
      fields: readArray(schema['fields'], `${path}.schema.fields`).map(
        (entry, index) => {
          return toField(entry, `${path}.schema.fields[${index}]`);
        }
      ),
    },
  };
};

/** Validates a keyed map of entries, threading each key into the error path. */
const toKeyedMap = <T>(
  value: unknown,
  path: string,
  toEntry: (entry: unknown, entryPath: string) => T
): Record<string, T> => {
  const map = readRecord(value, path);
  return Object.fromEntries(
    Object.entries(map).map(([key, entry]) => {
      return [key, toEntry(entry, `${path}.${key}`)];
    })
  );
};

/**
 * Parses and validates the raw catalogue JSON text into the source-native
 * {@link DataCatalogue}. Pure (no I/O): the disk read lives in
 * {@link readStaticDataCatalogue}.
 *
 * Validation is structural and exhaustive — every field consumed downstream is
 * checked, and closed vocabularies (severities, access levels, frequencies,
 * geometries, …) are rejected when they carry an unknown code. Errors name the
 * offending JSON path so a hand-edit mistake is obvious.
 *
 * @param text - Raw JSON text of `public/dataset_catalogue.json`.
 * @returns The validated catalogue, source-native (snake_case) and
 * uninterpreted — including the fields the app must not display.
 * @throws If the JSON is malformed or any required field is missing, empty or
 * outside its declared vocabulary.
 *
 * @example
 * const catalogue = parseDataCatalogue(await readFile(path, 'utf8'));
 * catalogue.datasets['municipios_populacao'].format; // 'JSON'
 */
export const parseDataCatalogue = (text: string): DataCatalogue => {
  const parsed: unknown = JSON.parse(text);
  const root = readRecord(parsed, 'root');

  return {
    schema_version: readString(root['schema_version'], 'schema_version'),
    catalog: toMeta(root['catalog']),
    collections: toKeyedMap(root['collections'], 'collections', toCollection),
    datasets: toKeyedMap(root['datasets'], 'datasets', toDataset),
  };
};

/**
 * Reads, parses and validates the hand-authored data catalogue —
 * `public/dataset_catalogue.json` — which describes every dataset the project
 * uses (origin, coverage, access, volume and the field-level data dictionary).
 *
 * Server-only: it reads from disk with `fs`, so it must be called from a Server
 * Component, route handler or other server context.
 *
 * Unlike the other `readStatic*` readers this result is **not** memoized: the
 * catalogue is documentation that is edited by hand, and every edit must reach
 * the page without a process restart. The file is ~40 KB, so a fresh read and
 * parse per call is cheap.
 *
 * @returns The validated catalogue from `public/dataset_catalogue.json`.
 * @throws If the file is missing or malformed (see {@link parseDataCatalogue}).
 *
 * @example
 * const catalogue = await readStaticDataCatalogue();
 * Object.keys(catalogue.collections); // ['ibge', 'mds_sagi', ...]
 */
export const readStaticDataCatalogue = async (): Promise<DataCatalogue> => {
  return parseDataCatalogue(await readFile(CATALOGUE_PATH, 'utf8'));
};
