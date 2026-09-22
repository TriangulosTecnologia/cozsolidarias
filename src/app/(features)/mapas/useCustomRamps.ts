import * as React from 'react';

import { type CustomRamp, setCustomRamps } from './mapaColorRamp';
import { type RampHandlers } from './mapaLeftSidebar';

/**
 * The colour ramps the reader builds in the settings zone.
 *
 * Held by the page rather than by the sidebar because the control reports a
 * finished ramp and leaves keeping it to the app: a selection carries one
 * string per key and cannot hold a ramp's classes.
 *
 * They live for the session only. A reload opens on the ramps the app ships,
 * and a shared address falls back to the default — `coresFrom` validates the
 * `cores` parameter against the listed options, so an id minted on another
 * machine is dropped rather than carried into a ramp nobody has.
 *
 * @returns The handlers the colour block reads its list from and reports back
 *   through. Their identity changes with the list, which is what rebuilds the
 *   sidebar when a ramp is built or dismissed.
 *
 * @example
 * const { handlers } = useCustomRamps();
 * buildLeftSidebar({ mode, ramps: handlers });
 */
export const useCustomRamps = ({
  onRemoved,
}: {
  /**
   * A ramp was dismissed. The page decides what that costs: the chosen ramp
   * travels in the selection, and dropping one the reader is currently reading
   * leaves the map painted from an id no list answers to.
   */
  onRemoved?: (params: { id: string }) => void;
} = {}): {
  handlers: RampHandlers;
} => {
  const [ramps, setRamps] = React.useState<CustomRamp[]>([]);

  /*
   * Published during render, before the spec that reads it is built:
   * `rampPalette` runs inside the scale functions, which are handed the chosen
   * id and nothing else. Writing it in an effect would leave the first paint
   * after a create resolving an id the module has not heard of yet.
   *
   * Safe to repeat — the write is a replacement, not an append, so a double
   * render lands on the same list.
   */
  setCustomRamps(ramps);

  const handlers = React.useMemo((): RampHandlers => {
    return {
      list: ramps,
      onCreate: ({ option }) => {
        setRamps((current) => {
          return [...current, option];
        });
      },
      onRemove: ({ id }) => {
        setRamps((current) => {
          return current.filter((ramp) => {
            return ramp.id !== id;
          });
        });

        onRemoved?.({ id });
      },
    };
    // `ramps` is a dependency, and has to be: the identity of this object is
    // what tells the config memo that the list changed. Without it a built ramp
    // would never reach the sidebar.
  }, [ramps, onRemoved]);

  return { handlers };
};
