import { renderHook, waitFor } from '@testing-library/react';
import { useCafHexbin } from 'src/app/(features)/mapas/useCafHexbin';
import type { CafHexbinFeatureCollection } from 'src/data-gateway/schema';

const gridWith = (h3: string): CafHexbinFeatureCollection => {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { h3, count: 1 },
        geometry: { type: 'Polygon', coordinates: [[[-46, -23]]] },
      },
    ],
  };
};

const seed = gridWith('r4');
const fetched = gridWith('r5');

afterEach(() => {
  jest.restoreAllMocks();
});

const mockFetch = (grid: CafHexbinFeatureCollection = fetched) => {
  const fetchMock = jest.fn(() => {
    return Promise.resolve({
      json: () => {
        return Promise.resolve(grid);
      },
    } as Response);
  });
  global.fetch = fetchMock as jest.Mock;
  return fetchMock;
};

describe('useCafHexbin', () => {
  /*
   * The mode already paid for the default resolution through `useMapaDatasets`.
   * Fetching it again on mount would double the cost of opening the mode for a
   * setting the reader has not touched.
   */
  test('serves the seeded default without a request', () => {
    const fetchMock = mockFetch();

    const { result } = renderHook(() => {
      return useCafHexbin({ resolution: 4, seed });
    });

    expect(result.current.cells).toBe(seed);
    expect(result.current.loading).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('fetches the resolution asked for, by its own route', async () => {
    const fetchMock = mockFetch();

    const { result } = renderHook(() => {
      return useCafHexbin({ resolution: 5, seed });
    });

    // Nothing to draw yet: the seeded r4 is not what was asked for.
    expect(result.current.cells).toBeUndefined();
    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.cells).toBe(fetched);
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/cafs/hexbin?r=5');
    expect(result.current.loading).toBe(false);
  });

  test('keeps every resolution it has fetched, so going back costs nothing', async () => {
    const fetchMock = mockFetch();

    const { result, rerender } = renderHook(
      ({ resolution }: { resolution: 3 | 4 | 5 }) => {
        return useCafHexbin({ resolution, seed });
      },
      { initialProps: { resolution: 5 as 3 | 4 | 5 } }
    );

    await waitFor(() => {
      expect(result.current.cells).toBe(fetched);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    rerender({ resolution: 4 });
    expect(result.current.cells).toBe(seed);

    rerender({ resolution: 5 });
    expect(result.current.cells).toBe(fetched);
    // Still one: both resolutions came out of the cache.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  /*
   * The setting did not take, which is readable. Blanking the source would
   * paint the country away over a failed request for a knob.
   */
  test('leaves the map alone when the grid fails to load', async () => {
    global.fetch = jest.fn(() => {
      return Promise.reject(new Error('offline'));
    }) as jest.Mock;

    const { result } = renderHook(() => {
      return useCafHexbin({ resolution: 3, seed });
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/cafs/hexbin?r=3');
    });

    expect(result.current.cells).toBeUndefined();
  });

  test('fetches even with no seed to fall back on', async () => {
    const fetchMock = mockFetch();

    const { result } = renderHook(() => {
      return useCafHexbin({ resolution: 4 });
    });

    await waitFor(() => {
      expect(result.current.cells).toBe(fetched);
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/cafs/hexbin?r=4');
  });
});
