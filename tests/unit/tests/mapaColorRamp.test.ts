import type { LegendSpec } from '@ttoss/geovis';
import {
  applyLegendRamp,
  colorRampOptions,
  DEFAULT_COLOR_RAMP,
  rampPalette,
} from 'src/app/(features)/mapas/mapaColorRamp';

/** The three channels of a `#rrggbb`. */
const channels = (color: string): number[] => {
  const hex = /^#(..)(..)(..)$/.exec(color);
  return (hex?.slice(1) ?? []).map((pair) => {
    return parseInt(pair, 16);
  });
};

/** Rough perceived lightness of a `#rrggbb`, enough to order two tones. */
const luminance = (color: string): number => {
  const [red, green, blue] = channels(color);
  return 0.299 * red + 0.587 * green + 0.114 * blue;
};

/** Which channel leads a colour — the hue's fingerprint, coarse but stable. */
const dominantChannel = (color: string): number => {
  const rgb = channels(color);
  return rgb.indexOf(Math.max(...rgb));
};

describe('colorRampOptions', () => {
  test('lists every ramp, each with swatches to read', () => {
    const options = colorRampOptions();

    expect(options).toHaveLength(4);
    for (const option of options) {
      expect(option.colors.length).toBeGreaterThan(1);
      for (const color of option.colors) {
        expect(color).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });

  test('opens on the ramp the block starts from', () => {
    expect(colorRampOptions()[0].id).toBe(DEFAULT_COLOR_RAMP);
  });

  /*
   * Single-hue throughout: light to dark in one colour, so the only thing
   * changing along a scale is how much of it there is. A row that drifted from
   * green to blue would leave the reader unable to say which hue carries the
   * number.
   */
  test('every option is one colour getting darker', () => {
    for (const option of colorRampOptions()) {
      const [lightest] = option.colors;
      const darkest = option.colors[option.colors.length - 1];

      expect(luminance(lightest)).toBeGreaterThan(luminance(darkest));
      expect(dominantChannel(lightest)).toBe(dominantChannel(darkest));
    }
  });
});

describe('rampPalette', () => {
  test('returns the asked-for number of colours, light to dark', () => {
    const colors = rampPalette({ rampId: 'laranja', count: 6 });

    expect(colors).toHaveLength(6);
    expect(colors?.[0]).not.toBe(colors?.[5]);
  });

  /*
   * `undefined` is the signal to leave a palette as its scale built it, which
   * is what keeps the modes with no ladder out of a re-colouring they never
   * asked for.
   */
  test('answers nothing without a choice, or for a ramp it does not know', () => {
    expect(rampPalette({ rampId: undefined, count: 6 })).toBeUndefined();
    expect(rampPalette({ rampId: 'roxo', count: 6 })).toBeUndefined();
  });
});

describe('applyLegendRamp', () => {
  const graduated = (): LegendSpec => {
    return {
      id: 'cozinhas',
      colorBy: {
        type: 'threshold',
        property: 'value',
        thresholds: [1, 3, 6],
        colors: ['#C6DBEF', '#6BAED6', '#2171B5', '#08306B'],
        defaultColor: '#DDDDDD',
      },
    } as LegendSpec;
  };

  test('redraws the bands and keeps their count', () => {
    const [legend] = applyLegendRamp({
      legends: [graduated()],
      rampId: 'vermelho',
    });
    const colors =
      legend.colorBy && 'colors' in legend.colorBy
        ? legend.colorBy.colors
        : undefined;

    expect(colors).toHaveLength(4);
    expect(colors).not.toEqual(['#C6DBEF', '#6BAED6', '#2171B5', '#08306B']);
  });

  /*
   * "Sem dado" is not a band of the scale. Dragging it into the ramp would turn
   * the one class the reader is meant to look past into the darkest thing on
   * the map.
   */
  test('leaves the no-data colour out of the ramp', () => {
    const [legend] = applyLegendRamp({
      legends: [graduated()],
      rampId: 'vermelho',
    });
    const defaultColor =
      legend.colorBy && 'defaultColor' in legend.colorBy
        ? legend.colorBy.defaultColor
        : undefined;

    expect(defaultColor).toBe('#DDDDDD');
  });

  test('leaves a categorical legend alone — it has no ladder to redraw', () => {
    const categorical = {
      id: 'status',
      colorBy: {
        type: 'categorical',
        property: 'value',
        mapping: { ativa: '#337C59' },
      },
    } as LegendSpec;

    expect(
      applyLegendRamp({ legends: [categorical], rampId: 'vermelho' })[0]
    ).toEqual(categorical);
  });

  /*
   * A ramp id that no longer exists — a permalink saved before the list
   * changed. The legend keeps the colours its scale built, which is the same
   * thing "Padrão" does, rather than losing its ladder to a missing palette.
   */
  test('a ramp it does not know leaves the legend as its scale built it', () => {
    const legend = graduated();

    expect(applyLegendRamp({ legends: [legend], rampId: 'roxo' })[0]).toEqual(
      legend
    );
  });

  test('an absent choice leaves every legend untouched', () => {
    const legends = [graduated()];

    expect(applyLegendRamp({ legends, rampId: undefined })).toBe(legends);
  });
});
