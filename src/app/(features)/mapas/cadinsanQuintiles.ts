import type { CadinsanByCity } from '@/data-gateway/schema';

/** Same reference population and cutpoints for both income scenarios. */
export const sharedCadinsanQuintiles = (rows: CadinsanByCity[]): number[] => {
  const values = rows
    .flatMap((row) => {
      return [row.proporcaoComPbf, row.proporcaoSemPbf];
    })
    .filter((value): value is number => {
      return typeof value === 'number' && Number.isFinite(value) && value >= 0;
    })
    .sort((a, b) => {
      return a - b;
    });
  if (!values.length) return [0];
  const cuts = [0.2, 0.4, 0.6, 0.8].map((p) => {
    const position = (values.length - 1) * p;
    const lower = Math.floor(position);
    return (
      values[lower] +
      (values[Math.ceil(position)] - values[lower]) * (position - lower)
    );
  });
  // Ties cannot be split into different colors; merge coincident boundaries.
  return [...new Set([0, ...cuts])];
};

/** Explicit half-open intervals; these are relative classes, not EBIA severity. */
export const quintileLabels = (breaks: readonly number[]): string[] => {
  const format = (n: number) => {
    return n.toLocaleString('pt-BR', { maximumFractionDigits: 4 });
  };
  return [
    'Sem dado',
    ...breaks.map((lower, i) => {
      const upper = breaks[i + 1];
      const interval =
        upper === undefined
          ? `≥ ${format(lower)}%`
          : `${format(lower)}% ≤ valor < ${format(upper)}%`;
      return `Q${i + 1}: ${interval}`;
    }),
  ];
};

export const isCadinsanMode = (mode: string): boolean => {
  return (
    mode === 'coropletico-cadinsan-com-pbf' ||
    mode === 'coropletico-cadinsan-sem-pbf'
  );
};
