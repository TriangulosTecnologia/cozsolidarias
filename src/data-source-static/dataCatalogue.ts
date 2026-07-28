/**
 * Types for the single data catalogue served at `public/dataset_catalogue.json`
 * — the metadata of every dataset the project uses, grouped by institutional
 * source (`collections`) and indexed by id (`datasets`).
 *
 * This is a metadata contract only; the catalogue file itself is authored by
 * hand (and validated against these types). There is intentionally no per-CSV
 * catalogue — a single catalogue describes all datasets.
 *
 * @example
 * const catalogue: DataCatalogue = await fetch('/dataset_catalogue.json').then(
 *   (r) => r.json()
 * );
 * catalogue.datasets['municipios_populacao'].source.url;
 */

/** Access level of a dataset. */
export type CatalogueAccessLevel = 'public' | 'restricted';

/** One field (column/property/map value) of a dataset. */
export type CatalogueField = {
  /** Field name, exactly as it appears in the source (CSV header, JSON key, GeoJSON property). */
  name: string;
  /** Short human description of the field. */
  description: string;
  /** Optional semantic role (e.g. `identifier`, `geometry`). */
  role?: string;
  /** Unit of the value, when numeric (e.g. `pessoas`). */
  unit?: string;
  /** `true` when the field carries personal or otherwise sensitive data. */
  sensitive?: boolean;
};

/**
 * The origin of a dataset.
 *
 * IMPORTANT: `url` is the **public URL of the source from which the data was
 * downloaded** (e.g. an IBGE/MDS API endpoint). NEVER record a local filesystem
 * path (e.g. `C:\Users\me\Downloads\file.csv`) here — that is meaningless to
 * anyone else and leaks your machine layout. Datasets with no public download
 * URL (primary/internal data) set `url: null` and explain the acquisition in
 * `notes`.
 */
export type CatalogueSource = {
  /** Publisher/organization the data came from. */
  organization: string;
  /**
   * Public download URL of the source, or `null` for primary data with no
   * public URL. NEVER a local machine path — see the type-level note above.
   */
  url: string | null;
  /** Free-text notes about the origin (exact endpoint, parameters, caveats). */
  notes?: string;
};

/**
 * Whether a dimension (temporal or spatial) is documented, absent by the
 * nature of the data, or applicable-but-not-yet-documented.
 *
 * - `described` — the dimension is fully documented (all its fields present).
 * - `not_applicable` — the data has no such dimension (e.g. an atemporal
 *   reference lookup has no meaningful time).
 * - `unknown` — the dimension exists but is not documented yet.
 */
export type CatalogueDimensionStatus =
  | 'described'
  | 'not_applicable'
  | 'unknown';

/** How often the source series is (re)published. */
export type CatalogueTemporalFrequency =
  | 'daily'
  | 'monthly'
  | 'annual'
  | 'irregular'
  | 'one_time';

/**
 * How the source series treats its past records over time.
 *
 * - `append_only` — new periods are added; the past is never rewritten.
 * - `overwrite` — each release replaces the previous state.
 * - `revised` — past periods may be corrected retroactively.
 * - `snapshot` — a single point-in-time capture, not an evolving series.
 */
export type CatalogueTemporalHistory =
  | 'append_only'
  | 'overwrite'
  | 'revised'
  | 'snapshot';

/**
 * Time-bearing columns of a dataset, when records are individually
 * timestamped. Supports bitemporal data via `recorded`.
 */
export type CatalogueTemporalField = {
  /** Column holding the start (or single) instant of each record. */
  start: string;
  /** Column holding the end instant of interval records; `null` when open-ended. */
  end?: string | null;
  /** Column holding when the record entered the system (bitemporal second axis). */
  recorded?: string;
};

/**
 * Time dimension of a dataset, discriminated on `status`. A `described`
 * dimension carries its coverage, resolution and cadence; `not_applicable`
 * and `unknown` carry nothing else.
 *
 * @example
 * // Interval records, bitemporal, monthly cadence:
 * const temporal: CatalogueTemporal = {
 *   status: 'described',
 *   extent: [['2008-01-01', null]],
 *   grain: 'P1D',
 *   frequency: 'monthly',
 *   history: 'append_only',
 *   field: { start: 'dt_internacao', end: 'dt_alta', recorded: 'dt_processamento' },
 *   timezone: 'America/Sao_Paulo',
 * };
 * @example
 * // Atemporal reference lookup:
 * const temporal: CatalogueTemporal = { status: 'not_applicable' };
 */
export type CatalogueTemporal =
  | { status: 'not_applicable' | 'unknown' }
  | {
      status: 'described';
      /** Covered intervals as `[start, end]` ISO-8601 dates; a `null` bound is open. */
      extent: Array<[string | null, string | null]>;
      /** Resolution of one record as an ISO-8601 duration (e.g. `P1D`, `P1M`, `P1Y`). */
      grain: string;
      frequency: CatalogueTemporalFrequency;
      history: CatalogueTemporalHistory;
      /** Time-bearing columns; omit for period snapshots with no per-record date. */
      field?: CatalogueTemporalField;
      /** IANA timezone of the timestamps (e.g. `America/Sao_Paulo`). */
      timezone?: string;
    };

/**
 * A coded region against a controlled scheme.
 *
 * @example
 * const brazil: CatalogueSpatialExtent = { scheme: 'iso3166-1', code: 'BR' };
 * const saoPaulo: CatalogueSpatialExtent = { scheme: 'iso3166-2', code: 'BR-SP' };
 */
