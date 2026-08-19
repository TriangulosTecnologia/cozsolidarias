import type {
  CatalogueCollection,
  CatalogueDataset,
  CatalogueSpatialPrecision,
  CatalogueTemporalFrequency,
  CatalogueTemporalHistory,
  DataCatalogue,
} from '../../data-source-static/dataCatalogue';
import type {
  CatalogueContract,
  CatalogueDatasetContract,
  CatalogueFieldContract,
  CatalogueFrequencyContract,
  CatalogueGapKind,
  CatalogueHistoryContract,
  CataloguePrecisionContract,
  CatalogueSpatialContract,
  CatalogueTemporalContract,
  CatalogueVolumeContract,
} from '../schema/catalogue';

/** Source vocabularies, normalized to the repository's camelCase convention. */
const FREQUENCIES: Record<
  CatalogueTemporalFrequency,
  CatalogueFrequencyContract
> = {
  daily: 'daily',
  monthly: 'monthly',
  annual: 'annual',
  irregular: 'irregular',
  one_time: 'oneTime',
};

const HISTORIES: Record<CatalogueTemporalHistory, CatalogueHistoryContract> = {
  append_only: 'appendOnly',
  overwrite: 'overwrite',
  revised: 'revised',
  snapshot: 'snapshot',
};

const PRECISIONS: Record<
  CatalogueSpatialPrecision,
  CataloguePrecisionContract
> = {
  exact: 'exact',
  approximate: 'approximate',
  centroid: 'centroid',
  not_applicable: 'notApplicable',
  unknown: 'unknown',
};

/**
 * Statuses of a dimension that carries no further metadata. Kept as a map so
 * both dimensions narrow on `status !== 'described'` — the source union holds
 * `not_applicable` and `unknown` in a single member, which sequential equality
 * checks cannot reduce.
 */
const NOT_DESCRIBED: Record<
  'not_applicable' | 'unknown',
  'notApplicable' | 'unknown'
> = {
  not_applicable: 'notApplicable',
  unknown: 'unknown',
};

/** Stat keys that count records, in the order they are looked up. */
const VOLUME_KEYS: Array<[string, CatalogueVolumeContract['kind']]> = [
  ['features', 'features'],
  ['entries', 'entries'],
  ['rows', 'rows'],
];

/** Orders titles the way a pt-BR reader expects (accent-aware). */
const byTitle = <T extends { title: string }>(a: T, b: T): number => {
  return a.title.localeCompare(b.title, 'pt-BR');
};

/** Reads a numeric stat, ignoring the bag's string-valued entries. */
const numericStat = (
  stats: Record<string, number | string> | undefined,
  key: string
): number | null => {
  const value = stats?.[key];
  return typeof value === 'number' ? value : null;
};

const toVolume = (
  stats: Record<string, number | string> | undefined
): CatalogueVolumeContract | null => {
  for (const [key, kind] of VOLUME_KEYS) {
    const count = numericStat(stats, key);
    if (count !== null) {
      return { kind, count };
    }
  }
  return null;
};

const toTemporal = (
  temporal: CatalogueDataset['temporal']
): CatalogueTemporalContract => {
  if (temporal.status !== 'described') {
    return { status: NOT_DESCRIBED[temporal.status] };
  }

  return {
    status: 'described',
    extent: temporal.extent.map(([start, end]) => {
      return { start, end };
    }),
    grain: temporal.grain,
    frequency: FREQUENCIES[temporal.frequency],
    history: HISTORIES[temporal.history],
  };
};

const toSpatial = (
  spatial: CatalogueDataset['spatial']
): CatalogueSpatialContract => {
  if (spatial.status !== 'described') {
    return { status: NOT_DESCRIBED[spatial.status] };
  }

  return {
    status: 'described',
    extent: spatial.extent.map((entry) => {
      return { scheme: entry.scheme, code: entry.code };
    }),
    coverage: spatial.coverage,
    grain: { code: spatial.grain.code, label: spatial.grain.label ?? null },
    geometry: spatial.geometry,
    precision: PRECISIONS[spatial.precision],
    srid: spatial.srid ?? null,
  };
};

