import { GeoVisCanvas } from '@ttoss/geovis';

import { useCafDrilldown } from './useCafDrilldown';

/**
 * The workspace's `map` slot, replacing a default that is nothing but the same
 * canvas at the same size.
 *
 * It exists for one reason: an override renders INSIDE the provider tree, which
 * is the only place `useGeoVis()` resolves — and the drill-down needs both the
 * runtime's camera (`setView`) and its native map. `MapaPlayground` renders
 * `<GeovisWorkspace>` and therefore sits outside that tree.
 *
 * Overriding the slot gives up geovis-workspace's cold-start panel, which covers
 * the window between mount and the first resolved spec. Nothing is lost:
 * `MapaPlayground` already holds `<MapLoadingIndicator>` over that window and
 * only mounts the workspace once its datasets have settled.
 *
 * @returns The map canvas, with the CAF drill-down listening on it.
 *
 * @example
 * // In the workspace config:
 * slots: { map: { component: CafMapPanel } }
 */
const CafMapPanel = () => {
  useCafDrilldown();

  return <GeoVisCanvas style={{ width: '100%', height: '100%' }} />;
};

export default CafMapPanel;
