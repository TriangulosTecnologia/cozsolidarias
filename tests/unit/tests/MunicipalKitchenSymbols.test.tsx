import { act, render, waitFor } from '@testing-library/react';

import MunicipalKitchenSymbols from '@/app/(features)/mapas/MunicipalKitchenSymbols';

import { enabledShareSnapshot } from '../fixtures/enabledShare';

const mockNative = {};
let mockRuntime: unknown = {
  getAdapter: () => {
    return {
      getNativeInstance: () => {
        return mockNative;
      },
    };
  },
};
const mockMarkers: Array<{
  element: HTMLElement;
  setLngLat: jest.Mock;
  addTo: jest.Mock;
  remove: jest.Mock;
}> = [];
jest.mock('@ttoss/geovis', () => {
  return {
    useGeoVis: () => {
      return { runtime: mockRuntime };
    },
  };
});
jest.mock('maplibre-gl', () => {
  return {
    Marker: jest.fn().mockImplementation(({ element }) => {
      const marker = {
        element,
        setLngLat: jest.fn().mockReturnThis(),
        addTo: jest.fn().mockReturnThis(),
        remove: jest.fn(),
      };
      mockMarkers.push(marker);
      return marker;
    }),
  };
});
afterEach(() => {
  mockMarkers.splice(0);
});

test('adds camera-following proportional SVGs and removes every marker on deactivation', async () => {
  const { rerender } = render(
    <MunicipalKitchenSymbols snapshot={enabledShareSnapshot} visible={true} />
  );
  await waitFor(() => {
    return expect(mockMarkers).toHaveLength(2);
  });
  expect(mockMarkers[0].element.innerHTML).toContain('<svg');
  expect(mockMarkers[0].setLngLat).toHaveBeenCalledWith(
    enabledShareSnapshot.municipalCoverage[0].anchor
  );
  expect(mockMarkers[0].addTo).toHaveBeenCalledWith(mockNative);
  expect(mockMarkers[1].element.innerHTML).toContain('stroke-dasharray');
  expect(mockMarkers[0].element.style.pointerEvents).toBe('none');
  rerender(
    <MunicipalKitchenSymbols snapshot={enabledShareSnapshot} visible={false} />
  );
  for (const marker of mockMarkers)
    expect(marker.remove).toHaveBeenCalledTimes(1);
});

test('never mounts stale markers if deactivated while the renderer is loading', async () => {
  const { unmount } = render(
    <MunicipalKitchenSymbols snapshot={enabledShareSnapshot} visible={true} />
  );
  unmount();
  await act(async () => {
    await Promise.resolve();
  });
  expect(mockMarkers).toHaveLength(0);
});

test('waits for snapshot and native runtime before rendering', async () => {
  const { rerender } = render(
    <MunicipalKitchenSymbols snapshot={null} visible={true} />
  );
  mockRuntime = null;
  rerender(
    <MunicipalKitchenSymbols snapshot={enabledShareSnapshot} visible={true} />
  );
  await act(async () => {});
  expect(mockMarkers).toHaveLength(0);
  mockRuntime = {
    getAdapter: () => {
      return {
        getNativeInstance: () => {
          return mockNative;
        },
      };
    },
  };
});