const toFields = (dataset: CatalogueDataset): CatalogueFieldContract[] => {
  return dataset.schema.fields.map((field) => {
    return {
      name: field.name,
      description: field.description,
      role: field.role ?? null,
      unit: field.unit ?? null,
      sensitive: field.sensitive === true,
    };
  });
};

/**
 * Derives the gaps a dataset carries from its own metadata. Nothing here is
 * authored: an undocumented dimension is a gap because the catalogue says
 * `unknown`, not because someone remembered to write a note.
 */
const toGapKinds = (dataset: CatalogueDataset): CatalogueGapKind[] => {
  const kinds: CatalogueGapKind[] = [];

  if (dataset.temporal.status === 'unknown') {
    kinds.push('temporalUnknown');
  }
  if (dataset.spatial.status === 'unknown') {
    kinds.push('spatialUnknown');
  }
  if (
    dataset.spatial.status === 'described' &&
    dataset.spatial.precision === 'unknown'
  ) {
    kinds.push('precisionUnknown');
  }
  if (dataset.source.url === null) {
    kinds.push('originUndocumented');
  }

  return kinds;
};

const toDataset = ({
  dataset,
  collection,
}: {
  dataset: CatalogueDataset;
  collection: CatalogueCollection;
}): CatalogueDatasetContract => {
  return {
    id: dataset.id,
    slug: dataset.slug,
    title: dataset.title,
    description: dataset.description,
    format: dataset.format,
    source: {
      title: collection.title,
      description: collection.description,
      tags: collection.tags,
    },
    // Most datasets omit their own publisher and inherit the collection's.
    organization: dataset.source.organization ?? collection.organization,
    originNotes: dataset.source.notes ?? null,
    hasDocumentedOrigin: dataset.source.url !== null,
    temporal: toTemporal(dataset.temporal),
    spatial: toSpatial(dataset.spatial),
    access: {
      level: dataset.access.level,
      containsPersonalData: dataset.access.contains_personal_data,
      notes: dataset.access.notes ?? null,
    },
    volume: toVolume(dataset.stats),
    sizeBytes: numericStat(dataset.stats, 'size_bytes'),
    fields: toFields(dataset),
    gaps: toGapKinds(dataset),
  };
};

/**
 * Transforms the source catalogue into the canonical app contract: redacts the
 * fields the app must never receive, normalizes vocabularies to camelCase,
 * resolves each dataset's publisher, denormalizes its source onto it and derives
 * the gaps it carries.
 *
 * The redaction is structural — origin URLs, repository paths and file
 * checksums have no field in {@link CatalogueContract}, so they cannot reach a
 * component. See the note on that type for the full list.
 *
 * Deterministic: datasets are sorted by title with pt-BR collation, so the
 * rendered page is stable across reads.
 *
 * @param catalogue - The validated source catalogue.
 * @returns The canonical catalogue consumed by `/dados`.
 * @throws If a dataset references a `collection_id` that no collection defines.
 *
 * @example
 * const app = toAppCatalogue(await readStaticDataCatalogue());
 * app.datasets.length; // 12
 * app.datasets[0].source.title; // 'Dados Primários'
 */
export const toAppCatalogue = (catalogue: DataCatalogue): CatalogueContract => {
  const datasets = Object.values(catalogue.datasets)
    .map((dataset) => {
      const collection = catalogue.collections[dataset.collection_id];
      if (collection === undefined) {
        throw new Error(
          `[data-gateway] dataset "${dataset.id}" references unknown collection "${dataset.collection_id}".`
        );
      }
      return toDataset({ dataset, collection });
    })
    .sort(byTitle);

  return {
    meta: {
      title: catalogue.catalog.title,
      description: catalogue.catalog.description,
      status: catalogue.catalog.status,
      updatedAt: catalogue.catalog.updated_at,
      schemaVersion: catalogue.schema_version,
    },
    datasets,
  };
};
