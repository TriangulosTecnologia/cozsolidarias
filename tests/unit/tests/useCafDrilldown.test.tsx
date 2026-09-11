import { render } from '@testing-library/react';

import { useCafDrilldown } from '@/app/(features)/mapas/useCafDrilldown';

const mockGetNativeInstance = jest.fn();
const mockRuntimeMissing = { current: false };

jest.mock('@ttoss/geovis', () => {
  return {
    useGeoVis: () => {
      return {
        runtime: mockRuntimeMissing.current
          ? undefined
          : {
              getAdapter: () => {
                return { getNativeInstance: mockGetNativeInstance };
              },
            },
      };
    },
  };
});

/** A click or move at an arbitrary canvas position; the fake map ignores it. */
const EVENT = { point: { x: 10, y: 20 } };

type Listener = (event: typeof EVENT) => void;

/**
 * A map exposing exactly the five members the hook narrows for, plus the two
 * knobs a test drives: which layers exist, and what a query returns.
 */
const createMap = ({
  layers = ['cafs-h3-r3-b2'],
  features = [] as unknown[],
}: { layers?: string[]; features?: unknown[] } = {}) => {
  const listeners = new Map<string, Listener>();

  return {
    listeners,
    easeTo: jest.fn(),
    queryRenderedFeatures: jest.fn(() => {
      return features;
    }),
    on: (type: string, listener: Listener) => {
      listeners.set(type, listener);
    },
    off: (type: string) => {
      listeners.delete(type);
    },
    getLayer: (id: string) => {
      return layers.includes(id) ? { id } : undefined;
    },
  };
};

const Harness = () => {
  useCafDrilldown();
  return null;
};

/** A grid cell as the tiles carry it: centroid geometry, extent in properties. */
const CELL_FEATURE = {
  layer: { id: 'cafs-h3-r3-b2' },
  properties: { count: 9_000, w: -46, s: -24, e: -45, n: -23 },
  geometry: { type: 'Point', coordinates: [-45.2, -23.9] },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockRuntimeMissing.current = false;
});

test('a single click flies the camera to the clicked cell hand-over zoom', () => {
  const map = createMap({ features: [CELL_FEATURE] });
  mockGetNativeInstance.mockReturnValue(map);

  render(<Harness />);
  map.listeners.get('click')?.(EVENT);

  expect(map.easeTo).toHaveBeenCalledTimes(1);
  expect(map.easeTo).toHaveBeenCalledWith({
    center: [-45.5, -23.5],
    zoom: 7,
    duration: 800,
    // Without this MapLibre teleports instead of animating whenever the reader
    // has asked their system for reduced motion — and the animation IS the
    // content here.
    essential: true,
  });
});

test('queries once per click, however many bands the cell is drawn by', () => {
  const map = createMap({ features: [CELL_FEATURE, CELL_FEATURE] });
  mockGetNativeInstance.mockReturnValue(map);

  render(<Harness />);
  map.listeners.get('click')?.(EVENT);

  expect(map.queryRenderedFeatures).toHaveBeenCalledTimes(1);
  expect(map.easeTo).toHaveBeenCalledTimes(1);
});

test('ignores a click that hits no drillable mark', () => {
  const map = createMap({ features: [] });
  mockGetNativeInstance.mockReturnValue(map);

  render(<Harness />);
  map.listeners.get('click')?.(EVENT);

  expect(map.easeTo).not.toHaveBeenCalled();
});

test('ignores a click on a feature that is not a point', () => {
  const map = createMap({
    features: [{ ...CELL_FEATURE, geometry: { type: 'Polygon' } }],
  });
  mockGetNativeInstance.mockReturnValue(map);

  render(<Harness />);
  map.listeners.get('click')?.(EVENT);

  expect(map.easeTo).not.toHaveBeenCalled();
});

test('does not query when the style carries no drillable layer', () => {
  const map = createMap({ layers: [], features: [CELL_FEATURE] });
  mockGetNativeInstance.mockReturnValue(map);

  render(<Harness />);
  map.listeners.get('click')?.(EVENT);

  expect(map.queryRenderedFeatures).not.toHaveBeenCalled();
  expect(map.easeTo).not.toHaveBeenCalled();
});

test('drops its listener on unmount', () => {
  const map = createMap({ features: [CELL_FEATURE] });
  mockGetNativeInstance.mockReturnValue(map);

  const { unmount } = render(<Harness />);
  expect(map.listeners.size).toBe(1);

  unmount();
  expect(map.listeners.size).toBe(0);
});

test('ignores a hit whose layer does not drill', () => {
  const map = createMap({
    features: [{ ...CELL_FEATURE, layer: { id: 'cafs-pts' } }],
  });
  mockGetNativeInstance.mockReturnValue(map);

  render(<Harness />);
  map.listeners.get('click')?.(EVENT);

  expect(map.easeTo).not.toHaveBeenCalled();
});

test('ignores a point whose coordinates are not numbers', () => {
  const map = createMap({
    features: [
      { ...CELL_FEATURE, geometry: { type: 'Point', coordinates: ['a', 'b'] } },
    ],
  });
  mockGetNativeInstance.mockReturnValue(map);

  render(<Harness />);
  map.listeners.get('click')?.(EVENT);

  expect(map.easeTo).not.toHaveBeenCalled();
});

test('stays inert before the runtime exists', () => {
  mockRuntimeMissing.current = true;

  render(<Harness />);

  expect(mockGetNativeInstance).not.toHaveBeenCalled();
});

describe('an adapter instance that is not a usable map', () => {
  const noop = () => {};

  test.each([
    ['not an object', 'a map'],
    ['null', null],
    ['nothing at all', {}],
    ['an `on` that is not callable', { on: 1 }],
    ['no `off`', { on: noop }],
    ['an `off` that is not callable', { on: noop, off: 1 }],
    ['no `getLayer`', { on: noop, off: noop }],
    ['a `getLayer` that is not callable', { on: noop, off: noop, getLayer: 1 }],
    ['no `queryRenderedFeatures`', { on: noop, off: noop, getLayer: noop }],
    [
      'no `easeTo`',
      { on: noop, off: noop, getLayer: noop, queryRenderedFeatures: noop },
    ],
    [
      'a `queryRenderedFeatures` that is not callable',
      { on: noop, off: noop, getLayer: noop, queryRenderedFeatures: 1 },
    ],
    ['no `queryRenderedFeatures`', { on: noop, off: noop, getLayer: noop }],
    [
      'no `easeTo`',
      { on: noop, off: noop, getLayer: noop, queryRenderedFeatures: noop },
    ],
  ])('is refused when it exposes %s', (_description, instance) => {
    mockGetNativeInstance.mockReturnValue(instance);

    expect(() => {
      return render(<Harness />);
    }).not.toThrow();
  });
});
