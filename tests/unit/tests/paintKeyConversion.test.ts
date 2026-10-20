import { convertPaintKeys } from 'src/app/api/ai/spec/paintKeyConversion';

describe('convertPaintKeys', () => {
  test('returns the spec unchanged when it declares no layers array', () => {
    const spec = { title: 'sem camadas' };

    expect(convertPaintKeys(spec)).toBe(spec);
  });

  test('leaves a layer that is not a record untouched', () => {
    const spec = { layers: ['camada-solta', 7] };

    expect(convertPaintKeys(spec)).toEqual({ layers: ['camada-solta', 7] });
  });

  test('renames kebab-case paint keys to spec keys, using the alias table when one applies', () => {
    const spec = {
      layers: [
        {
          id: 'a',
          paint: {
            'fill-color': '#fff',
            'fill-outline-color': '#000',
            'fill-opacity': 0.5,
          },
        },
      ],
    };

    expect(convertPaintKeys(spec)).toEqual({
      layers: [
        {
          id: 'a',
          paint: { fillColor: '#fff', lineColor: '#000', fillOpacity: 0.5 },
        },
      ],
    });
  });

  test('drops a kebab-case key when its camelCase twin is already present', () => {
    const spec = {
      layers: [
        {
          id: 'a',
          paint: { 'fill-color': '#111', fillColor: '#222' },
        },
      ],
    };

    expect(convertPaintKeys(spec)).toEqual({
      layers: [{ id: 'a', paint: { fillColor: '#222' } }],
    });
  });

  test('keeps kebab-case keys that name the same spec key as written (fill-outline-color resolves to line-color ), so the validator reports them', () => {
    const spec = {
      layers: [
        {
          id: 'a',
          paint: { 'fill-outline-color': '#000', 'line-color': '#fff' },
        },
      ],
    };

    expect(convertPaintKeys(spec)).toEqual({
      layers: [
        {
          id: 'a',
          paint: { 'fill-outline-color': '#000', 'line-color': '#fff' },
        },
      ],
    });
  });
});
