/**
 * Jenks natural-breaks classification for the choropleth legends.
 *
 * The maps' color scales are floored `threshold` scales: a fixed `floor`
 * separates the grey "sem dado" bin from the painted bands, and the remaining
 * cutpoints slice the significant values into classes. This module derives those
 * cutpoints from the data's own distribution (Jenks) instead of hand-picked
 * round numbers, while preserving the floor and the band count so the existing
 * color ramp and legend layout stay intact.
 *
 * The Jenks optimization is implemented directly (dynamic programming, no
 * dependency) so it can later move to a backend unchanged.
 */

/** A value classification derived from a dataset's distribution. */
export type Classification = {
  /** The classification method — currently only Jenks natural breaks. */
  method: 'jenks';
  /**
   * The threshold array `[floor, ...internalBreaks]`, same length as the
   * reference scale it replaces, or `null` when the significant data has fewer
   * distinct values than `classes` (caller should fall back to a fixed scale).
   */
  breaks: number[] | null;
  /**
   * Goodness of variance fit in `[0, 1]` — how well the breaks capture the
   * data's structure (1 = perfect, 0 = useless). `0` when `breaks` is `null`.
   */
  gvf: number;
};

/** Parameters for {@link classifyValues}. */
export type ClassifyValuesParams = {
  /** The raw values to classify; non-numeric entries (`string`/`null`/`undefined`) are ignored. */
  values: readonly (number | string | null | undefined)[];
  /**
   * The number of painted bands (equal to the reference scale's threshold
   * count), i.e. how many classes the significant values are split into.
   */
  classes: number;
  /**
   * The fixed lower bound of the first painted band. Values below it are the
   * grey "sem dado" bin and are excluded from the Jenks fit; it is prepended to
   * the result so the returned breaks keep the reference scale's shape.
   */
  floor: number;
};

/**
 * Sum of squared deviations from the mean for a slice of a sorted array — the
 * quantity Jenks minimizes within each class.
 */
const sumSquaredDeviations = (sorted: readonly number[]): number => {
  const length = sorted.length;
  const mean =
    sorted.reduce((total, value) => {
      return total + value;
    }, 0) / length;
  return sorted.reduce((total, value) => {
    const deviation = value - mean;
    return total + deviation * deviation;
  }, 0);
};

/**
 * Relaxes the DP boundary for classifying the first `i` values into 2..`classes`
 * classes, given the running within-class variance of the trailing class that
 * starts at `lower`. Extracted from {@link jenksClassLimits} to keep its loop
 * nesting shallow; mutates `variance`/`lowerClassLimits` in place.
 */
const relaxClassBoundary = ({
  variance,
  lowerClassLimits,
  classes,
  i,
  lower,
  previous,
  localVariance,
}: {
  variance: number[][];
  lowerClassLimits: number[][];
  classes: number;
  i: number;
  lower: number;
  previous: number;
  localVariance: number;
}): void => {
  for (let j = 2; j <= classes; j += 1) {
    const candidate = localVariance + variance[previous][j - 1];
    if (variance[i][j] >= candidate) {
      lowerClassLimits[i][j] = lower;
      variance[i][j] = candidate;
    }
  }
};

/**
 * Computes the Jenks natural-breaks class limits for sorted data via the
 * classic O(classes·n²) dynamic program. Returns `classes + 1` limits: the data
 * minimum, each class' lower limit, and the data maximum.
 */
