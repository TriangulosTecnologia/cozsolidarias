import type {
  CadinsanByCity,
  KitchenEnabledShare2025,
} from '@/data-gateway/schema';

import { sharedCadinsanQuintiles } from './cadinsanQuintiles';

export const MUNICIPAL_COVERAGE_LAYER_ID =
  'cozinhas-habilitacao-municipal-2025';
export const MUNICIPAL_COVERAGE_COLOR = '#0072B2';
export const REGISTERED_KITCHEN_COLOR = '#B8BDC5';
export const COVERAGE_TITLE = 'Habilitação municipal (Tm) — 2025';
export type CoverageRow = KitchenEnabledShare2025['municipalCoverage'][number];

/** Exact area proportionality, with a fixed national reference across scenarios. */
export const coverageRadius = (total: number, maximum: number): number => {
  return 38 * Math.sqrt(total / Math.max(2, maximum));
};

/** Relative thirds for the synthesis, computed jointly across income scenarios. */
export const coverageRiskBand = (
  value: number,
  cuts: readonly number[]
): number => {
  return cuts.filter((cut) => {
    return value >= cut;
  }).length;
};
export const BIVARIATE_COLORS = [
  '#e8e8e8',
  '#ace4e4',
  '#5ac8c8',
  '#dfb0d6',
  '#a5add3',
  '#5698b9',
  '#be64ac',
  '#8c62aa',
  '#3b4994',
];
export const coverageClass = (
  risk: number,
  tm: number,
  cuts: readonly number[]
): string => {
  return String(
    coverageRiskBand(risk, cuts) * 3 + coverageRiskBand(tm, [100 / 3, 200 / 3])
  );
};

/** Two equal-weight scenarios, paired on valid municipality observations. */
export const coverageRiskCuts = (rows: CadinsanByCity[]): number[] => {
  const sorted = rows
    .flatMap((row) => {
      return [row.proporcaoComPbf, row.proporcaoSemPbf];
    })
    .filter((n): n is number => {
      return n !== null && Number.isFinite(n);
    })
    .sort((a, b) => {
      return a - b;
    });
  if (!sorted.length) return [];
  return [1 / 3, 2 / 3].map((p) => {
    return sorted[Math.floor((sorted.length - 1) * p)];
  });
};

export const scenarioRisk = (
  row: CadinsanByCity | undefined,
  scenario: 'com' | 'sem'
): number | null | undefined => {
  return scenario === 'com' ? row?.proporcaoComPbf : row?.proporcaoSemPbf;
};

/** Pooled counts, never an unweighted mean of municipal percentages. */
export const coverageByQuintile = (
  coverage: CoverageRow[],
  cadinsan: CadinsanByCity[],
  scenario: 'com' | 'sem'
) => {
  const breaks = sharedCadinsanQuintiles(cadinsan).slice(1);
  const byCode = new Map(
    cadinsan.map((row) => {
      return [row.codigoIbge, row];
    })
  );
  const groups = Array.from({ length: breaks.length + 1 }, () => {
    return {
      enabled: 0,
      registered: 0,
      municipalities: 0,
    };
  });
  for (const row of coverage) {
    const riskRow = byCode.get(row.codigoIbge);
    const risk = scenarioRisk(riskRow, scenario);
    if (risk === null || risk === undefined) continue;
    const group = groups[coverageRiskBand(risk, breaks)];
    group.enabled += row.enabledCount;
    group.registered += row.registeredCount;
    group.municipalities += 1;
  }
  return groups;
};
