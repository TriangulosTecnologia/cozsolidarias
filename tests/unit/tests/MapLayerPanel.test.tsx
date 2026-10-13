import '@testing-library/jest-dom';

import { render, screen } from '@testing-library/react';

import { EnabledShareContext } from '@/app/(features)/mapas/enabledShareContext';
import { ENABLED_SHARE_LAYER_ID } from '@/app/(features)/mapas/geovisEnabledShareIds';
import MapLayerPanel from '@/app/(features)/mapas/MapLayerPanel';

const mockLayers: Array<{ id: string; visible?: boolean }> = [];
jest.mock('@ttoss/geovis', () => {
  return {
    useGeoVis: () => {
      return { spec: { layers: mockLayers } };
    },
  };
});
jest.mock('@/app/(features)/mapas/CafMapPanel', () => {
  return {
    __esModule: true,
    default: () => {
      return <div>Canvas</div>;
    },
  };
});
jest.mock('@/app/(features)/mapas/EnabledShareLegend', () => {
  return {
    __esModule: true,
    default: () => {
      return <div>Size legend</div>;
    },
  };
});

test('observes the control visibility and keeps legend in sync across toggles', () => {
  const state = {
    active: false,
    setActive: jest.fn(),
    snapshot: null,
    loading: false,
    error: null,
    retry: jest.fn(),
  };
  mockLayers.splice(
    0,
    mockLayers.length,
    { id: 'other' },
    { id: ENABLED_SHARE_LAYER_ID, visible: false }
  );
  const { rerender } = render(
    <EnabledShareContext.Provider value={state}>
      <MapLayerPanel />
    </EnabledShareContext.Provider>
  );
  expect(state.setActive).toHaveBeenLastCalledWith(false);
  expect(screen.queryByText('Size legend')).toBeNull();
  mockLayers[1].visible = true;
  rerender(
    <EnabledShareContext.Provider value={state}>
      <MapLayerPanel />
    </EnabledShareContext.Provider>
  );
  expect(state.setActive).toHaveBeenLastCalledWith(true);
  expect(screen.getByText('Size legend')).toBeInTheDocument();
  rerender(<MapLayerPanel />);
  expect(screen.queryByText('Size legend')).toBeNull();
});
