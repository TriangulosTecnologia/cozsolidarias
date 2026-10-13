import { act, renderHook, waitFor } from '@testing-library/react';

import { useEnabledShare2025 } from '@/app/(features)/mapas/useEnabledShare2025';
import { useEnabledShareLayer } from '@/app/(features)/mapas/useEnabledShareLayer';

import { enabledShareSnapshot } from '../fixtures/enabledShare';

const response = (): Response => {
  return {
    ok: true,
    json: async () => {
      return enabledShareSnapshot;
    },
  } as Response;
};
afterEach(() => {
  return jest.restoreAllMocks();
});

test('loads only on activation, caches across toggles, and restores the selected year', async () => {
  const fetchMock = jest.fn(async () => {
    return response();
  });
  global.fetch = fetchMock;
  const { result, rerender } = renderHook(
    ({ year }) => {
      return useEnabledShareLayer(year);
    },
    { initialProps: { year: 2026 } }
  );
  expect(result.current.year).toBe(2026);
  expect(fetchMock).not.toHaveBeenCalled();
  act(() => {
    return result.current.enabledShareState.setActive(true);
  });
  expect(result.current.year).toBe(2025);
  await waitFor(() => {
    return expect(result.current.enabledShareState.snapshot).toEqual(
      enabledShareSnapshot
    );
  });
  act(() => {
    return result.current.enabledShareState.setActive(false);
  });
  expect(result.current.year).toBe(2026);
  rerender({ year: 2025 });
  expect(result.current.year).toBe(2025);
  act(() => {
    return result.current.enabledShareState.setActive(true);
  });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(result.current.enabledShareState.loading).toBe(false);
});

test('surfaces HTTP failures and retries without substituting zeros', async () => {
  const fetchMock = jest
    .fn()
    .mockResolvedValueOnce({ ok: false })
    .mockResolvedValueOnce(response());
  global.fetch = fetchMock;
  const { result } = renderHook(() => {
    return useEnabledShare2025(true);
  });
  await waitFor(() => {
    return expect(result.current.error).not.toBeNull();
  });
  expect(result.current.snapshot).toBeNull();
  expect(result.current.loading).toBe(false);
  act(() => {
    return result.current.retry();
  });
  await waitFor(() => {
    return expect(result.current.snapshot).toEqual(enabledShareSnapshot);
  });
  expect(result.current.error).toBeNull();
});

test('cancels before requesting when unmounted in the activation tick', async () => {
  global.fetch = jest.fn();
  const { unmount } = renderHook(() => {
    return useEnabledShare2025(true);
  });
  unmount();
  await act(async () => {});
  expect(global.fetch).not.toHaveBeenCalled();
});

test('ignores a late successful response after deactivation', async () => {
  let finish: (value: Response) => void = () => {};
  global.fetch = jest.fn(() => {
    return new Promise<Response>((resolve) => {
      finish = resolve;
    });
  });
  const { result, rerender } = renderHook(
    ({ active }) => {
      return useEnabledShare2025(active);
    },
    { initialProps: { active: true } }
  );
  await waitFor(() => {
    return expect(global.fetch).toHaveBeenCalledTimes(1);
  });
  rerender({ active: false });
  await act(async () => {
    return finish(response());
  });
  expect(result.current.snapshot).toBeNull();
});

test('ignores a late failure after unmount', async () => {
  let fail: (reason: Error) => void = () => {};
  global.fetch = jest.fn(() => {
    return new Promise<Response>((_resolve, reject) => {
      fail = reject;
    });
  });
  const { unmount } = renderHook(() => {
    return useEnabledShare2025(true);
  });
  await waitFor(() => {
    return expect(global.fetch).toHaveBeenCalledTimes(1);
  });
  unmount();
  await act(async () => {
    return fail(new Error('offline'));
  });
});
