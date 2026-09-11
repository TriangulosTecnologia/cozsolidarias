/**
 * The browser-environment store behind the map's camera fit, in the shape
 * `useSyncExternalStore` takes: a subscribe function, a client snapshot and a
 * server snapshot.
 *
 * A store rather than an effect because it answers "how big is the container
 * right now?" — a snapshot, not state to synchronise. That also keeps it clear
 * of the React compiler's `react-hooks/set-state-in-effect` rule, which the
 * `useState` + `useEffect` idiom would trip.
 */

/** Height of the fixed site header the map sits under, in CSS pixels. */
const HEADER_HEIGHT_PX = 72;

/**
 * The container available to the map, as a `"<width>x<height>"` snapshot.
 *
 * A string because `useSyncExternalStore` compares snapshots by identity: an
 * object would be a new reference on every read and loop forever.
 *
 * @returns The measured container, e.g. `"1440x828"`.
 *
 * @example
 * viewportSnapshot(); // '360x568' on a phone
 */
export const viewportSnapshot = (): string => {
  return `${window.innerWidth}x${window.innerHeight - HEADER_HEIGHT_PX}`;
};

/**
 * Nothing to measure while rendering on the server.
 *
 * @returns The empty snapshot.
 *
 * @example
 * emptyViewportSnapshot(); // ''
 */
export const emptyViewportSnapshot = (): string => {
  return '';
};

/**
 * Whether this environment can answer a media query. jsdom does not implement
 * `matchMedia`, and geovis's own `useCompactViewport` guards the same way.
 *
 * @returns `true` when `matchMedia` is callable.
 */
const supportsMatchMedia = () => {
  return (
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
  );
};

/**
 * Subscribes to orientation changes only — not to `resize`.
 *
 * Rotating a phone is a new framing and should refit the camera; dragging a
 * window edge is not, and refitting there would pull the camera back to the
 * whole country while the user was looking at a município.
 *
 * @param onStoreChange - React's snapshot invalidation callback.
 * @returns The unsubscribe function.
 *
 * @example
 * useSyncExternalStore(subscribeToOrientation, viewportSnapshot, emptyViewportSnapshot);
 */
export const subscribeToOrientation = (onStoreChange: () => void) => {
  if (!supportsMatchMedia()) {
    return () => {};
  }

  const query = window.matchMedia('(orientation: portrait)');

  query.addEventListener('change', onStoreChange);

  return () => {
    query.removeEventListener('change', onStoreChange);
  };
};

/**
 * Parses a {@link viewportSnapshot} back into numbers.
 *
 * @param snapshot - The store's snapshot.
 * @returns The container size, or `undefined` when there was none to measure.
 *
 * @example
 * parseViewport('360x568'); // { width: 360, height: 568 }
 * parseViewport(''); // undefined
 */
export const parseViewport = (snapshot: string) => {
  const [width, height] = snapshot.split('x').map(Number);

  return width && height ? { width, height } : undefined;
};
