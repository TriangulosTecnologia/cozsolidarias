import type { NearbyProvider } from '@/data-gateway/schema';
import { gateway } from '@/gateway';

const isProvider = (value: string | null): value is NearbyProvider => {
  return value === 'osm' || value === 'google';
};

/**
 * Returns the nearby POIs around a cozinha as a GeoJSON `FeatureCollection`,
 * ready to feed a `@ttoss/geovis` geojson source. The `provider` query param
 * (`osm` | `google`) selects the dataset and defaults to `osm`.
 *
 * `GET /api/minha-cozinha/CS014558/nearby?provider=google`
 */
export const GET = async (
  request: Request,
  context: { params: Promise<{ cozinhaId: string }> }
) => {
  const { cozinhaId } = await context.params;
  const requested = new URL(request.url).searchParams.get('provider');
  const provider: NearbyProvider = isProvider(requested) ? requested : 'osm';

  const nearby = await gateway.getNearbyPlaces({ cozinhaId, provider });
  return Response.json(nearby);
};
