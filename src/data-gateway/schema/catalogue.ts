/**
 * Canonical shape of the data catalogue — the app-facing view of
 * `public/dataset_catalogue.json`, served by `gateway.getCatalogue()` and
 * rendered by `/dados`.
 *
 * This contract is deliberately **narrower** than the source catalogue. Three
 * families of source fields are absent by design, so no component can leak
 * them:
 *
 * - **Origin URLs** — `source.url`, `collection.source_url` and
 *   `public_reference_url`. Some point at internal artifacts (a spreadsheet
 *   holding personal data), so none are carried. `organization` and
 *   `originNotes` preserve the provenance that matters, and
 *   {@link CatalogueDatasetContract.hasDocumentedOrigin} still records whether
 *   an origin was documented at all.
 * - **Repository paths** — `file`, `generated_by`, `catalog.typing_reference`.
 * - **File fingerprints** — `stats.checkSum`.
 *
 * Vocabularies are normalized to the repository's camelCase convention
 * (`not_applicable` → `notApplicable`, `one_time` → `oneTime`,
 * `append_only` → `appendOnly`). Values stay codes, not prose: user-facing
 * pt-BR wording belongs to the app layer.
 */

/** Severity of an authored caveat about the catalogue. */
export type CatalogueNoteSeverity = 'low' | 'medium' | 'high';

/** Whether a dataset may be published openly. */
export type CatalogueAccessLevelContract = 'public' | 'restricted';

/** How often the source series is (re)published. */
export type CatalogueFrequencyContract =
  | 'daily'
  | 'monthly'
  | 'annual'
  | 'irregular'
  | 'oneTime';

/** How the source series treats its past records over time. */
export type CatalogueHistoryContract =
  | 'appendOnly'
  | 'overwrite'
  | 'revised'
  | 'snapshot';

/** How completely a dataset fills its declared spatial extent. */
export type CatalogueCoverageContract =
  | 'exhaustive'
  | 'partial'
  | 'sample'
  | 'unknown';

/** Geometry family actually stored. */
export type CatalogueGeometryContract =
  | 'none'
  | 'point'
  | 'multipoint'
  | 'line'
  | 'polygon'
  | 'multipolygon'
  | 'geometrycollection';

/** Locational precision of point geometries. */
export type CataloguePrecisionContract =
  | 'exact'
  | 'approximate'
  | 'centroid'
  | 'notApplicable'
  | 'unknown';

/**
 * A documented gap in the catalogue, derived from the metadata itself rather
 * than authored by hand — so the page's "lacunas" section ages with the JSON.
 *
 * - `temporalUnknown` — the dataset has a time dimension that is not documented.
 * - `spatialUnknown` — the dataset has a spatial dimension that is not documented.
 * - `precisionUnknown` — point coordinates whose locational precision is unknown.
 * - `originUndocumented` — no origin URL was recorded for the dataset.
 */
export type CatalogueGapKind =
  | 'temporalUnknown'
  | 'spatialUnknown'
  | 'precisionUnknown'
  | 'originUndocumented';

/** One derived gap, attributed to the dataset that carries it. */
export type CatalogueGapContract = {
  datasetId: string;
  datasetTitle: string;
  /** Slug of the owning collection, for anchoring a link to the dataset. */
  collectionSlug: string;
  kind: CatalogueGapKind;
};

/** An authored caveat about the catalogue or its data. */
export type CatalogueNoteContract = {
  id: string;
  severity: CatalogueNoteSeverity;
  message: string;
};

/** Metadata about the catalogue itself. */
export type CatalogueMetaContract = {
  title: string;
  description: string;
  /** Lifecycle of the catalogue as authored (e.g. `draft`). */
  status: string;
  /** ISO-8601 date (`YYYY-MM-DD`) the catalogue was last edited. */
  updatedAt: string;
  /** Version of the catalogue's own schema (e.g. `2.0.0`). */
  schemaVersion: string;
  qualityNotes: CatalogueNoteContract[];
};

/**
 * Headline counts derived from the catalogue, for the page's summary strip.
 * Every value is computed — none is authored — so the strip cannot drift from
 * the datasets it describes.
 */
export type CatalogueSummaryContract = {
  datasetCount: number;
  collectionCount: number;
  /** Total documented fields across every dataset's data dictionary. */
  fieldCount: number;
  /** Fields flagged as carrying personal or otherwise sensitive data. */
  sensitiveFieldCount: number;
  restrictedDatasetCount: number;
  /** Distinct file formats present, sorted (e.g. `['CSV', 'GeoJSON', 'JSON']`). */
  formats: string[];
};

