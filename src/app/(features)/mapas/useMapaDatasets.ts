import * as React from 'react';

import type { MapMode } from './geovisSpec';
import {
  datasetsForMode,
  EMPTY_DATASETS,
  fetchMapDataset,
  type MapDatasetKey,
  type MapDatasets,
} from './mapBootstrap';

/** What {@link useMapaDatasets} hands the map. */
export type MapaDatasets = {
  /** Every snapshot loaded so far; the unloaded ones keep their empty shape. */
  datasets: MapDatasets;
  /** `false` until the mount mode's snapshots have settled, either way. */
  ready: boolean;
  /**
   * Loads whatever `mode` still lacks. Returns the wait when there is one, and
   * `undefined` when the mode is already served — which is the difference
   * between the sidebar locking and staying live.
   */
  ensure: (mode: MapMode) => Promise<void> | undefined;
};

/**
 * Loads the map's snapshots per mode instead of all at once.
 *
 * The returned `ensure` is what the workspace's `onVariableChange` hands back:
 * a promise means "this pick costs a request", and the workspace holds every
 * menu inert until it settles. So a mode that is already loaded must return
 * `undefined` — a promise for a cached mode would lock the sidebar to await
 * nothing.
 *
 * Each key is fetched at most once and shared while in flight, so two modes
 * that need the same snapshot issue one request between them, and a rejection
 * drops it from the in-flight map so a later pick can retry.
 *
 * @param mode - The mode at mount; every later mode arrives through `ensure`.
 * @returns The snapshots, the mount-time `ready` flag, and `ensure`.
 *
 * @example
 * const { datasets, ready, ensure } = useMapaDatasets('coropletico');
 * // in onVariableChange: return ensure(nextMode);
 */
export const useMapaDatasets = (mode: MapMode): MapaDatasets => {
  const [datasets, setDatasets] = React.useState<MapDatasets>(EMPTY_DATASETS);
  const [ready, setReady] = React.useState(false);

  /** Keys whose value is already in `datasets`. A ref: `ensure` must not go stale. */
  const loaded = React.useRef(new Set<MapDatasetKey>());
  const inFlight = React.useRef(new Map<MapDatasetKey, Promise<void>>());
  const alive = React.useRef(true);

  React.useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const load = React.useCallback((key: MapDatasetKey): Promise<void> => {
    const pending = inFlight.current.get(key);
    if (pending) {
      return pending;
    }

    const request = fetchMapDataset(key)
      .then((value) => {
        loaded.current.add(key);
        if (!alive.current) {
          return;
        }
        setDatasets((current) => {
          return { ...current, [key]: value };
        });
      })
      .finally(() => {
        inFlight.current.delete(key);
      });

    inFlight.current.set(key, request);
    return request;
  }, []);

  const ensure = React.useCallback(
    (next: MapMode): Promise<void> | undefined => {
      const missing = datasetsForMode(next).filter((key) => {
        return !loaded.current.has(key);
      });

      if (missing.length === 0) {
        return undefined;
      }

      return Promise.all(missing.map(load)).then(() => {
        return undefined;
      });
    },
    [load]
  );

  // Frozen at mount (a state initializer, never updated): later modes are
  // loaded by the menu handler through `ensure`, which is also what makes the
  // sidebar wait for them.
  const [mountMode] = React.useState(mode);

  React.useEffect(() => {
    // `ready` flips on either outcome. A failed load leaves the empty
    // snapshots, which paint every município as "sem dado" — a readable map,
    // where blocking the render on a failed request would be a blank screen.
    const settle = () => {
      if (alive.current) {
        setReady(true);
      }
    };

    // `Promise.resolve` rather than a branch on the return: nothing is loaded
    // at mount, so `ensure` always has a wait to hand back here — the
    // `undefined` case only exists for the menu handler, where it is the whole
    // point.
    void Promise.resolve(ensure(mountMode)).then(settle, settle);
  }, [ensure, mountMode]);

  return { datasets, ready, ensure };
};
