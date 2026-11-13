import { applyProportionalCirclesDefaults } from 'src/app/api/ai/spec/specDefaults';

describe('applyProportionalCirclesDefaults', () => {
  test('leaves the spec unchanged when the size dataset has no string mapDataId', () => {
    const spec = {
      mapType: 'proportionalCircles',
      mapData: [{ dimension: 'size', mapDataId: 7, data: [{ value: 3 }] }],
      layers: [],
    };

    expect(applyProportionalCirclesDefaults(spec)).toBe(spec);
  });
});