const jenksClassLimits = (
  sorted: readonly number[],
  classes: number
): number[] => {
  const length = sorted.length;

  // lowerClassLimits[i][j] — the 1-based index in `sorted` where class j starts
  // when classifying the first i values; variance[i][j] — the minimal total
  // within-class deviation for that same subproblem.
  const lowerClassLimits: number[][] = [];
  const variance: number[][] = [];
  for (let i = 0; i <= length; i += 1) {
    lowerClassLimits.push(new Array<number>(classes + 1).fill(0));
    variance.push(new Array<number>(classes + 1).fill(0));
  }

  for (let j = 1; j <= classes; j += 1) {
    lowerClassLimits[1][j] = 1;
    for (let i = 2; i <= length; i += 1) {
      variance[i][j] = Infinity;
    }
  }

  for (let i = 2; i <= length; i += 1) {
    let sum = 0;
    let sumSquares = 0;
    let count = 0;
    let value = 0;
    for (let m = 1; m <= i; m += 1) {
      const lower = i - m + 1;
      value = sorted[lower - 1];
      count += 1;
      sum += value;
      sumSquares += value * value;
      const localVariance = sumSquares - (sum * sum) / count;
      const previous = lower - 1;
      if (previous !== 0) {
        relaxClassBoundary({
          variance,
          lowerClassLimits,
          classes,
          i,
          lower,
          previous,
          localVariance,
        });
      }
    }
    lowerClassLimits[i][1] = 1;
    variance[i][1] = sumSquares - (sum * sum) / count;
  }

  const limits = new Array<number>(classes + 1);
  limits[classes] = sorted[length - 1];
  limits[0] = sorted[0];
  let boundary = length;
  for (let j = classes; j >= 2; j -= 1) {
    const index = lowerClassLimits[boundary][j] - 1;
    limits[j - 1] = sorted[index];
    boundary = lowerClassLimits[boundary][j] - 1;
  }
  return limits;
};

/**
 * Goodness of variance fit for a set of class limits over sorted data: the
 * fraction of the total variance the classes explain.
 */
const goodnessOfVarianceFit = (
  sorted: readonly number[],
  limits: readonly number[]
): number => {
  const total = sumSquaredDeviations(sorted);
  let withinClasses = 0;
  let start = 0;
  for (let j = 1; j < limits.length; j += 1) {
    const upper = limits[j];
    // The last class is closed at the maximum; earlier classes are
    // upper-exclusive, matching the map's `value < threshold` binning.
    let end = start;
    while (
      end < sorted.length &&
      (j === limits.length - 1 ? sorted[end] <= upper : sorted[end] < upper)
    ) {
      end += 1;
    }
    withinClasses += sumSquaredDeviations(sorted.slice(start, end));
    start = end;
  }
  return (total - withinClasses) / total;
};

/**
 * Derives a floored Jenks natural-breaks classification from a set of values,
 * preserving a fixed `floor` and a fixed number of `classes` so the result can
 * replace a hand-picked threshold array without changing the color ramp or the
 * legend's shape.
 *
 * Null/undefined values and values below the `floor` are dropped before fitting
 * (they belong to the grey "sem dado" bin). When the remaining data has fewer
 * distinct values than `classes`, no meaningful split exists, so `breaks` is
 * `null` and the caller should keep its fixed fallback scale.
 *
 * @param params - The values, band count, and floor. See {@link ClassifyValuesParams}.
 * @returns The {@link Classification}: `breaks` of length `classes` (or `null`) and its `gvf`.
 *
 * @example
 * classifyValues({ values: [4, 5, 6, 18, 19, 40, 41], classes: 3, floor: 4 });
 * // → { method: 'jenks', breaks: [4, 18, 40], gvf: ~0.99 }
 */
export const classifyValues = ({
  values,
  classes,
  floor,
}: ClassifyValuesParams): Classification => {
  const significant = values
    .filter((value): value is number => {
      return (
        typeof value === 'number' && Number.isFinite(value) && value >= floor
      );
    })
    .sort((a, b) => {
      return a - b;
    });

  const distinct = new Set(significant).size;
  if (classes < 1 || distinct < classes) {
    return { method: 'jenks', breaks: null, gvf: 0 };
  }

  const limits = jenksClassLimits(significant, classes);
  // Keep the fixed floor as the first threshold; the interior limits
  // (`limits[1..classes-1]`) are the data-driven cutpoints between painted bands.
  const breaks = [floor, ...limits.slice(1, classes)];
  const gvf = goodnessOfVarianceFit(significant, limits);
  return { method: 'jenks', breaks, gvf };
};
