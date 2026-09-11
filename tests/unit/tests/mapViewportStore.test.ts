import {
  emptyViewportSnapshot,
  parseViewport,
  subscribeToOrientation,
  viewportSnapshot,
} from 'src/app/(features)/mapas/mapViewportStore';

/** Height the store subtracts for the fixed site header. */
const HEADER_HEIGHT_PX = 72;

describe('viewportSnapshot', () => {
  test('measures the window minus the header', () => {
    expect(viewportSnapshot()).toBe(
      `${window.innerWidth}x${window.innerHeight - HEADER_HEIGHT_PX}`
    );
  });

  test('is a string, so React can compare two reads', () => {
    // `useSyncExternalStore` compares snapshots by identity: an object would be
    // a new reference on every read and re-render forever.
    expect(typeof viewportSnapshot()).toBe('string');
    expect(viewportSnapshot()).toBe(viewportSnapshot());
  });
});

describe('emptyViewportSnapshot', () => {
  test('reports nothing to measure', () => {
    expect(emptyViewportSnapshot()).toBe('');
  });
});

describe('parseViewport', () => {
  test('reads a measured snapshot back into numbers', () => {
    expect(parseViewport('360x568')).toEqual({ width: 360, height: 568 });
  });

  test('returns undefined for the server snapshot', () => {
    expect(parseViewport('')).toBeUndefined();
  });

  test('returns undefined when either dimension is zero', () => {
    expect(parseViewport('0x568')).toBeUndefined();
    expect(parseViewport('360x0')).toBeUndefined();
  });
});

describe('subscribeToOrientation', () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: originalMatchMedia,
      writable: true,
    });
  });

  test('listens for orientation changes and stops on unsubscribe', () => {
    const addEventListener = jest.fn();
    const removeEventListener = jest.fn();
    const matchMedia = jest.fn().mockReturnValue({
      addEventListener,
      removeEventListener,
    });

    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: matchMedia,
      writable: true,
    });

    const onStoreChange = jest.fn();
    const unsubscribe = subscribeToOrientation(onStoreChange);

    // Orientation, not `resize`: rotating is a new framing and should refit,
    // while dragging a window edge must not pull the camera off wherever the
    // user had panned.
    expect(matchMedia).toHaveBeenCalledWith('(orientation: portrait)');
    expect(addEventListener).toHaveBeenCalledWith('change', onStoreChange);
    expect(removeEventListener).not.toHaveBeenCalled();

    unsubscribe();

    expect(removeEventListener).toHaveBeenCalledWith('change', onStoreChange);
  });

  test('no-ops where matchMedia does not exist', () => {
    // jsdom does not implement it, so this is the path the test environment
    // itself takes — and the one that would throw if left unguarded.
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: undefined,
      writable: true,
    });

    const unsubscribe = subscribeToOrientation(jest.fn());

    expect(() => {
      return unsubscribe();
    }).not.toThrow();
  });
});
