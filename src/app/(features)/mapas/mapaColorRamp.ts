/**
 * The colour-ramp setting: the ramps the reader can choose between, and the
 * re-colouring that carries a choice onto the map, its legend and its tooltips.
 *
 * Split from the scale modules because it is a different decision. A scale
 * answers "which band does this value fall in"; this answers "which colours is
 * that ladder read through". The bands, their breaks and their labels never
 * move — only the ramp they are drawn from.
 */

import type { LegendSpec } from '@ttoss/geovis';

import { mapTokens } from '@/config/mapTokens';

/**
 * The ramp every graduated fill opens on.
 *
 * One default for the whole sidebar rather than one per family: the setting
 * publishes a single value, so a per-family default would change as the reader
 * moved between variations. The IVS and IDHM scales are built on reds and
 * greens and are re-coloured to this like any other — their own palettes are a
 * choice away, not the starting point.
 */
export const DEFAULT_COLOR_RAMP = 'azul';

/** How many swatches a ramp shows in its row — enough to read the sweep. */
const SWATCHES = 5;

/**
 * The selectable ramps, in the order they are listed.
 *
 * Every one is sequential *and* single-hue: one colour going from light to
 * dark, so the only thing changing along the scale is how much of it there is.
 * The theme's `yellowOrange` and `greenBlue` are left out for that reason —
 * they travel between two hues, and a reader watching a map get greener as it
 * also gets bluer cannot tell which of the two carries the number. A diverging
 * ramp is out for the same reason and one more: it would claim a meaningful
 * midpoint, and none of these ladders has one.
 */
const RAMPS: { id: string; label: string; ramp: readonly string[] }[] = [
  { id: 'azul', label: 'Azul', ramp: mapTokens.dataviz.color.sequential[1] },
  { id: 'verde', label: 'Verde', ramp: mapTokens.dataviz.color.sequential[2] },
  {
    id: 'laranja',
    label: 'Laranja',
    ramp: mapTokens.dataviz.color.sequential[4],
  },
  {
    id: 'vermelho',
    label: 'Vermelho',
    ramp: mapTokens.dataviz.color.sequential[5],
  },
];

/**
 * `count` colours spread evenly across `ramp`, endpoints included.
 *
 * The same sampling the scale modules build their palettes with, which is what
 * makes a re-colour exact rather than approximate: re-sampling a legend's
 * colours to their own length from another ramp lands on the positions the
 * original palette was cut at.
 */
const sampleRamp = (ramp: readonly string[], count: number): string[] => {
  if (count <= 1) return [ramp[0]];

  return Array.from({ length: count }, (_, index) => {
    const position = Math.round((index * (ramp.length - 1)) / (count - 1));
    return ramp[position];
  });
};

/** A ramp the reader built, as the sidebar reports it. */
export type CustomRamp = { id: string; label: string; colors: string[] };

/**
 * The ramps the reader has built, held by the module that owns what a ramp is.
 *
 * Module state rather than a parameter because of where it has to be read: the
 * chosen ramp travels as one string — the shared selection holds nothing else —
 * and {@link rampPalette} is called from nine scale functions that receive that
 * string and nothing more. Threading a list through all nine to serve a lookup
 * this module already performs would spread the question "what is this id"
 * across the scales instead of keeping it here.
 *
 * `MapaPlayground` is the only writer, and it writes before it builds the spec,
 * so the list a repaint reads is the list the sidebar is showing.
 */
let customRamps: CustomRamp[] = [];

/**
 * Replaces the reader's ramps.
 *
 * @param ramps - The ramps, in listing order.
 *
 * @example
 * setCustomRamps([{ id: 'custom-1', label: 'Minha', colors: ['#eee', '#333'] }]);
 */
export const setCustomRamps = (ramps: CustomRamp[]): void => {
  customRamps = ramps;
};

/**
 * The block's options: every ramp, each showing the colours it stands for.
 *
 * @returns The options, in listing order.
 *
 * @example
 * colorRampOptions()[0]; // { id: 'azul', label: 'Azul', colors: [...] }
 */
export const colorRampOptions = ({
  custom = [],
}: { custom?: CustomRamp[] } = {}) => {
  return [
    ...RAMPS.map((entry) => {
      return {
        id: entry.id,
        label: entry.label,
        colors: sampleRamp(entry.ramp, SWATCHES),
      };
    }),
    // Taken as an argument rather than read from the module store: the sidebar
    // is built inside a memo, and a list it read invisibly would leave the
    // options frozen at whatever they were when the memo last ran — which is
    // exactly the bug that a ramp could be built and never appear.
    //
    // Only the reader's own carry `removable`: the ones the app ships are not
    // theirs to throw away.
    ...custom.map((ramp) => {
      return { ...ramp, removable: true };
    }),
  ];
};

/**
 * `count` colours from the chosen ramp, or `undefined` while the choice is
 * "Padrão" — which is the signal to leave a palette exactly as its scale built
 * it, rather than to rebuild it from a ramp that happens to match.
 *
 * @param params.rampId - The chosen ramp's id, if any.
 * @param params.count - How many bands the palette has.
 * @returns The replacement palette, or `undefined`.
 *
 * @example
 * rampPalette({ rampId: 'laranja', count: 6 });
 */
export const rampPalette = ({
  rampId,
  count,
}: {
  rampId?: string;
  count: number;
}): string[] | undefined => {
  const entry = RAMPS.find((candidate) => {
    return candidate.id === rampId;
  });

  if (entry) return sampleRamp(entry.ramp, count);

  // A ramp the reader built is re-sampled from the classes it was created with,
  // the same way a shipped one is re-sampled from its tokens.
  const built = customRamps.find((candidate) => {
    return candidate.id === rampId;
  });

  return built ? sampleRamp(built.colors, count) : undefined;
};

/**
 * Re-draws every graduated legend through the chosen ramp.
 *
 * Applied to the legends rather than to the layers, for the reason
 * `applyLegendOpacity` is: `resolveLegendFillColorExpression` builds the map's
 * `fill-color` from these same `colorBy.colors`, so one list drives the
 * polygons and their swatches and the two cannot come to disagree.
 *
 * Only `colors` is re-sampled. `defaultColor` is left alone — "sem dado" is not
 * a band of the scale, and dragging it into the ramp would turn the one class
 * the reader is meant to look past into the darkest thing on the map. Legends
 * that colour by `mapping` rather than by `colors` — the kitchen status, the
 * settlements — are categorical and have no ladder to redraw.
 *
 * @param params.legends - The legends as built for the mode.
 * @param params.rampId - The chosen ramp's id, or `undefined` for "Padrão".
 * @returns The legends, re-coloured.
 *
 * @example
 * applyLegendRamp({ legends, rampId: 'laranja' });
 */
export const applyLegendRamp = ({
  legends,
  rampId,
}: {
  legends: LegendSpec[];
  rampId?: string;
}): LegendSpec[] => {
  if (!rampId) {
    return legends;
  }

  return legends.map((legend) => {
    const { colorBy } = legend;
    if (!colorBy || !('colors' in colorBy) || !colorBy.colors) {
      return legend;
    }

    const colors = rampPalette({ rampId, count: colorBy.colors.length });
    if (!colors) {
      return legend;
    }

    return { ...legend, colorBy: { ...colorBy, colors } };
  });
};