/** One field (column/property/map value) of a dataset's data dictionary. */
export type CatalogueFieldContract = {
  /** Field name exactly as it appears in the source. */
  name: string;
  description: string;
  /** Semantic role (`identifier`, `geometry`, `join`), or `null` when unstated. */
  role: string | null;
  /** Unit of the value (`pessoas`, `hectare`, `BRL`), or `null` when unstated. */
  unit: string | null;
  /** `true` when the field carries personal or otherwise sensitive data. */
  sensitive: boolean;
};

/** Time dimension of a dataset, discriminated on `status`. */
export type CatalogueTemporalContract =
  | { status: 'notApplicable' | 'unknown' }
  | {
      status: 'described';
      /** Covered intervals; a `null` bound is open-ended. */
      extent: Array<{ start: string | null; end: string | null }>;
      /** Resolution of one record as an ISO-8601 duration (e.g. `P1Y`). */
      grain: string;
      frequency: CatalogueFrequencyContract;
      history: CatalogueHistoryContract;
    };

/** Spatial dimension of a dataset, discriminated on `status`. */
export type CatalogueSpatialContract =
  | { status: 'notApplicable' | 'unknown' }
  | {
      status: 'described';
      /** Coded regions the data spans (e.g. `BR`, `BR-SP`). */
      extent: Array<{ scheme: 'iso3166-1' | 'iso3166-2'; code: string }>;
      coverage: CatalogueCoverageContract;
      /** Spatial unit of one record; `label` falls back to `null` when unstated. */
      grain: { code: string; label: string | null };
      geometry: CatalogueGeometryContract;
      precision: CataloguePrecisionContract;
      /** EPSG code of the stored coordinates; `null` when there is no geometry. */
      srid: number | null;
    };

/** Volume of a dataset, in the unit its format counts in. */
export type CatalogueVolumeContract = {
  /** Which unit the count is in: CSV rows, JSON entries or GeoJSON features. */
  kind: 'rows' | 'entries' | 'features';
  count: number;
};

/** A single dataset entry, with its metadata and data dictionary. */
export type CatalogueDatasetContract = {
  id: string;
  slug: string;
  title: string;
  description: string;
  /** File format as authored (e.g. `CSV`, `JSON`, `GeoJSON`). */
  format: string;
  /**
   * Publisher of the data. Resolved from the dataset's own `source.organization`
   * when present, falling back to the owning collection's — most datasets omit
   * their own and inherit it.
   */
  organization: string;
  /** Free-text notes about the origin (exact aggregate, parameters, caveats). */
  originNotes: string | null;
  /**
   * Whether an origin URL was recorded for the dataset. The URL itself is never
   * carried (see the module note) — and a recorded origin is not necessarily a
   * *public* one, so this asserts only that provenance was documented, which is
   * what the "lacunas" section reports on.
   */
  hasDocumentedOrigin: boolean;
  temporal: CatalogueTemporalContract;
  spatial: CatalogueSpatialContract;
  access: {
    level: CatalogueAccessLevelContract;
    containsPersonalData: boolean;
    notes: string | null;
  };
  /** Volume, or `null` when the catalogue records no countable stat. */
  volume: CatalogueVolumeContract | null;
  /** On-disk size, or `null` when unrecorded. */
  sizeBytes: number | null;
  fields: CatalogueFieldContract[];
  /** Gaps this dataset carries, derived from its own metadata. */
  gaps: CatalogueGapKind[];
};

/** An institutional source with the datasets it publishes. */
export type CatalogueCollectionContract = {
  id: string;
  /** URL-safe slug, used as the section anchor on `/dados`. */
  slug: string;
  title: string;
  description: string;
  organization: string;
  tags: string[];
  /** Datasets of this collection, sorted by title (pt-BR collation). */
  datasets: CatalogueDatasetContract[];
};

/**
 * The whole app-facing catalogue: metadata about the catalogue, derived summary
 * counts, the collections with their nested datasets, and every derived gap
 * flattened for the "lacunas" section.
 */
export type CatalogueContract = {
  meta: CatalogueMetaContract;
  summary: CatalogueSummaryContract;
  /** Collections sorted by title (pt-BR collation). */
  collections: CatalogueCollectionContract[];
  /** Every dataset gap, in collection then dataset order. */
  gaps: CatalogueGapContract[];
};
