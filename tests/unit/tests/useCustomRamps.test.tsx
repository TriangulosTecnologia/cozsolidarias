/**
 * The ramps the reader builds: held by the page, and published to the module
 * that resolves a ramp id. How they reach the sidebar is covered in
 * mapaLeftSidebar.test.ts.
 */

import { act, renderHook } from '@testing-library/react';

import {
  colorRampOptions,
  rampPalette,
  setCustomRamps,
} from '@/app/(features)/mapas/mapaColorRamp';
import { useCustomRamps } from '@/app/(features)/mapas/useCustomRamps';

const MINE = {
  id: 'custom-1',
  label: 'Minha escala',
  colors: ['#dce6ef', '#8bb4d7', '#3382c5', '#164b79', '#0b2d4a'],
};

afterEach(() => {
  setCustomRamps([]);
});

test('opens with none of its own', () => {
  const { result } = renderHook(() => {
    return useCustomRamps();
  });

  expect(result.current.handlers.list).toEqual([]);
});

test('keeps what the sidebar reports', () => {
  const { result } = renderHook(() => {
    return useCustomRamps();
  });

  act(() => {
    result.current.handlers.onCreate({ option: MINE });
  });

  expect(result.current.handlers.list).toEqual([MINE]);
});

/*
 * The map paints from the chosen id, and the paint is memoized on it. Dropping
 * the ramp being read has to tell the page, or the sidebar falls back to its
 * first option while the map goes on showing the one that is gone.
 */
test('reports which ramp was dismissed', () => {
  const onRemoved = jest.fn();
  const { result } = renderHook(() => {
    return useCustomRamps({ onRemoved });
  });

  act(() => {
    result.current.handlers.onCreate({ option: MINE });
  });

  act(() => {
    result.current.handlers.onRemove({ id: 'custom-1' });
  });

  expect(onRemoved).toHaveBeenCalledWith({ id: 'custom-1' });
});

test('drops the one the reader dismissed', () => {
  const { result } = renderHook(() => {
    return useCustomRamps();
  });

  act(() => {
    result.current.handlers.onCreate({ option: MINE });
    result.current.handlers.onCreate({ option: { ...MINE, id: 'custom-2' } });
  });

  act(() => {
    result.current.handlers.onRemove({ id: 'custom-1' });
  });

  expect(result.current.handlers.list).toEqual([{ ...MINE, id: 'custom-2' }]);
});

/*
 * The config memo lists the handlers as a dependency, so their identity is the
 * only thing that can tell it the list changed. Stable across a plain render,
 * new once a ramp is built — the bug this pins is a ramp that is created and
 * never appears in the list.
 */
test('keeps one identity per list, and mints a new one when it changes', () => {
  const { result, rerender } = renderHook(() => {
    return useCustomRamps();
  });

  const first = result.current.handlers;
  rerender();
  expect(result.current.handlers).toBe(first);

  act(() => {
    result.current.handlers.onCreate({ option: MINE });
  });

  expect(result.current.handlers).not.toBe(first);
  expect(result.current.handlers.list).toEqual([MINE]);
});

/*
 * The scale functions are handed the chosen id and nothing else, so a built
 * ramp only repaints the map if the module can resolve it.
 */
test('publishes to the module that resolves a ramp id', () => {
  const { result } = renderHook(() => {
    return useCustomRamps();
  });

  act(() => {
    result.current.handlers.onCreate({ option: MINE });
  });

  expect(rampPalette({ rampId: 'custom-1', count: 5 })).toEqual(MINE.colors);
});

test('lists the reader ramps after the shipped ones, and only theirs is removable', () => {
  const { result } = renderHook(() => {
    return useCustomRamps();
  });

  act(() => {
    result.current.handlers.onCreate({ option: MINE });
  });

  const options = colorRampOptions({ custom: result.current.handlers.list });
  const last = options[options.length - 1];

  expect(last).toEqual(
    expect.objectContaining({ id: 'custom-1', removable: true })
  );
  expect(options[0].removable).toBeUndefined();
});

test('resolves nothing for a ramp it has never been told about', () => {
  expect(rampPalette({ rampId: 'custom-9', count: 5 })).toBeUndefined();
});
