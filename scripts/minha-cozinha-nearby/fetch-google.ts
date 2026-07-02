// Fetches the surroundings of each sample kitchen from Google Places (New)
// Nearby Search and writes one app-ready GeoJSON per kitchen to
// output/google/<codigo>.geojson.
//
// Requires a key. Run:
//   node --env-file=scripts/minha-cozinha-nearby/.env.local scripts/minha-cozinha-nearby/fetch-google.ts
//
// NOTE (licence): Google Places content (except place_id) must not be cached,
// stored long-term or published. output/google/ is gitignored and this is a
// local, throwaway comparison only.

import {
  CATEGORIES,
  GOOGLE_TYPES,
  googlePlaceToCategory,
  type NearbyCategory,
} from './crosswalk.ts';
import {
  buildFeature,
  RADIUS_METERS,
  sleep,
  writeCollection,
  type LatLng,
  type NearbyFeature,
} from './geo.ts';
import { KITCHENS, type Kitchen } from './kitchens.ts';

const API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const ENDPOINT = 'https://places.googleapis.com/v1/places:searchNearby';
const ATTRIBUTION = 'Google Maps';
const FIELD_MASK =
  'places.id,places.displayName,places.location,places.primaryType,places.types';

type GooglePlace = {
  id: string;
  displayName?: { text: string };
  location?: { latitude: number; longitude: number };
  primaryType?: string;
  types?: string[];
};

/** One Nearby Search request per category (works around the 20-result cap). */
const searchCategory = async (
  kitchen: Kitchen,
  category: NearbyCategory
): Promise<GooglePlace[]> => {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY ?? '',
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify({
      includedTypes: GOOGLE_TYPES[category],
      maxResultCount: 20,
      rankPreference: 'DISTANCE',
      languageCode: 'pt-BR',
      regionCode: 'BR',
      locationRestriction: {
        circle: {
          center: { latitude: kitchen.latitude, longitude: kitchen.longitude },
          radius: RADIUS_METERS,
        },
      },
    }),
  });

  if (!response.ok) {
    // Log and continue: one rejected category (e.g. a non-filterable type)
    // should not abort the whole run.
    console.warn(
      `google ${kitchen.codigo} ${category}: ${response.status} ${await response.text()}`
    );
    return [];
  }

  const data = (await response.json()) as { places?: GooglePlace[] };
  return data.places ?? [];
};

const fetchKitchen = async (kitchen: Kitchen): Promise<void> => {
  const center: LatLng = {
    latitude: kitchen.latitude,
    longitude: kitchen.longitude,
  };
  const seen = new Set<string>();
  const features: NearbyFeature[] = [];
  const truncatedCategories: NearbyCategory[] = [];

  for (const category of CATEGORIES) {
    const places = await searchCategory(kitchen, category);
    // 20 results means the cap was hit — the count is a floor, not exact.
    if (places.length >= 20) {
      truncatedCategories.push(category);
    }
    for (const place of places) {
      if (!place.location || seen.has(place.id)) {
        continue;
      }
      seen.add(place.id);
      features.push(
        buildFeature({
          id: place.id,
          name: place.displayName?.text ?? null,
          category:
            googlePlaceToCategory(place.primaryType, place.types ?? []) ??
            category,
          sourceType: place.primaryType ?? place.types?.[0] ?? category,
          center,
          location: place.location,
        })
      );
    }
    await sleep(200);
  }

  features.sort(
    (a, b) => a.properties.distanceMeters - b.properties.distanceMeters
  );

  const path = await writeCollection({
    type: 'FeatureCollection',
    metadata: {
      provider: 'google',
      cozinhaId: kitchen.codigo,
      center,
      radiusMeters: RADIUS_METERS,
      generatedAt: new Date().toISOString(),
      attribution: ATTRIBUTION,
      truncatedCategories,
    },
    features,
  });

  const truncatedNote = truncatedCategories.length
    ? ` (truncated: ${truncatedCategories.join(', ')})`
    : '';
  console.log(
    `google ${kitchen.codigo} ${kitchen.municipio}/${kitchen.uf}: ${features.length} POIs${truncatedNote} -> ${path}`
  );
};

const main = async (): Promise<void> => {
  if (!API_KEY) {
    throw new Error(
      'GOOGLE_MAPS_API_KEY is not set. Copy .env.example to .env.local, then run with ' +
        '`node --env-file=scripts/minha-cozinha-nearby/.env.local scripts/minha-cozinha-nearby/fetch-google.ts`.'
    );
  }
  for (const kitchen of KITCHENS) {
    await fetchKitchen(kitchen);
  }
};

await main();
