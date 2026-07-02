// The category crosswalk: maps each domain category to the native identifiers
// of each provider (OSM tags / Google Places "New" types). CRAS is intentionally
// left out of `assistencia` — neither API classifies it reliably; it will come
// later from an official MDS dataset.

/** Domain category for a nearby point of interest. */
export type NearbyCategory =
  | 'abastecimento'
  | 'assistencia'
  | 'saude'
  | 'educacao'
  | 'transporte';

/** Categories in display order. */
export const CATEGORIES: NearbyCategory[] = [
  'abastecimento',
  'assistencia',
  'saude',
  'educacao',
  'transporte',
];

/** OSM tag filters (`key=value`) that map to each category. */
export const OSM_TAGS: Record<NearbyCategory, string[]> = {
  abastecimento: [
    'shop=supermarket',
    'shop=convenience',
    'shop=greengrocer',
    'shop=butcher',
    'shop=bakery',
    'amenity=marketplace',
  ],
  assistencia: [
    'amenity=social_facility',
    'amenity=community_centre',
    'amenity=place_of_worship',
    'office=government',
  ],
  saude: [
    'amenity=hospital',
    'amenity=clinic',
    'amenity=doctors',
    'amenity=pharmacy',
    'healthcare=centre',
  ],
  educacao: [
    'amenity=school',
    'amenity=kindergarten',
    'amenity=college',
    'amenity=university',
  ],
  transporte: [
    'highway=bus_stop',
    'public_transport=platform',
    'railway=station',
    'station=subway',
  ],
};

/** Google Places (New) Table A place types that map to each category. */
export const GOOGLE_TYPES: Record<NearbyCategory, string[]> = {
  abastecimento: [
    'supermarket',
    'grocery_store',
    'convenience_store',
    'market',
    'bakery',
    'butcher_shop',
  ],
  assistencia: ['local_government_office', 'community_center', 'government_office'],
  saude: ['hospital', 'medical_clinic', 'doctor', 'pharmacy'],
  educacao: ['school', 'primary_school', 'secondary_school', 'preschool'],
  transporte: ['bus_station', 'transit_station', 'train_station', 'subway_station'],
};

/**
 * Finds the first category whose tag list matches an OSM element's tags,
 * returning that category and the concrete `key=value` that matched.
 */
export const matchOsmElement = (
  tags: Record<string, string>
): { category: NearbyCategory; sourceType: string } | null => {
  for (const category of CATEGORIES) {
    for (const tag of OSM_TAGS[category]) {
      const [key, value] = tag.split('=');
      if (tags[key] === value) {
        return { category, sourceType: tag };
      }
    }
  }
  return null;
};

// The generic government bucket (assistencia) is resolved LAST so that public
// schools/clinics — which also carry government types in `types` — land in
// educacao/saude instead of being shadowed by assistencia.
const CATEGORY_RESOLUTION_ORDER: NearbyCategory[] = [
  'abastecimento',
  'saude',
  'educacao',
  'transporte',
  'assistencia',
];

/**
 * Resolves a Google place to a domain category, preferring the single
 * `primaryType` (Google's best signal) and only then scanning all `types`,
 * both in specificity order. Returns null when nothing matches.
 */
export const googlePlaceToCategory = (
  primaryType: string | undefined,
  types: string[]
): NearbyCategory | null => {
  if (primaryType) {
    for (const category of CATEGORY_RESOLUTION_ORDER) {
      if (GOOGLE_TYPES[category].includes(primaryType)) {
        return category;
      }
    }
  }
  for (const category of CATEGORY_RESOLUTION_ORDER) {
    if (GOOGLE_TYPES[category].some((type) => types.includes(type))) {
      return category;
    }
  }
  return null;
};
