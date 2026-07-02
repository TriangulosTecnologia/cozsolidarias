/**
 * Canonical shapes for the "what's around a cozinha" analysis used by the
 * Minha Cozinha page. One provider (OSM or Google) produces one result set;
 * both fill this exact shape so the UI toggle is a display concern, not a
 * structural one. The collection is GeoJSON, servable straight to
 * `@ttoss/geovis` (like `/api/cozinhas`).
 */

/** Which content provider produced a result. A domain choice, NOT `DATA_SOURCE`. */
export type NearbyProvider = 'osm' | 'google';

/**
 * Domain categories in display order — the single source of truth from which
 * {@link NearbyCategory} and the runtime guards are derived. CRAS is not
 * modelled yet (no reliable API classification).
 *
 * @example
 * NEARBY_CATEGORIES.includes('saude'); // true
 */
export const NEARBY_CATEGORIES = [
  'abastecimento',
  'assistencia',
  'saude',
  'educacao',
  'transporte',
] as const;

/** Domain category of a nearby point of interest (normalized via the crosswalk). */
export type NearbyCategory = (typeof NEARBY_CATEGORIES)[number];

/**
 * Concentric ring radii in metres — the single source from which
 * {@link NearbyRing} and the runtime guards are derived.
 *
 * @example
 * NEARBY_RINGS[0]; // 500
 */
export const NEARBY_RINGS = [500, 1500, 3000] as const;

/** Concentric ring (metres from the kitchen) a POI falls into. */
export type NearbyRing = (typeof NEARBY_RINGS)[number];

/**
 * A cozinha that has a nearby snapshot available, with the identity/location
 * fields the Minha Cozinha page needs. Identity strings come straight from the
 * source CSV and may be empty when the source left them blank.
 *
 * @example
 * const kitchen: NearbyKitchen = {
 *   codigo: 'CS014558',
 *   nome: 'Casa da Tia Grazi',
 *   municipio: 'Porto Alegre',
 *   uf: 'RS',
 *   latitude: -30.06995,
 *   longitude: -51.22246,
 *   situacao: 'Habilitada',
 *   emFuncionamento: 'Sim',
 *   diasFuncionamento: '5',
 *   bairro: 'Santa Tereza',
 *   endereco: 'Rua Corrêa Lima, 1200',
 *   publicoAtendido: 'Pessoas em situação de rua; idosos',
 *   publicoTotalAtendido: '200',
 * };
 */
export type NearbyKitchen = {
  codigo: string;
  nome: string;
  municipio: string;
  uf: string;
  latitude: number;
  longitude: number;
  /** Programme status (e.g. `Habilitada`); empty when unknown. */
  situacao: string;
  /** Whether the kitchen is currently operating (source's free text). */
  emFuncionamento: string;
  /** Days per week it operates (source's free text). */
  diasFuncionamento: string;
  bairro: string;
  endereco: string;
  /** Vulnerable groups served (source's free text). */
  publicoAtendido: string;
  /** Total people served (source's free text). */
  publicoTotalAtendido: string;
};

/**
 * A single nearby POI as a GeoJSON Point feature.
 *
 * @example
 * const feature: NearbyPlaceFeature = {
 *   type: 'Feature',
 *   geometry: { type: 'Point', coordinates: [-51.2245, -30.0696] },
 *   properties: {
 *     id: 'osm:way/235551629',
 *     name: 'Supermercado Frare',
 *     category: 'abastecimento',
 *     sourceType: 'shop=supermarket',
 *     distanceMeters: 199,
 *     ring: 500,
 *   },
 * };
 */
export type NearbyPlaceFeature = {
  type: 'Feature';
  /** GeoJSON order: `[longitude, latitude]`. */
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: {
    /** Provider-namespaced id. OSM: `osm:<type>/<id>`; Google: the `place_id`. */
    id: string;
    /** Display name, or `null` when the source has none. */
    name: string | null;
    category: NearbyCategory;
    /** Native type/tag that matched (e.g. `shop=supermarket`, `supermarket`). */
    sourceType: string;
    /** Great-circle distance from the kitchen, in metres. */
    distanceMeters: number;
    ring: NearbyRing;
  };
};

/** Provenance for one result set. */
export type NearbyPlacesMetadata = {
  provider: NearbyProvider;
  /** Kitchen code the set is centred on (e.g. `CS014558`). */
  cozinhaId: string;
  center: { latitude: number; longitude: number };
  /** Query radius used to build the snapshot, in metres. */
  radiusMeters: number;
  /** ISO date the snapshot was fetched. */
  generatedAt: string;
  /** Required attribution string, shown in the UI. */
  attribution: string;
  /**
   * Categories where the provider hit its result cap (Google's 20/req), so
   * counts are a floor, not exact. Empty for OSM.
   */
  truncatedCategories: NearbyCategory[];
};

/**
 * Full nearby result for one cozinha under one provider — a GeoJSON
 * `FeatureCollection` with a `metadata` member (maps ignore the extra key).
 *
 * @example
 * const result: NearbyPlacesContract = {
 *   type: 'FeatureCollection',
 *   metadata: {
 *     provider: 'osm',
 *     cozinhaId: 'CS014558',
 *     center: { latitude: -30.06995, longitude: -51.22246 },
 *     radiusMeters: 3000,
 *     generatedAt: '2026-07-02T04:46:46.180Z',
 *     attribution: '© OpenStreetMap contributors',
 *     truncatedCategories: [],
 *   },
 *   features: [],
 * };
 */
export type NearbyPlacesContract = {
  type: 'FeatureCollection';
  metadata: NearbyPlacesMetadata;
  features: NearbyPlaceFeature[];
};
