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

/** Time coverage of a dataset. */
export type CatalogueTemporal = {
  /** Reference period of the data (e.g. `2022`, `2026-06`), or `null` if unknown. */
  reference_period: string | null;
  /** ISO date the snapshot was downloaded/generated, or `null` if unknown. */
  retrieved_at: string | null;
};

/** Spatial coverage of a dataset. */
export type CatalogueSpatial = {
  /** Geographic extent (e.g. `Brasil`). */
  coverage: string;
  /** Unit of analysis (e.g. `município`, `cozinha (ponto)`). */
  unit: string;
  /** Join/primary key field name. */
  key: string;
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
  /** Lightweight volume stats (rows/entries/features/size). */
  stats?: Record<string, number>;
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
