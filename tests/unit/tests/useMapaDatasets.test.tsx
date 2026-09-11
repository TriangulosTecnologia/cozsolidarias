import '@testing-library/jest-dom';

import { act, render, screen, waitFor } from '@testing-library/react';
import * as React from 'react';
import type { MapMode } from 'src/app/(features)/mapas/geovisSpec';
import { useMapaDatasets } from 'src/app/(features)/mapas/useMapaDatasets';

/**
 * Drives the hook the way `MapaPlayground` does: mount with a mode, then call
 * `ensure` for the mode a menu pick would move to, reporting whether it handed
 * back a wait (a promise) or nothing.
 */
const Host = ({ mountMode }: { mountMode: MapMode }) => {
  const [picked, setPicked] = React.useState<MapMode>(mountMode);
  const { datasets, ready, ensure } = useMapaDatasets(picked);
  const [handedBack, setHandedBack] = React.useState('');

  return (
    <div>
      <span data-testid="ready">{String(ready)}</span>
      <span data-testid="cafs">{datasets.cafsByCity.length}</span>
      <span data-testid="handed-back">{handedBack}</span>
      <button
        type="button"
        onClick={() => {
          // The order `MapaPlayground` uses: commit the pick, then report the
          // wait it costs.
          setPicked('cafs');
          const pending = ensure('cafs');
          setHandedBack(pending ? 'promise' : 'nothing');
          // Mirrors the workspace, which settles on either outcome.
          void pending?.catch(() => {});
        }}
      >
        cafs
      </button>
    </div>
  );
};

const CAF_BY_CITY = [
  {
    codigoIbge: '3550308',
    municipio: 'São Paulo',
    quantidade: 42,
    percentualDoBrasil: 0.01,
  },
];

const serve = (url: string) => {
  return url.includes('cafs/por-municipio') ? CAF_BY_CITY : [];
};

const urlsFetched = () => {
  return (global.fetch as jest.Mock).mock.calls.map((call) => {
    return String(call[0]);
  });
};

beforeEach(() => {
  global.fetch = jest.fn((input: RequestInfo | URL) => {
    return Promise.resolve({
      json: () => {
        return Promise.resolve(serve(String(input)));
      },
    } as Response);
  }) as jest.Mock;
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('useMapaDatasets', () => {
  test('loads the mount mode only, then the rest on the mode that needs them', async () => {
    render(<Host mountMode="coropletico" />);

    await waitFor(() => {
      expect(screen.getByTestId('ready')).toHaveTextContent('true');
    });

    // The base pair, and nothing the default choropleth does not paint.
    expect(urlsFetched()).toEqual([
      '/api/cozinhas/por-municipio',
      '/geo/municipios-nomes.json',
    ]);

    await act(async () => {
      screen.getByRole('button').click();
    });

    expect(urlsFetched()).toContain('/api/cafs/pontos-por-uf');
    expect(urlsFetched()).toContain('/api/cafs/por-municipio');
    expect(screen.getByTestId('cafs')).toHaveTextContent('1');
  });

  /*
   * Two modes can want the same snapshot, and a fast second pick can land
   * before the first request settles. The in-flight map is what keeps that to
   * one request — and lets the second pick wait on the same promise.
   */
  test('shares one request between picks that overlap', async () => {
    render(<Host mountMode="coropletico" />);
    await waitFor(() => {
      expect(screen.getByTestId('ready')).toHaveTextContent('true');
    });
    const beforePicks = urlsFetched().length;

    await act(async () => {
      // Both synchronous, so the second finds the first still in flight.
      screen.getByRole('button').click();
      screen.getByRole('button').click();
    });

    const cafRequests = urlsFetched().filter((url) => {
      return url.includes('/api/cafs/');
    });
    expect(cafRequests).toHaveLength(2); // the UF anchors and the counts, once each
    expect(urlsFetched()).toHaveLength(beforePicks + 2);
  });

  /*
   * The difference between the sidebar locking and staying live: a promise is
   * the hook saying "this pick costs a request". Handing one back for a mode
   * already in memory would hold every menu inert to await nothing.
   */
  test('hands back a wait only while a mode is unserved', async () => {
    render(<Host mountMode="coropletico" />);
    await waitFor(() => {
      expect(screen.getByTestId('ready')).toHaveTextContent('true');
    });

    await act(async () => {
      screen.getByRole('button').click();
    });
    expect(screen.getByTestId('handed-back')).toHaveTextContent('promise');

    const afterFirstPick = urlsFetched().length;

    await act(async () => {
      screen.getByRole('button').click();
    });
    expect(screen.getByTestId('handed-back')).toHaveTextContent('nothing');
    // Cached: the second visit issues no request at all.
    expect(urlsFetched()).toHaveLength(afterFirstPick);
  });

  test('a failed mode rejects, stays unloaded, and can be picked again', async () => {
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      if (String(input).includes('cafs/')) {
        return Promise.reject(new Error('offline'));
      }
      return Promise.resolve({
        json: () => {
          return Promise.resolve([]);
        },
      } as Response);
    }) as jest.Mock;

    render(<Host mountMode="coropletico" />);
    await waitFor(() => {
      expect(screen.getByTestId('ready')).toHaveTextContent('true');
    });

    await act(async () => {
      screen.getByRole('button').click();
    });
    expect(screen.getByTestId('handed-back')).toHaveTextContent('promise');

    // The failure dropped the request from the in-flight map without marking
    // the key loaded, so the next pick retries instead of resolving to nothing.
    const afterFailure = urlsFetched().length;
    await act(async () => {
      screen.getByRole('button').click();
    });
    expect(screen.getByTestId('handed-back')).toHaveTextContent('promise');
    expect(urlsFetched().length).toBeGreaterThan(afterFailure);
  });

  /*
   * A failed mount load must still show the map: the empty snapshots paint
   * every município as "sem dado", which is readable, where holding the render
   * on a failed request would be a blank screen.
   */
  test('becomes ready even when the mount load fails', async () => {
    global.fetch = jest.fn(() => {
      return Promise.reject(new Error('offline'));
    }) as jest.Mock;

    render(<Host mountMode="coropletico" />);

    await waitFor(() => {
      expect(screen.getByTestId('ready')).toHaveTextContent('true');
    });
  });
});
