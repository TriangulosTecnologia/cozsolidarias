/**
 * @jest-environment node
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  type Bbox,
  BRAZIL_BBOX,
  centerOf,
  fitZoom,
  SUDESTE_BBOX,
  viewForMode,
} from 'src/app/(features)/mapas/mapCamera';

/** A phone in portrait, minus the site header. */
const PHONE = { width: 360, height: 568 };

/** The desktop the map's previously fixed zoom of 4 framed Brazil on. */
const DESKTOP = { width: 1920, height: 1008 };

/** Nested coordinate arrays, as GeoJSON geometry carries them. */
type Coordinates = number[] | Coordinates[];

/** IBGE codes of the Southeast states the assentamentos data covers. */
const SUDESTE_CODES = ['31', '32', '33', '35'];

/**
 * The extent of the state geometry the map draws, optionally narrowed to some
 * state codes.
 *
 * @param codes - `codarea` values to keep; every state when omitted.
 * @returns The bounds of those features.
 */
const geometryBbox = (codes?: string[]): Bbox => {
  const geojson: {
    features: {
      properties: { codarea: string };
      geometry: { coordinates: Coordinates };
    }[];
  } = JSON.parse(
    readFileSync(
      path.resolve(__dirname, '../../../public/geo/estados.json'),
      'utf8'
    )
  );

  const bounds = {
    minLng: Number.POSITIVE_INFINITY,
    maxLng: Number.NEGATIVE_INFINITY,
    minLat: Number.POSITIVE_INFINITY,
    maxLat: Number.NEGATIVE_INFINITY,
  };

  const visit = (coordinates: Coordinates): void => {
    if (typeof coordinates[0] === 'number') {
      const [lng, lat] = coordinates as number[];

      bounds.minLng = Math.min(bounds.minLng, lng ?? 0);
      bounds.maxLng = Math.max(bounds.maxLng, lng ?? 0);
      bounds.minLat = Math.min(bounds.minLat, lat ?? 0);
      bounds.maxLat = Math.max(bounds.maxLat, lat ?? 0);

      return;
    }

    for (const nested of coordinates as Coordinates[]) {
      visit(nested);
    }
  };

  for (const feature of geojson.features) {
    if (!codes || codes.includes(feature.properties.codarea)) {
      visit(feature.geometry.coordinates);
    }
  }

  return bounds;
};

describe('the declared extents', () => {
  // The app frames its camera from these constants and never parses the
  // GeoJSON, so nothing at runtime would notice them drifting apart: replacing
  // the state geometry would leave the map framing the old territory, cropped
  // or off-centre, with no error anywhere.
  test('BRAZIL_BBOX still describes the state geometry', () => {
    expect(geometryBbox()).toEqual(BRAZIL_BBOX);
  });

  test('SUDESTE_BBOX still describes MG, ES, RJ and SP', () => {
    expect(geometryBbox(SUDESTE_CODES)).toEqual(SUDESTE_BBOX);
  });
});

describe('centerOf', () => {
  test('is the middle of the extent', () => {
    expect(centerOf(BRAZIL_BBOX)).toEqual([
      (BRAZIL_BBOX.minLng + BRAZIL_BBOX.maxLng) / 2,
      (BRAZIL_BBOX.minLat + BRAZIL_BBOX.maxLat) / 2,
    ]);
  });
});

describe('fitZoom', () => {
  test('pulls back far enough to clear the old zoom floor on a phone', () => {
    // The reason this exists: the camera used a fixed zoom of 4 with a
    // `maxZoomOut` of 4, and Brazil does not fit at 4 on a phone — so the
    // country was cropped and the floor stopped the user from zooming out.
    expect(fitZoom({ bbox: BRAZIL_BBOX, ...PHONE })).toBeLessThan(4);
  });

  test('reproduces the hand-picked zoom on the screen it was picked for', () => {
    expect(fitZoom({ bbox: BRAZIL_BBOX, ...DESKTOP })).toBeCloseTo(4, 1);
  });

  test('frames the Southeast closer than the whole country', () => {
    expect(fitZoom({ bbox: SUDESTE_BBOX, ...PHONE })).toBeGreaterThan(
      fitZoom({ bbox: BRAZIL_BBOX, ...PHONE })
    );
  });

  test('closes in as the viewport grows in both axes', () => {
    // Proportional sizes: area alone does not order the fits, since a taller
    // viewport can frame a height-bound extent closer than a wider one.
    expect(fitZoom({ bbox: BRAZIL_BBOX, ...PHONE })).toBeLessThan(
      fitZoom({
        bbox: BRAZIL_BBOX,
        width: PHONE.width * 2,
        height: PHONE.height * 2,
      })
    );
  });

  test('lets the height bind on a short, wide viewport', () => {
    expect(fitZoom({ bbox: BRAZIL_BBOX, width: 2000, height: 400 })).toBe(
      fitZoom({ bbox: BRAZIL_BBOX, width: 4000, height: 400 })
    );
  });
});

describe('viewForMode', () => {
  test('frames the Southeast for assentamentos and the country otherwise', () => {
    expect(viewForMode({ mode: 'assentamentos' }).center).toEqual(
      centerOf(SUDESTE_BBOX)
    );
    expect(viewForMode({ mode: 'pontos' }).center).toEqual(
      centerOf(BRAZIL_BBOX)
    );
  });

  test('keeps the pre-fit zooms when there is no container to measure', () => {
    // The server pass, where the map does not mount anyway; keeping the old
    // numbers means an unmeasured render is the previous behaviour, not a new
    // one.
    expect(viewForMode({ mode: 'pontos' }).zoom).toBe(4);
    expect(viewForMode({ mode: 'assentamentos' }).zoom).toBe(5);
  });

  test('fits the zoom to a measured container', () => {
    expect(viewForMode({ mode: 'pontos', viewport: PHONE }).zoom).toBe(
      fitZoom({ bbox: BRAZIL_BBOX, ...PHONE })
    );
  });

  test('ignores a container too small to frame anything', () => {
    expect(
      viewForMode({ mode: 'pontos', viewport: { width: 40, height: 40 } }).zoom
    ).toBe(4);
  });

  test('lowers the zoom floor to the country fit, so the framing is reachable', () => {
    // The bug this closes: a constant floor of 4 left a phone unable to zoom
    // out to the country it could not fit in the first place.
    const view = viewForMode({ mode: 'pontos', viewport: PHONE });

    expect(view.maxZoomOut).toBe(fitZoom({ bbox: BRAZIL_BBOX, ...PHONE }));
    expect(view.maxZoomOut).toBeLessThan(4);
  });

  test('keeps the country as the floor for the Southeast camera too', () => {
    // Every camera shared a single floor before, and still does: zooming out
    // from the assentamentos framing to the whole country stays possible.
    const view = viewForMode({ mode: 'assentamentos', viewport: PHONE });

    expect(view.maxZoomOut).toBe(fitZoom({ bbox: BRAZIL_BBOX, ...PHONE }));
    expect(view.zoom).toBeGreaterThan(view.maxZoomOut);
  });
});
