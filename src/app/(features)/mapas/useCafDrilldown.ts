import { useGeoVis } from '@ttoss/geovis';
import type {
  Map as MapLibreMap,
  MapGeoJSONFeature,
  MapMouseEvent,
} from 'maplibre-gl';
import * as React from 'react';

import { CAF_DRILL_LAYER_IDS, cafDrillCamera } from './cafDrilldown';

/** Everything this hook calls on the native map, and so everything it checks for. */
const REQUIRED_MAP_METHODS = [
  'on',
  'off',
  'getLayer',
  'queryRenderedFeatures',
  'easeTo',
] as const;

/**
 * How long one drill step takes, in milliseconds.
 *
 * Fixed rather than derived from the zoom delta: every step of this hierarchy
 * moves one level (UF → r3 → r4 → r5 → r6 → points), so a constant duration is
 * what makes repeated clicks feel like one continuous descent instead of steps
 * of varying length.
 */
const DRILL_DURATION_MS = 800;

/** Whether `instance` carries `name` as a callable member, own or inherited. */
const hasMethod = (instance: object, name: string): boolean => {
  return name in instance && typeof Reflect.get(instance, name) === 'function';
};

/**
 * Narrows the adapter's native instance, which it hands out as `unknown`.
 *
 * Structural rather than an assertion: {@link REQUIRED_MAP_METHODS} is exactly
 * what this hook touches, so a runtime that stops providing one of them fails
 * the check here instead of throwing on the first click.
 */
const isMapLibreMap = (instance: unknown): instance is MapLibreMap => {
  return (
    typeof instance === 'object' &&
    instance !== null &&
    REQUIRED_MAP_METHODS.every((name) => {
      return hasMethod(instance, name);
    })
  );
};

/** A clicked feature's own position, or `undefined` when it is not a point. */
const pointCoordinates = (
  geometry: MapGeoJSONFeature['geometry']
): [number, number] | undefined => {
  if (geometry.type !== 'Point') {
    return undefined;
  }

  const [longitude, latitude] = geometry.coordinates;
  return typeof longitude === 'number' && typeof latitude === 'number'
    ? [longitude, latitude]
    : undefined;
};

/**
 * Wires the CAF hierarchy's drill-down: a single click on a UF anchor or on an
 * aggregate grid cell flies the camera to the zoom where that mark breaks into
 * the level below it, centred on the mark's own extent.
 *
 * Only the reaction lives here. The pointer cursor that advertises it is
 * declared on the layers themselves (`CAF_DRILLABLE` in `geovisCafLayers.ts`),
 * because geovis owns the cursor and would overwrite anything written here.
 *
 * Registered as ONE listener on the map rather than one per layer. The four
 * density bands of a resolution are four stacked layers with one-sided filters,
 * so a dense cell is drawn by all four and a per-layer listener would fire up to
 * four times for one click. Querying once and taking the topmost hit is what
 * makes a click a single camera move.
 *
 * Must be called inside `<GeoVisProvider>` — as the `map` slot's override is,
 * which is the seam this exists for. It reads the native map through the
 * runtime's adapter because the spec-driven `layer.click.onSelect` cannot serve
 * it: that callback receives no feature properties, and the cell's extent is a
 * property.
 *
 * @returns Nothing; the effect owns the listeners and removes them on unmount.
 *
 * @example
 * const CafMapPanel = () => {
 *   useCafDrilldown();
 *   return <GeoVisCanvas style={{ width: '100%', height: '100%' }} />;
 * };
 */
export const useCafDrilldown = (): void => {
  const { runtime } = useGeoVis();

  React.useEffect(() => {
    if (!runtime) {
      return undefined;
    }

    const map = runtime.getAdapter().getNativeInstance();

    if (!isMapLibreMap(map)) {
      return undefined;
    }

    /**
     * The drillable layers currently in the style. Every other mode's spec
     * carries none of them, so the listeners below are inert outside the CAF
     * mode without the hook having to know which mode is active.
     */
    const drillableLayers = () => {
      return CAF_DRILL_LAYER_IDS.filter((layerId) => {
        return map.getLayer(layerId) !== undefined;
      });
    };

    const topmostHit = (event: MapMouseEvent) => {
      const layers = drillableLayers();

      if (layers.length === 0) {
        return undefined;
      }

      return map.queryRenderedFeatures(event.point, { layers })[0];
    };

    const handleClick = (event: MapMouseEvent) => {
      const feature = topmostHit(event);

      if (!feature) {
        return;
      }

      const coordinates = pointCoordinates(feature.geometry);

      if (!coordinates) {
        return;
      }

      const camera = cafDrillCamera({
        layerId: feature.layer.id,
        properties: feature.properties,
        coordinates,
      });

      if (!camera) {
        return;
      }

      // Flown here rather than through the runtime's `setView` for two reasons.
      //
      // `essential` is the first and the blocking one: MapLibre turns every
      // animated camera move into an instant jump while the OS asks for reduced
      // motion, unless the move declares itself essential — and `SetViewOptions`
      // has no such field, so a drill-down through `setView` simply teleports
      // for those users. This IS essential: the animation is what shows the
      // clicked cell breaking apart, which is the whole content of the gesture.
      //
      // The second is that `setView` records the new camera into the runtime's
      // own `spec.view`, which the next spec rebuild would then diff against the
      // app's fixed per-mode framing and snap the reader back to the country.
      //
      // `easeTo`, not `flyTo`: a drill step is one to three zoom levels with a
      // small pan, and `flyTo`'s arc pulls back out before coming in — a wobble
      // at this distance. `easeTo` just closes in.
      map.easeTo({ ...camera, duration: DRILL_DURATION_MS, essential: true });
    };

    map.on('click', handleClick);

    return () => {
      map.off('click', handleClick);
    };
  }, [runtime]);
};
