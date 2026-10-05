/**
 * Canonical shape of the data catalogue — the app-facing view of
 * `public/dataset_catalogue.json`, served by `gateway.getCatalogue()` and
 * rendered by `/dados`.
 *
 * This contract is deliberately **narrower** than the source catalogue. Three
 * families of source fields are omitted because `/dados` does not render them,
 * which keeps the app contract to what the page uses:
 *
 * - **Origin URLs** — `source.url`, `collection.source_url` and
 *   `public_reference_url`. `organization` and `originNotes` carry the
 *   provenance the page shows, and
 *   {@link CatalogueDatasetContract.hasDocumentedOrigin} still records whether
 *   an origin was documented at all.
 * - **Repository paths** — `file`, `generated_by`, `catalog.typing_reference`.
 * - **File checksums** — `stats.checkSum`.
 *
 * The omission is scope, not secrecy: the source catalogue is itself public
 * (served verbatim at `/dataset_catalogue.json`), so this contract is not a
 * boundary that keeps those fields from anyone.
 *
 * Vocabularies are normalized to the repository's camelCase convention
 * (`not_applicable` → `notApplicable`, `one_time` → `oneTime`,
 * `append_only` → `appendOnly`). Values stay codes, not prose: user-facing
 * pt-BR wording belongs to the app layer.
 */

/**
 * Whether a dataset may be published openly.
 *
 * @example
 * const level: CatalogueAccessLevelContract = 'public';
 */
export type CatalogueAccessLevelContract = 'public' | 'restricted';

/**
 * How often the source series is (re)published.
 *
 * @example
 * const frequency: CatalogueFrequencyContract = 'oneTime'; // source `one_time`
 */
export type CatalogueFrequencyContract =
  | 'daily'
  | 'monthly'
  | 'annual'
  | 'irregular'
  | 'oneTime';

/**
 * How the source series treats its past records over time.
 *
 * @example
 * const history: CatalogueHistoryContract = 'appendOnly'; // source `append_only`
 */
export type CatalogueHistoryContract =
  | 'appendOnly'
  | 'overwrite'
  | 'revised'
  | 'snapshot';

/**
 * How completely a dataset fills its declared spatial extent.
 *
 * @example
 * const coverage: CatalogueCoverageContract = 'exhaustive';
 */
export type CatalogueCoverageContract =
  | 'exhaustive'
  | 'partial'
  | 'sample'
  | 'unknown';

/**
 * Geometry family actually stored.
 *
 * @example
 * const geometry: CatalogueGeometryContract = 'multipolygon';
 */
export type CatalogueGeometryContract =
  | 'none'
  | 'point'
  | 'multipoint'
  | 'line'
  | 'polygon'
  | 'multipolygon'
  | 'geometrycollection';

/**
 * Locational precision of point geometries.
 *
 * @example
 * const precision: CataloguePrecisionContract = 'notApplicable'; // source `not_applicable`
 */
export type CataloguePrecisionContract =
  | 'exact'
  | 'approximate'
  | 'centroid'
  | 'notApplicable'
  | 'unknown';

/**
 * A gap a dataset carries, derived from its own metadata rather than authored by
 * hand — so an undocumented dimension surfaces without anyone writing a note.
 *
 * - `temporalUnknown` — the dataset has a time dimension that is not documented.
 * - `spatialUnknown` — the dataset has a spatial dimension that is not documented.
 * - `precisionUnknown` — point coordinates whose locational precision is unknown.
 * - `originUndocumented` — no origin URL was recorded for the dataset.
 *
 * @example
 * const gaps: CatalogueGapKind[] = ['spatialUnknown', 'originUndocumented'];
 */
export type CatalogueGapKind =
  | 'temporalUnknown'
  | 'spatialUnknown'
  | 'precisionUnknown'
  | 'originUndocumented';

/**
 * Metadata about the catalogue itself.
 *
 * @example
 * const meta: CatalogueMetaContract = {
 *   title: 'Catálogo de Dados — Cozinhas Solidárias',
 *   description: 'Catálogo único com os metadados de todos os datasets…',
 *   status: 'draft',
 *   updatedAt: '2026-08-14',
 *   schemaVersion: '2.0.0',
 * };
 */
export type CatalogueMetaContract = {
  title: string;
  description: string;
  /** Lifecycle of the catalogue as authored (e.g. `draft`). */
  status: string;
  /** ISO-8601 date (`YYYY-MM-DD`) the catalogue was last edited. */
  updatedAt: string;
  /** Version of the catalogue's own schema (e.g. `2.0.0`). */
  schemaVersion: string;
};

/**
 * The institutional source a dataset belongs to, denormalized onto the dataset.
 * The catalogue holds a dozen datasets across six sources, so repeating the
 * source beats making every consumer join on an id.
 *
 * @example
 * const source: CatalogueSourceContract = {
 *   title: 'IPEA',
 *   description: 'Datasets socioeconômicos do Instituto de Pesquisa Econômica Aplicada…',
 *   tags: ['ipea', 'ivs', 'municipios'],
 * };
 */