export type CatalogueSpatialExtent = {
  /** Coding scheme: country (`iso3166-1`) or subdivision (`iso3166-2`). */
  scheme: 'iso3166-1' | 'iso3166-2';
  /** Code within the scheme (e.g. `BR`, `BR-SP`). */
  code: string;
};

/** How completely the dataset fills its declared extent. */
export type CatalogueSpatialCoverage =
  | 'exhaustive'
  | 'partial'
  | 'sample'
  | 'unknown';

/**
 * Geometry family actually stored. A single value; `multipolygon` is the
 * superset used for datasets that mix `Polygon` and `MultiPolygon` features.
 */
export type CatalogueSpatialGeometry =
  | 'none'
  | 'point'
  | 'multipoint'
  | 'line'
  | 'polygon'
  | 'multipolygon'
  | 'geometrycollection';

/**
 * Locational precision of point geometries; `not_applicable` for non-point or
 * geometry-less data.
 */
export type CatalogueSpatialPrecision =
  | 'exact'
  | 'approximate'
  | 'centroid'
  | 'not_applicable'
  | 'unknown';

/** Spatial unit of one record. */
export type CatalogueSpatialGrain = {
  /** `admin` for official administrative units, `custom` for domain entities. */
  scheme: 'admin' | 'custom';
  /** Unit code (e.g. `country`, `state`, `municipality`, `settlement`, `kitchen`). */
  code: string;
  /** Human-readable label (e.g. `município de residência`). */
  label?: string;
};

/**
 * Spatial dimension of a dataset, discriminated on `status`. A `described`
 * dimension carries its extent, unit and (when present) geometry; `srid`
 * appears only when `geometry` is not `none`.
 *
 * @example
 * // Municipal polygons stored in WGS84:
 * const spatial: CatalogueSpatial = {
 *   status: 'described',
 *   extent: [{ scheme: 'iso3166-1', code: 'BR' }],
 *   coverage: 'exhaustive',
 *   grain: { scheme: 'admin', code: 'municipality', label: 'município' },
 *   geometry: 'multipolygon',
 *   precision: 'not_applicable',
 *   srid: 4326,
 *   field: 'codarea',
 * };
 * @example
 * // Administrative key with no geometry:
 * const spatial: CatalogueSpatial = {
 *   status: 'described',
 *   extent: [{ scheme: 'iso3166-1', code: 'BR' }],
 *   coverage: 'exhaustive',
 *   grain: { scheme: 'admin', code: 'municipality', label: 'município' },
 *   geometry: 'none',
 *   precision: 'not_applicable',
 *   field: 'codigoIbge',
 * };
 */
export type CatalogueSpatial =
  | { status: 'not_applicable' | 'unknown' }
  | {
      status: 'described';
      /** Coded regions the data spans. */
      extent: CatalogueSpatialExtent[];
      coverage: CatalogueSpatialCoverage;
      grain: CatalogueSpatialGrain;
      geometry: CatalogueSpatialGeometry;
      precision: CatalogueSpatialPrecision;
      /** EPSG code of the stored coordinates; present only when `geometry` is not `none`. */
      srid?: number;
      /** Column carrying the spatial key or geometry. */
      field: string;
    };

/** Access and sensitivity metadata of a dataset. */
export type CatalogueAccess = {
  /** Whether the dataset may be published openly. */
  level: CatalogueAccessLevel;
  /** `true` when the dataset contains personal data (LGPD-relevant). */
  contains_personal_data: boolean;
  /** Free-text notes about restrictions. */
  notes?: string;
};

/** An institutional source that groups one or more datasets. */
export type CatalogueCollection = {
  id: string;
  slug: string;
  title: string;
  description: string;
  /** Publisher/organization of the collection. */
  organization: string;
  /**
   * Public URL of the institutional source, or `null` for primary data. NEVER a
   * local machine path — see {@link CatalogueSource}.
   */
  source_url: string | null;
  /** Optional public reference/landing page for the source. */
  public_reference_url?: string;
  tags: string[];
};

/** A single dataset entry. */
export type CatalogueDataset = {
  id: string;
  /** Id of the {@link CatalogueCollection} this dataset belongs to. */
  collection_id: string;
  slug: string;
  title: string;
  description: string;
  /** Path of the artifact inside the repo (never an absolute machine path). */
  file: string;
  /** File format (e.g. `CSV`, `JSON`, `GeoJSON`). */
  format: string;
  source: CatalogueSource;
  /** Script that regenerates the file, for derived datasets. */
  generated_by?: string;
  temporal: CatalogueTemporal;
  spatial: CatalogueSpatial;
  access: CatalogueAccess;
  /**
   * Lightweight volume stats (rows/entries/features/size) plus optional string
   * metadata like a `checksum`.
   */
  stats?: Record<string, number | string>;
  schema: { fields: CatalogueField[] };
};

/** A quality caveat about the catalogue or its data. */
export type CatalogueQualityNote = {
  id: string;
  severity: 'low' | 'medium' | 'high';
  message: string;
};

/** Metadata about the catalogue itself. */
export type CatalogueMeta = {
  id: string;
  title: string;
  description: string;
  language: string;
  status: string;
  created_at: string;
  updated_at: string;
  /** Repo path of these TypeScript types. */
  typing_reference: string;
  quality_notes: CatalogueQualityNote[];
};

/** The whole data catalogue (`public/dataset_catalogue.json`). */
export type DataCatalogue = {
  schema_version: string;
  catalog: CatalogueMeta;
  /** Institutional sources, keyed by collection id. */
  collections: Record<string, CatalogueCollection>;
  /** Datasets, keyed by dataset id. */
  datasets: Record<string, CatalogueDataset>;
};
