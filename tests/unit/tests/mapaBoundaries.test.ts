import type { VisualizationLayer, VisualizationSpec } from '@ttoss/geovis';
import { liftOverlaysAboveBoundaries } from 'src/app/(features)/mapas/mapaBoundaries';

// `mapaBoundaries` builds its boundary groups at module load; stub the geovis
// helper so the module imports in the test env. The lift itself is pure.
jest.mock('@ttoss/geovis', () => {
  return {
    __esModule: true,
    createBoundaryGroup: () => {
      return { sources: [], layers: [] };
    },
  };
});

/** Builds a minimal spec whose layers carry only the ids under test. */
const specWithLayers = (ids: string[]): VisualizationSpec => {
  return {
    engine: 'maplibre',
    sources: [],
    layers: ids.map((id): VisualizationLayer => {
      return { id, sourceId: 'regions', geometry: 'polygon' };
    }),
  };
};

describe('liftOverlaysAboveBoundaries', () => {
  test('moves the point/circle overlays to the end, above the appended boundary lines', () => {
    const spec = specWithLayers([
      'cozinhas-pts',
      'municipios-br-fill',
      'estados-boundary-line',
    ]);

    const result = liftOverlaysAboveBoundaries(spec);

    expect(
      result.layers.map((layer) => {
        return layer.id;
      })
    ).toEqual(['municipios-br-fill', 'estados-boundary-line', 'cozinhas-pts']);
  });

  test('returns the spec unchanged when it carries no overlay layers', () => {
    const spec = specWithLayers([
      'municipios-br-fill',
      'estados-boundary-line',
    ]);

    expect(liftOverlaysAboveBoundaries(spec)).toBe(spec);
  });
});
