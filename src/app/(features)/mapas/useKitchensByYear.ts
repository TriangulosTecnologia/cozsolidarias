import * as React from 'react';

import type { CozinhasFeatureCollection } from '@/data-gateway/schema';

/** Fetches the snapshot years available for the time-lapse, oldest to newest. */
const fetchYears = async (): Promise<number[]> => {
  const response = await fetch('/api/cozinhas/anos');
  return response.json() as Promise<number[]>;
};

/** Fetches one year's kitchen points as a GeoJSON FeatureCollection. */
const fetchPoints = async (
  year: number
): Promise<CozinhasFeatureCollection> => {
  const response = await fetch(`/api/cozinhas?ano=${year}`);
  return response.json() as Promise<CozinhasFeatureCollection>;
};

/** What {@link useKitchensByYear} exposes to the map. */
type KitchensByYear = {
  /** The selected year's points, or `undefined` until it has loaded. */
  points: CozinhasFeatureCollection | undefined;
  /** `true` while the selected year's points are not yet in the cache. */
  loading: boolean;
  /** The available snapshot years (empty until discovered). */
  years: number[];
  /**
   * Every year loaded so far, keyed by year. Callers that derive a per-`codigo`
   * lookup used to paint the points must read from this, not from `points`
   * alone: during a year change the outgoing year's dots stay on screen (the
   * layer crossfades, and `points` is briefly `undefined` on a cache miss), so
   * a lookup built from the selected year alone leaves them unpainted.
   */
  collections: Record<number, CozinhasFeatureCollection>;
};

/**
 * Loads the kitchen points for the time-lapse and keeps every year cached in
 * memory. On mount it discovers the available years (`/api/cozinhas/anos`) and
 * prefetches all of them in parallel, so selecting a year — and the play
 * animation — reads straight from memory with no per-frame network round-trip.
 * Each year is fetched at most once; the selected year is always ensured even
 * before the year list arrives.
 *
 * @param year - The currently selected time-lapse year.
 * @returns The selected year's points, a loading flag, the year list, and every
 *   year loaded so far (`collections`).
 *
 * @example
 * const { points, loading } = useKitchensByYear(2025);
 * // points → the 2025 kitchens FeatureCollection (once loaded)
 */
export const useKitchensByYear = (year: number): KitchensByYear => {
  const [years, setYears] = React.useState<number[]>([]);
  const [cache, setCache] = React.useState<
    Record<number, CozinhasFeatureCollection>
  >({});
  const inFlight = React.useRef(new Set<number>());

  const load = React.useCallback(
    (target: number) => {
      if (cache[target] || inFlight.current.has(target)) {
        return;
      }
      inFlight.current.add(target);
      fetchPoints(target)
        .then((collection) => {
          setCache((previous) => {
            return { ...previous, [target]: collection };
          });
        })
        .finally(() => {
          inFlight.current.delete(target);
        });
    },
    [cache]
  );

  // Discover the available years once.
  React.useEffect(() => {
    let cancelled = false;
    fetchYears()
      .then((discovered) => {
        if (!cancelled) {
          setYears(discovered);
        }
      })
      .catch(() => {
        // A failed discovery leaves `years` empty; the selected year is still
        // fetched by the effect below, so the map is never left blank.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Prefetch every year so scrubbing and the play animation read from memory.
  React.useEffect(() => {
    for (const target of years) {
      load(target);
    }
  }, [years, load]);

  // Ensure the selected year is loaded even before the year list arrives.
  React.useEffect(() => {
    load(year);
  }, [year, load]);

  return {
    points: cache[year],
    loading: !cache[year],
    years,
    collections: cache,
  };
};
