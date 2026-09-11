/**
 * @jest-environment node
 */
import { buildSpec } from 'src/app/(features)/mapas/geovisSpec';

/*
 * `buildSpec` runs during SSR too, where there is no `window` to read an origin
 * from. It leaves the tile templates relative there — harmless, because that
 * pass has no map to feed either; the client pass rebuilds them absolute, which
 * is what MapLibre's tile worker needs.
 */
describe('buildSpec without a window (SSR)', () => {
  test('leaves the CAF tile templates relative', () => {
    const tiled = buildSpec([], 'cafs').sources.filter((source) => {
      return source.type === 'vector-tiles';
    });

    expect(
      tiled.map((source) => {
        return source.tiles;
      })
    ).toEqual([
      ['/tiles/caf-h3-r3/{z}/{x}/{y}.pbf'],
      ['/tiles/caf-h3-r4/{z}/{x}/{y}.pbf'],
      ['/tiles/caf-h3-r5/{z}/{x}/{y}.pbf'],
      ['/tiles/caf-h3-r6/{z}/{x}/{y}.pbf'],
      ['/tiles/cafs/{z}/{x}/{y}.pbf'],
    ]);
  });
});
