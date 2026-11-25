import {
  isMapType,
  MAP_TYPE_OPTIONS,
} from 'src/app/api/ai/spec/mapTypeOptions';
import { requirementsFrom } from 'src/app/api/ai/spec/specRequirements';

describe('MAP_TYPE_OPTIONS', () => {
  test('lists every geovis mapType with a pt-BR label', () => {
    expect(
      MAP_TYPE_OPTIONS.map((option) => {
        return option.value;
      })
    ).toEqual(['choropleth', 'dotDensity', 'proportionalCircles']);
    for (const option of MAP_TYPE_OPTIONS) {
      expect(option.label.length).toBeGreaterThan(0);
    }
  });
});

describe('isMapType', () => {
  test('accepts the listed types and rejects anything else', () => {
    expect(isMapType('dotDensity')).toBe(true);
    expect(isMapType('heatmap')).toBe(false);
    expect(isMapType(42)).toBe(false);
  });
});

describe('requirementsFrom', () => {
  test('adds an actionable fix to a known issue, keeping its path', () => {
    const [requirement] = requirementsFrom([
      {
        code: 'choropleth-on-absolute-total',
        path: 'mapType',
        message: 'x',
      },
    ]);

    expect(requirement).toMatchObject({
      code: 'choropleth-on-absolute-total',
      path: 'mapType',
      message: 'x',
    });
    expect(requirement.fix).toMatch(/proportionalCircles/);
  });

  test('lists the renderable datasets for an unsupported dataset', () => {
    const [requirement] = requirementsFrom([
      { code: 'unsupported-dataset', message: 'x' },
    ]);

    expect(requirement.fix).toMatch(/municipios_ivs/);
  });

  test('falls back to a generic fix for an inherited object key, never a non-string', () => {
    const [requirement] = requirementsFrom([
      { code: 'constructor', message: 'x' },
    ]);

    expect(typeof requirement.fix).toBe('string');
    expect(requirement.fix).toMatch(/Reformule/);
  });

  test.each([
    'ignored-user-map-type',
    'ignored-user-dataset',
    'period-not-covered',
    'multiple-painted-variables',
    'legend-count-mismatch',
    'points-spec-with-map-data',
    'concept-drift',
    'semantic-drift',
    'completeness-claim-on-partial-coverage',
    'missing-proxy-caveat',
    'missing-default-period-caveat',
  ])('gives %s its own fix, not the generic one', (code) => {
    const [requirement] = requirementsFrom([{ code, message: 'x' }]);
    const [generic] = requirementsFrom([{ code: 'whatever', message: 'x' }]);

    expect(requirement.fix).not.toBe(generic.fix);
  });

  test('falls back to a generic fix for an unknown code', () => {
    const [requirement] = requirementsFrom([
      { code: 'whatever', message: 'x' },
    ]);

    expect(requirement.fix.length).toBeGreaterThan(0);
  });
});
