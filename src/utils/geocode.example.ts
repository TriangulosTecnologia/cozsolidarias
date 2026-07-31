import {
  Client,
  type GeocodeRequest,
} from '@googlemaps/google-maps-services-js';

/**
 * Coordinates returned by {@link getCoordinates}.
 */
export type Coordinates = {
  /** Latitude in decimal degrees. */
  lat: number;
  /** Longitude in decimal degrees. */
  lng: number;
};

/** Shared Google Maps client instance. */
const client = new Client({});

/**
 * Resolves a free-form address to latitude/longitude via the Google Geocoding
 * API. Server-only: it reads `GOOGLE_MAPS_API_KEY` from the environment, so the
 * key never reaches the client bundle. Requires the `@googlemaps/google-maps-services-js`
 * package and the Geocoding API enabled in the Google Cloud project.
 *
 * @param address - The address to geocode, e.g. `"Av. Paulista, 1000 - São Paulo, SP"`.
 * @returns The first result's coordinates, or `null` when no result is found.
 * @throws If `GOOGLE_MAPS_API_KEY` is unset or the request fails.
 */
export const getCoordinates = async (
  address: string
): Promise<Coordinates | null> => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    throw new Error('Missing GOOGLE_MAPS_API_KEY environment variable.');
  }

  const request: GeocodeRequest = {
    params: {
      address,
      key: apiKey,
      // Bias results to Brazil so ambiguous addresses resolve locally.
      region: 'br',
      components: 'country:BR',
    },
    timeout: 5000, // ms
  };

  const response = await client.geocode(request);

  if (response.data.results.length === 0) {
    return null;
  }

  const { lat, lng } = response.data.results[0].geometry.location;

  return { lat, lng };
};
