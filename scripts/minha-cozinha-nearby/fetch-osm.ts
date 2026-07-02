// Fetches the surroundings of each sample kitchen from OpenStreetMap via the
// public Overpass API and writes one app-ready GeoJSON per kitchen to
// output/osm/<codigo>.geojson.
//
// Run: node scripts/minha-cozinha-nearby/fetch-osm.ts   (no API key needed)

import {
  CATEGORIES,
  matchOsmElement,
  OSM_TAGS,
} from './crosswalk.ts';
import {
  buildFeature,
  haversineMeters,
  RADIUS_METERS,
  sleep,
  writeCollection,
  type LatLng,
  type NearbyFeature,
} from './geo.ts';
import { KITCHENS, type Kitchen } from './kitchens.ts';

const OVERPASS_URL =
  process.env.OVERPASS_URL ?? 'https://overpass-api.de/api/interpreter';
const ATTRIBUTION = '© OpenStreetMap contributors';

type OverpassElement = {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

/** Builds a single Overpass QL query unioning every crosswalk tag. */
const buildQuery = (lat: number, lon: number): string => {
  const filters = CATEGORIES.flatMap((category) => OSM_TAGS[category]).map(
    (tag) => {
      const [key, value] = tag.split('=');
      return `  nwr["${key}"="${value}"](around:${RADIUS_METERS},${lat},${lon});`;
    }
  );
  return `[out:json][timeout:60];\n(\n${filters.join('\n')}\n);\nout center tags;`;
};

const elementLocation = (element: OverpassElement): LatLng | null => {
  if (typeof element.lat === 'number' && typeof element.lon === 'number') {
    return { latitude: element.lat, longitude: element.lon };
  }
  if (element.center) {
    return { latitude: element.center.lat, longitude: element.center.lon };
  }
  return null;
};

// Light intra-OSM dedup: a POI mapped both as a node and as a building way
// shows up twice. Drop a candidate when a kept feature shares its name within 30 m.
const isDuplicate = (feature: NearbyFeature, kept: NearbyFeature[]): boolean => {
  const name = feature.properties.name?.toLowerCase().trim();
  if (!name) {
    return false;
  }
  return kept.some((other) => {
    if (other.properties.name?.toLowerCase().trim() !== name) {
      return false;
    }
    const distance = haversineMeters(
      {
        latitude: feature.geometry.coordinates[1],
        longitude: feature.geometry.coordinates[0],
      },
      {
        latitude: other.geometry.coordinates[1],
        longitude: other.geometry.coordinates[0],
      }
    );
    return distance <= 30;
  });
};

const fetchKitchen = async (kitchen: Kitchen): Promise<void> => {
  const response = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: {
      // Overpass (Apache/mod_security) answers 406 to requests sent as raw
      // text/plain or without a User-Agent; use the documented form encoding.
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'cozsolidarias-nearby-experiment/1.0',
    },
    body: new URLSearchParams({
      data: buildQuery(kitchen.latitude, kitchen.longitude),
    }).toString(),
  });

  if (!response.ok) {
    throw new Error(
      `Overpass ${response.status} for ${kitchen.codigo}: ${await response.text()}`
    );
  }

  const data = (await response.json()) as { elements: OverpassElement[] };
  const center: LatLng = {
    latitude: kitchen.latitude,
    longitude: kitchen.longitude,
  };

  // Process nodes before ways/relations so the latter dedup against the former.
  const ordered = [...data.elements].sort(
    (a, b) => Number(a.type !== 'node') - Number(b.type !== 'node')
  );

  const features: NearbyFeature[] = [];
  for (const element of ordered) {
    const location = elementLocation(element);
    const match = element.tags ? matchOsmElement(element.tags) : null;
    if (!location || !match) {
      continue;
    }
    const feature = buildFeature({
      id: `osm:${element.type}/${element.id}`,
      name: element.tags?.name ?? null,
      category: match.category,
      sourceType: match.sourceType,
      center,
      location,
    });
    if (feature.properties.distanceMeters > RADIUS_METERS) {
      continue;
    }
    if (isDuplicate(feature, features)) {
      continue;
    }
    features.push(feature);
  }

  features.sort(
    (a, b) => a.properties.distanceMeters - b.properties.distanceMeters
  );

  const path = await writeCollection({
    type: 'FeatureCollection',
    metadata: {
      provider: 'osm',
      cozinhaId: kitchen.codigo,
      center,
      radiusMeters: RADIUS_METERS,
      generatedAt: new Date().toISOString(),
      attribution: ATTRIBUTION,
      truncatedCategories: [],
    },
    features,
  });

  console.log(
    `osm    ${kitchen.codigo} ${kitchen.municipio}/${kitchen.uf}: ${features.length} POIs -> ${path}`
  );
};

const main = async (): Promise<void> => {
  for (const kitchen of KITCHENS) {
    await fetchKitchen(kitchen);
    await sleep(1000);
  }
};

await main();
