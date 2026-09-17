import type { LegendSpec } from '@ttoss/geovis';

/**
 * A `#rrggbb` colour at `alpha`, as `rgba()`.
 *
 * Anything that is not a 6-digit hex is passed through untouched: the palettes
 * are hex today, and a silent wrong answer on some future `hsl()` would be
 * worse than leaving it opaque.
 */
const withAlpha = (color: string, alpha: number): string => {
  const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);
  if (!hex) {
    return color;
  }

  const [red, green, blue] = hex.slice(1).map((pair) => {
    return parseInt(pair, 16);
  });

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

/**
 * Re-colours every legend so its swatches carry the fill's opacity.
 *
 * The alpha rides in the COLOUR rather than in the layer's `fillOpacity`, and
 * that is the whole point: `resolveLegendFillColorExpression` builds the map's
 * `fill-color` from these same `colorBy.colors`, so one list drives both
 * surfaces and they cannot drift. Setting `fillOpacity` as well would multiply
 * with the alpha and land at the square of what was asked for.
 *
 * `defaultColor` is included — "sem dado" is as much a painted cell as any
 * other, and leaving it opaque would make the one class the reader is meant to
 * look past the most solid thing on the map.
 *
 * The swatch blends against the panel while the polygon blends against the
 * basemap, so the two are not the same pixel. They are the same translucency,
 * which is what the legend is claiming.
 *
 * @param params.legends - The legends as built for the mode.
 * @param params.fillOpacity - `0`..`1`, or `undefined` to leave them opaque.
 * @returns The legends, re-coloured.
 *
 * @example
 * applyLegendOpacity({ legends, fillOpacity: 0.6 });
 */
export const applyLegendOpacity = ({
  legends,
  fillOpacity,
}: {
  legends: LegendSpec[];
  fillOpacity?: number;
}): LegendSpec[] => {
  if (fillOpacity === undefined || fillOpacity >= 1) {
    return legends;
  }

  return legends.map((legend) => {
    const { colorBy } = legend;
    if (!colorBy) {
      return legend;
    }

    return {
      ...legend,
      colorBy: {
        ...colorBy,
        ...('colors' in colorBy && colorBy.colors
          ? {
              colors: colorBy.colors.map((color) => {
                return withAlpha(color, fillOpacity);
              }),
            }
          : {}),
        ...('defaultColor' in colorBy && colorBy.defaultColor
          ? { defaultColor: withAlpha(colorBy.defaultColor, fillOpacity) }
          : {}),
      },
    };
  });
};
