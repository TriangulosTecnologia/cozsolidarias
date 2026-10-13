import { act, renderHook, waitFor } from '@testing-library/react';

import { useMunicipalCoverageBridge } from '@/app/(features)/mapas/useMunicipalCoverageBridge';

import { coverageRisks } from '../fixtures/coverageRisks';
import { enabledShareSnapshot } from '../fixtures/enabledShare';

afterEach(() => {
  return jest.restoreAllMocks();
});

test('loads the shared reference independently, pins 2025, caches across views, restores year', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => {
      return enabledShareSnapshot;
    },
  });
  const ensure = jest.fn().mockResolvedValue(undefined);
  const { result, rerender } = renderHook(
    ({ mode }) => {
      return useMunicipalCoverageBridge(2026, ensure, coverageRisks, mode);
    },
    {
      initialProps: {
        mode: 'coropletico-cadinsan-com-pbf' as
          | 'coropletico-cadinsan-com-pbf'
          | 'coropletico-cadinsan-sem-pbf',
      },
    }
  );
  expect(ensure).not.toHaveBeenCalled();
  expect(result.current.year).toBe(2026);
  act(() => {
    return result.current.state.setMunicipalActive(true);
  });
  await waitFor(() => {
    return expect(result.current.state.snapshot).toEqual(enabledShareSnapshot);
  });
  expect(ensure).toHaveBeenCalledWith('coropletico-cadinsan-com-pbf');
  expect(result.current.year).toBe(2025);
  rerender({ mode: 'coropletico-cadinsan-sem-pbf' });
  expect(result.current.state.scenario).toBe('sem');
  act(() => {
    return result.current.state.setSummary(true);
  });
  expect(result.current.state.summary).toBe(true);
  expect(global.fetch).toHaveBeenCalledTimes(1);
  act(() => {
    return result.current.state.setMunicipalActive(false);
  });
  expect(result.current.year).toBe(2026);
  expect(result.current.active).toBe(false);
});

test('handles an already-loaded reference and leaves failed reference available for retry', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => {
      return enabledShareSnapshot;
    },
  });
  const { result, rerender } = renderHook(
    ({ ensure }) => {
      return useMunicipalCoverageBridge(2026, ensure, [], 'pontos');
    },
    {
      initialProps: {
        ensure: jest
          .fn<Promise<void> | undefined, []>()
          .mockReturnValue(undefined),
      },
    }
  );
  act(() => {
    return result.current.state.setMunicipalActive(true);
  });
  await waitFor(() => {
    return expect(result.current.state.snapshot).not.toBeNull();
  });
  const ensure = jest
    .fn<Promise<void> | undefined, []>()
    .mockRejectedValue(new Error('offline'));
  rerender({ ensure });
  await act(async () => {});
  expect(result.current.state.cadinsan).toEqual([]);
});
