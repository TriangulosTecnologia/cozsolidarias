import { useGeoVis } from '@ttoss/geovis';
import * as React from 'react';

import CafMapPanel from './CafMapPanel';
import { EnabledShareContext } from './enabledShareContext';
import EnabledShareLegend from './EnabledShareLegend';
import { ENABLED_SHARE_LAYER_ID } from './geovisEnabledShareIds';

/**
 * Map slot observing the real control state and displaying its independent
 * size legend. Existing CAF canvas/drill-down stays mounted beneath it.
 * @returns Canvas plus the active layer's legend.
 * @example config.slots.map = { component: MapLayerPanel };
 */
const MapLayerPanel = () => {
  const { spec } = useGeoVis();
  const state = React.useContext(EnabledShareContext);
  const visible = spec.layers.some((layer) => {
    return layer.id === ENABLED_SHARE_LAYER_ID && layer.visible !== false;
  });
  const setActive = state?.setActive;
  React.useEffect(() => {
    setActive?.(visible);
  }, [setActive, visible]);
  return (
    <>
      <CafMapPanel />
      {visible && state && (
        <EnabledShareLegend
          snapshot={state.snapshot}
          loading={state.loading}
          error={state.error}
          retry={state.retry}
        />
      )}
    </>
  );
};

export default MapLayerPanel;
