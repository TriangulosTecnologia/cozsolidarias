import type { LegendSpec, VisualizationSpec } from '@ttoss/geovis';

import type { KitchenRateByCity } from '@/data-gateway/schema';

/** A CadÚnico coverage: a rate on a base (people), or its inverse, people per cozinha. */
export type Coverage = number | 'pessoas';

/** The lines of a hover card under the município name. */
export type CardLines = {
  primary: string;
  secondary?: string;
  details?: string[];
};

/**
 * What a CadÚnico coverage `mapDataId` paints: the `/mapas`
 * `coropletico-cadunico` rate on any base (`cozinhas_por_<N>mil_cadunico`), or
 * its inverse `coropletico-pessoas-cozinha`. Repeated from the route catalogue
 * because the client cannot import it (it reaches the gateway). A rate's base
 * is read from its legend.
 */
const coverageKindOf = (mapDataId: string): 'rate' | 'pessoas' | undefined => {
  if (mapDataId === 'cadunico_pessoas_por_cozinha') {
    return 'pessoas';
  }
  return /^cozinhas_por_(?!0+(?:_0+)?mil)\d+(?:_\d+)?mil_cadunico$/.test(
    mapDataId
  )
    ? 'rate'
    : undefined;
};

/**
 * The coverage a layer paints: people per cozinha, or a rate on the base its
 * legend's geovis `normalization` carries (the route writes the one its id names).
 * A rate whose legend carries no base is no coverage: it keeps the plain card.
 *
 * @param params.mapDataId - The layer's `mapDataId`.
 * @param params.legend - The legend the layer is painted by.
 * @returns The {@link Coverage}, or `undefined` for any other layer.
 *
 * @example
 * coverageOf({ mapDataId: 'cadunico_pessoas_por_cozinha', legend: undefined }); // 'pessoas'
 */
export const coverageOf = (params: {
  mapDataId: string;
  legend: LegendSpec | undefined;
}): Coverage | undefined => {
  const kind = coverageKindOf(params.mapDataId);
  const normalization = params.legend?.normalization;
  if (kind === 'pessoas') {
    return 'pessoas';
  }
  return kind === 'rate' && normalization?.type === 'rate'
    ? normalization.rateBase
    : undefined;
};

/** "10 mil", "2,5 mil", "mil": a rate base as the `/mapas` cards write it. */
const baseLabel = (base: number): string => {
  return base === 1000 ? 'mil' : `${(base / 1000).toLocaleString('pt-BR')} mil`;
};

/**
 * Whether a spec paints a CadÚnico coverage, the case whose hover card needs
 * the per-município kitchen rows (see `withLegendHoverTooltips`).
 *
 * @param spec - The spec served by `/api/ai/spec`.
 * @returns `true` when a `mapData` entry is one of the CadÚnico coverage ids.
 *
 * @example
 * paintsCadunicoCoverage({ mapData: [{ mapDataId: 'cadunico_pessoas_por_cozinha' }] }); // true
 */
export const paintsCadunicoCoverage = (spec: VisualizationSpec): boolean => {
  return (spec.mapData ?? []).some(({ mapDataId }) => {
    return coverageKindOf(mapDataId) !== undefined;
  });
};

/** `"N cozinhas"` / `"1 cozinha"`, as the `/mapas` cards write it. */
const formatCozinhas = (quantidade: number): string => {
  return `${quantidade.toLocaleString('pt-BR')} ${
    quantidade === 1 ? 'cozinha' : 'cozinhas'
  }`;
};

/** "0,22 por 10 mil no CadÚnico" / "44.531 pessoas por cozinha". */
const coverageValueLine = (params: {
  coverage: Coverage;
  value: number;
}): string => {
  const { coverage, value } = params;
  return coverage === 'pessoas'
    ? `${value.toLocaleString('pt-BR')} pessoas por cozinha`
    : `${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} por ${baseLabel(coverage)} no CadÚnico`;
};

/** "N cozinhas · M no CadÚnico", from the município row; nothing without a CadÚnico count. */
const coverageCountsLine = (
  register: KitchenRateByCity | undefined
): string | undefined => {
  const pessoas = register?.pessoasCadUnico;
  return register && typeof pessoas === 'number'
    ? `${formatCozinhas(register.quantidade)} · ${pessoas.toLocaleString('pt-BR')} no CadÚnico`
    : undefined;
};

/**
 * The `/mapas` CadÚnico coverage lines of a coverage layer: the value line
 * and the kitchen and CadÚnico counts from the município row; "Sem cozinha
 * registrada" for the floor band.
 *
 * @param params.band - The painted band; `0` is the "no data" floor.
 * @param params.value - The município's value.
 * @param params.coverage - What the layer paints ({@link coverageOf}).
 * @param params.register - The município's kitchen row, if any.
 * @returns The {@link CardLines}, or `null` for any other layer.
 *
 * @example
 * coverageLinesOf({ band: 0, value: 0, coverage: 'pessoas', register: undefined }); // { primary: 'Sem cozinha registrada' }
 */
export const coverageLinesOf = (params: {
  band: number;
  value: number;
  coverage: Coverage | undefined;
  register: KitchenRateByCity | undefined;
}): CardLines | null => {
  const { band, value, coverage, register } = params;
  if (!coverage) {
    return null;
  }
  if (band === 0) {
    return { primary: 'Sem cozinha registrada' };
  }
  return {
    primary: coverageValueLine({ coverage, value }),
    secondary: coverageCountsLine(register),
  };
};
