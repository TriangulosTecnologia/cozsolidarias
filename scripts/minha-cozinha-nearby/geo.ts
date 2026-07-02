// Geometry helpers + the app-ready GeoJSON shapes both fetchers emit.
// A FeatureCollection of Points, servable straight to @ttoss/geovis (same as
// /api/cozinhas). Distance and ring are precomputed here so the app renders
// without recomputing anything at request time.

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { NearbyCategory } from './crosswalk.ts';

/** Radius used for the API fetch. The 500/1500/3000 rings are drawn in the app. */
export const RADIUS_METERS = 3000;

/** Concentric ring a POI falls into, by distance from the kitchen. */
export type Ring = 500 | 1500 | 3000;

export type LatLng = { latitude: number; longitude: number };

/** Great-circle distance in metres between two coordinates. */
export const haversineMeters = (a: LatLng, b: LatLng): number => {
  const earthRadius = 6371000;
  const toRad = (deg: number): number => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * earthRadius * Math.asin(Math.sqrt(h)));
};

/** Smallest ring (500/1500/3000 m) that contains `distanceMeters`. */
export const ringForDistance = (distanceMeters: number): Ring => {
  if (distanceMeters <= 500) {
    return 500;
  }
  if (distanceMeters <= 1500) {
    return 1500;
  }
  return 3000;
};

export type NearbyProperties = {
  id: string;
  name: string | null;
  category: NearbyCategory;
  sourceType: string;
  distanceMeters: number;
  ring: Ring;
};

export type NearbyFeature = {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: NearbyProperties;
};

export type NearbyMetadata = {
  provider: 'osm' | 'google';
  cozinhaId: string;
  center: LatLng;
  radiusMeters: number;
  generatedAt: string;
  attribution: string;
  truncatedCategories: NearbyCategory[];
};

/** FeatureCollection with a top-level `metadata` foreign member (maps ignore it). */
export type NearbyFeatureCollection = {
  type: 'FeatureCollection';
  metadata: NearbyMetadata;
  features: NearbyFeature[];
};

/** Builds a POI feature, computing distance + ring from the kitchen centre. */
export const buildFeature = (input: {
  id: string;
  name: string | null;
  category: NearbyCategory;
  sourceType: string;
  center: LatLng;
  location: LatLng;
}): NearbyFeature => {
  const distanceMeters = haversineMeters(input.center, input.location);
  return {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [input.location.longitude, input.location.latitude],
    },
    properties: {
      id: input.id,
      name: input.name,
      category: input.category,
      sourceType: input.sourceType,
      distanceMeters,
      ring: ringForDistance(distanceMeters),
    },
  };
};

const HERE = dirname(fileURLToPath(import.meta.url));
// scripts/minha-cozinha-nearby -> repo root
const REPO_ROOT = join(HERE, '..', '..');

/**
 * Writes a collection to the static source the app reads from:
 * `src/data-source-static/data/nearby/<provider>/<cozinhaId>.geojson`.
 * OSM output is committable (ODbL); the Google folder is gitignored.
 */
export const writeCollection = async (
  collection: NearbyFeatureCollection
): Promise<string> => {
  const dir = join(
    REPO_ROOT,
    'src',
    'data-source-static',
    'data',
    'nearby',
    collection.metadata.provider
  );
  await mkdir(dir, { recursive: true });
  const path = join(dir, `${collection.metadata.cozinhaId}.geojson`);
  await writeFile(path, `${JSON.stringify(collection, null, 2)}\n`, 'utf8');
  return path;
};

/** Small delay to stay polite with public APIs. */
export const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};
