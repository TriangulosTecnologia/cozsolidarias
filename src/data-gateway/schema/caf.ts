/**
 * Canonical GeoJSON shapes for CAF (Cadastro Ambiental Rural) area locations
 * consumed by the app/map.
 *
 * Each feature carries its CAF number as `properties.nrCaf`. The map source
 * promotes that property to the MapLibre `feature.id` (`promoteId: 'nrCaf'`,
 * wired via a `mapData` join in `geovisSpec`), so a hover reports it as
 * `MapHoverInfo.featureId` and feeds into the tooltip lookup.
 * The id lives in `properties` (not the top-level GeoJSON `id`) because
 * MapLibre feature ids must be numeric unless promoted from a property.
 */

/** Properties carried by each CAF point feature, used directly in the hover tooltip. */
export type CafAreaProperties = {
  /** CAF registration number; promoted to `feature.id` for tooltip lookup. */
  nrCaf: string;
  /** Area type (e.g. `"Terra"`). */
  dsTipoArea: string;
  /** Unit of measure (e.g. `"ha"`). */
  dsTipoUnidadeMedida: string;
  /** Area size in the declared unit. */
  nrArea: number;
  /** Municipality name. */
  nmMunicipio: string;
  /** State abbreviation (UF). */
  sgUf: string;
  /** Location type (e.g. `"Rural"`). */
  dsTipoLocalizacaoArea: string;
  /** Domain condition (e.g. `"Proprietário"`, `"Comodatário"`). */
  dsCondicaoDominio: string;
  /** Whether this is the main property (`"true"` / `"false"`). */
  stImovelPrincipal: string;
};

/** A single CAF area location as a GeoJSON Point feature. */
export type CafAreaFeature = {
  type: 'Feature';
  geometry: {
    type: 'Point';
    /** GeoJSON order: `[longitude, latitude]`. */
    coordinates: [number, number];
  };
  properties: CafAreaProperties;
};

/** Collection of CAF area locations, ready to feed a GeoJSON map source. */
export type CafsFeatureCollection = {
  type: 'FeatureCollection';
  features: CafAreaFeature[];
};

/** A single production/income item for a CAF property. */
export type CafProducaoItem = {
  /** Income category (e.g. `"RENDA DO ESTABELECIMENTO AGROPECUÁRIO"`). */
  categoriaRenda: string;
  /** Income type within the category (e.g. `"Lavouras Permanentes"`). */
  dsTipoRenda: string;
  /** Product or generating activity (e.g. `"Outras Frutas Lavoura Permanente"`). */
  dsProduto: string;
  /** Actual income obtained, in BRL. `null` when not reported. */
  vlRendaAuferida: number | null;
  /** Estimated income, in BRL. `null` when not reported. */
  vlRendaEstimada: number | null;
};

/**
 * Detail returned by `GET /api/cafs/[nrCaf]`. Contains the production and
 * income items linked to the CAF registration number. An empty `producao`
 * array means no data is available for that CAF.
 */
export type CafDetalhe = {
  /** CAF registration number, matching the point's `feature.id`. */
  nrCaf: string;
  /** All production and income items for this CAF. */
  producao: CafProducaoItem[];
};