export type CatalogueSourceContract = {
  /** Short name of the source (e.g. `IBGE`, `SICAR`, `Dados Primários`). */
  title: string;
  description: string;
  tags: string[];
};

/**
 * One field (column/property/map value) of a dataset's data dictionary.
 *
 * @example
 * const field: CatalogueFieldContract = {
 *   name: 'municipio',
 *   description: 'Código IBGE do município (7 dígitos), chave de join com o mapa',
 *   role: 'identifier',
 *   unit: null,
 *   sensitive: false,
 * };
 */
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

/**
 * Time dimension of a dataset, discriminated on `status`.
 *
 * @example
 * const unknown: CatalogueTemporalContract = { status: 'unknown' };
 * const described: CatalogueTemporalContract = {
 *   status: 'described',
 *   extent: [{ start: '2010-01-01', end: '2010-12-31' }],
 *   grain: 'P1Y',
 *   frequency: 'oneTime',
 *   history: 'snapshot',
 * };
 */
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

/**
 * Spatial dimension of a dataset, discriminated on `status`.
 *
 * @example
 * const notApplicable: CatalogueSpatialContract = { status: 'notApplicable' };
 * const described: CatalogueSpatialContract = {
 *   status: 'described',
 *   extent: [{ scheme: 'iso3166-1', code: 'BR' }],
 *   coverage: 'exhaustive',
 *   grain: { code: 'municipality', label: 'município' },
 *   geometry: 'none',
 *   precision: 'notApplicable',
 *   srid: null,
 * };
 */
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

/**
 * Volume of a dataset, in the unit its format counts in.
 *
 * @example
 * const volume: CatalogueVolumeContract = { kind: 'rows', count: 5565 };
 */
export type CatalogueVolumeContract = {
  /** Which unit the count is in: CSV rows, JSON entries or GeoJSON features. */
  kind: 'rows' | 'entries' | 'features';
  count: number;
};

/**
 * A single dataset entry, with its metadata and data dictionary.
 *
 * @example
 * const dataset: CatalogueDatasetContract = {
 *   id: 'municipios_ivs',
 *   slug: 'municipios-ivs',
 *   title: 'Índice de Vulnerabilidade Social por município (Atlas IVS, 2010)',
 *   description: 'Todos os 5.565 municípios do Brasil com o IVS…',
 *   format: 'CSV',
 *   source: { title: 'IPEA', description: 'Datasets socioeconômicos…', tags: ['ipea'] },
 *   organization: 'Instituto de Pesquisa Econômica Aplicada (IPEA)',
 *   originNotes: 'Extraído de `atlasivs_dadosbrutos_pt_v2.xlsx`…',
 *   hasDocumentedOrigin: true,
 *   temporal: {
 *     status: 'described',
 *     extent: [{ start: '2010-01-01', end: '2010-12-31' }],
 *     grain: 'P1Y',
 *     frequency: 'oneTime',
 *     history: 'snapshot',
 *   },
 *   spatial: {
 *     status: 'described',
 *     extent: [{ scheme: 'iso3166-1', code: 'BR' }],
 *     coverage: 'exhaustive',
 *     grain: { code: 'municipality', label: 'município' },
 *     geometry: 'none',
 *     precision: 'notApplicable',
 *     srid: null,
 *   },
 *   access: { level: 'public', containsPersonalData: false, notes: null },
 *   volume: { kind: 'rows', count: 5565 },
 *   sizeBytes: 693907,
 *   fields: [], // one CatalogueFieldContract per source column (12 here)
 *   gaps: [], // both dimensions described and an origin URL recorded
 * };
 */
export type CatalogueDatasetContract = {
  id: string;
  slug: string;
  title: string;
  description: string;
  /** File format as authored (e.g. `CSV`, `JSON`, `GeoJSON`). */
  format: string;
  /** The institutional source this dataset belongs to. */
  source: CatalogueSourceContract;
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
   * *public* one, so this asserts only that provenance was documented.
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

/**
 * The whole app-facing catalogue: metadata about the catalogue itself plus one
 * flat list of datasets, each carrying its source. Flat because `/dados` renders
 * a single grid — there is no grouping level left for a nested shape to serve.
 *
 * @example
 * const catalogue: CatalogueContract = await gateway.getCatalogue();
 * catalogue.meta.schemaVersion; // '2.0.0'
 * catalogue.datasets.map((dataset) => dataset.title); // sorted, pt-BR collation
 */
export type CatalogueContract = {
  meta: CatalogueMetaContract;
  /** Every dataset, sorted by title (pt-BR collation). */
  datasets: CatalogueDatasetContract[];
};
