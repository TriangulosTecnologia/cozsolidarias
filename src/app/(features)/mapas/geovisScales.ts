import type { LegendSpec } from '@ttoss/geovis';

import { classifyValues } from './classifyValues';
import { buildAssentamentoLegend } from './geovisAssentamentosScales';
import { buildCafHexbinLegend } from './geovisCafHexbin';
import { buildCafLegend } from './geovisCafLayers';
import {
  buildCountLabels,
  CADINSAN_COLORS,
  CADINSAN_LEGEND_LABELS,
  CADINSAN_THRESHOLDS,
  CADUNICO_COLORS,
  CADUNICO_LEGEND_LABELS,
  CADUNICO_THRESHOLDS,
  CAF_PERCENT_LEGEND_LABELS,
  CAF_PERCENT_THRESHOLDS,
  COLORS,
  flooredBinLabels,
  PERCENT_COLORS,
  PERCENT_LEGEND_LABELS,
  PERCENT_THRESHOLDS,
  PESSOAS_COZINHA_COLORS,
  PESSOAS_COZINHA_LEGEND_LABELS,
  PESSOAS_COZINHA_THRESHOLDS,
  RATE_COLORS,
  RATE_LEGEND_LABELS,
  RATE_THRESHOLDS,
  THRESHOLDS,
  WITHOUT_KITCHEN_COLOR,
} from './geovisChoroplethScales';
import type { MapMode } from './geovisMapMode';
import {
  IDHM_FAMILY_COLORS,
  IDHM_FAMILY_REFERENCE,
  IDHM_FAMILY_THRESHOLDS,
  IDHM_LEGEND_LABELS,
  IVS_FAMILY_COLORS,
  IVS_FAMILY_REFERENCE,
  IVS_FAMILY_THRESHOLDS,
  IVS_LEGEND_LABELS,
} from './geovisScoreScales';

/**
 * Re-exported so consumers keep importing the colour scales from here: the
 * caller asking "what colour is this value?" and the one asking "what legend
 * does this mode show?" are the same callers, and splitting the import would
 * only make them track which half moved.
 */
export type { LegendItem } from './geovisChoroplethScales';
export {
  buildLegendItems,
  colorForCadinsan,
  colorForCadUnico,
  colorForCafPercentual,
  colorForPercentual,
  colorForPessoasPorCozinha,
  colorForQuantidade,
  colorForTaxa,
} from './geovisChoroplethScales';
/** Re-exported so consumers keep importing the map's mode type from here. */
export type { MapMode };

const CHOROPLETH_LEGEND_ID = 'legenda-cozinhas';
const RATE_LEGEND_ID = 'legenda-taxa';
const PERCENT_LEGEND_ID = 'legenda-percentual';
const CAF_PERCENT_LEGEND_ID = 'legenda-cafs-percentual';
const CADINSAN_COM_PBF_LEGEND_ID = 'legenda-cadinsan-com-pbf';
const CADINSAN_SEM_PBF_LEGEND_ID = 'legenda-cadinsan-sem-pbf';
const CADUNICO_LEGEND_ID = 'legenda-cadunico';
const PESSOAS_COZINHA_LEGEND_ID = 'legenda-pessoas-cozinha';
const IVS_LEGEND_ID = 'legenda-ivs';
const IVS_INFRA_LEGEND_ID = 'legenda-ivs-infraestrutura';
const IVS_CAPITAL_LEGEND_ID = 'legenda-ivs-capital-humano';
const IVS_RENDA_LEGEND_ID = 'legenda-ivs-renda-trabalho';
const IDHM_LEGEND_ID = 'legenda-idhm';
const IDHM_LONG_LEGEND_ID = 'legenda-idhm-longevidade';
const IDHM_EDUC_LEGEND_ID = 'legenda-idhm-educacao';
const IDHM_RENDA_LEGEND_ID = 'legenda-idhm-renda';
const IDHM_EDUC_ESC_LEGEND_ID = 'legenda-idhm-educacao-escolaridade';
const IDHM_EDUC_FREQ_LEGEND_ID = 'legenda-idhm-educacao-frequencia';

/** Title of the rate legend; also the fill's `activeLegendId` in rate mode. */
const RATE_LEGEND_TITLE = 'nº coz. no município / 100.000 hab.';

/** Title of the share legend; also the fill's `activeLegendId` in share mode. */
const PERCENT_LEGEND_TITLE = '% das cozinhas do Brasil no município';

/** Title of the CAF-share legend; also the fill's `activeLegendId` in that mode. */
const CAF_PERCENT_LEGEND_TITLE = '% dos CAFs do Brasil no município';

/** Titles of the CADINSAN legends (scenario framing, not "who receives PBF"). */
const CADINSAN_COM_PBF_LEGEND_TITLE =
  'Insegurança alimentar no CadÚnico — cenário com o Bolsa Família';
const CADINSAN_SEM_PBF_LEGEND_TITLE =
  'Insegurança alimentar no CadÚnico — cenário sem o Bolsa Família';

/** Title of the CadÚnico legend; also the fill's `activeLegendId` in that mode. */
const CADUNICO_LEGEND_TITLE = 'nº coz. / 10 mil pessoas no CadÚnico';

/** Title of the coverage legend; also the fill's `activeLegendId` in that mode. */
const PESSOAS_COZINHA_LEGEND_TITLE = 'pessoas no CadÚnico por cozinha';

/** Title of the IVS legend; also the menu label for the IVS choropleth. */
const IVS_LEGEND_TITLE = 'Índice de vulnerabilidade social';

/** Titles of the three IVS sub-index legends; also their menu labels. */
const IVS_INFRA_LEGEND_TITLE = 'IVS Infraestrutura Urbana';
const IVS_CAPITAL_LEGEND_TITLE = 'IVS Capital Humano';
const IVS_RENDA_LEGEND_TITLE = 'IVS Renda e Trabalho';

/** Titles of the IDHM legends; also their menu labels. */
const IDHM_LEGEND_TITLE = 'Índice de Desenvolvimento Humano Municipal';
const IDHM_LONG_LEGEND_TITLE = 'IDHM Longevidade';
const IDHM_EDUC_LEGEND_TITLE = 'IDHM Educação';
const IDHM_RENDA_LEGEND_TITLE = 'IDHM Renda';
const IDHM_EDUC_ESC_LEGEND_TITLE = 'IDHM Educação — Escolaridade';
const IDHM_EDUC_FREQ_LEGEND_TITLE = 'IDHM Educação — Frequência Escolar';

/**
 * Per-variant legend config. `mode` is the {@link MapMode} that positions (and
 * therefore renders) this legend; every legend shares the same `colorBy`
 * skeleton and differs only in thresholds/colors/labels/copy.
 */
type LegendConfig = {
  id: string;
  mode: MapMode;
  title: string;
  subtitle: string;
  thresholds: number[];
  colors: string[];
  labels: string[];
  reference: string;
  noDataLabel?: string;
  /**
   * Rebuilds this scale's labels from a threshold array. Present only on the
   * ad-hoc (hand-picked) choropleths, which opt into data-driven Jenks breaks;
   * absent on the IVS/IDHM families, whose official faixa breaks never change.
   * Its presence is what marks a mode as Jenks-eligible (see {@link jenksBreaksForMode}).
   */
  labelsFrom?: (thresholds: readonly number[]) => string[];
};

const LEGEND_CONFIGS: LegendConfig[] = [
  {
    id: CHOROPLETH_LEGEND_ID,
    mode: 'coropletico',
    title: 'Cozinhas por município',
    subtitle: 'Quanto mais escuro o município, mais cozinhas cadastradas ali.',
    thresholds: THRESHOLDS,
    colors: COLORS,
    labels: buildCountLabels(THRESHOLDS),
    labelsFrom: buildCountLabels,
    reference: 'Fonte dos dados: © Cozinhas Solidárias',
  },
  {
    id: RATE_LEGEND_ID,
    mode: 'coropletico-taxa',
    title: RATE_LEGEND_TITLE,
    subtitle:
      'Quanto mais escuro o município, mais cozinhas por 100 mil habitantes.',
    thresholds: RATE_THRESHOLDS,
    colors: RATE_COLORS,
    labels: RATE_LEGEND_LABELS,
    labelsFrom: (thresholds) => {
      return flooredBinLabels('Sem dado', thresholds);
    },
    reference: 'Fontes: © Cozinhas Solidárias · IBGE (Censo 2022)',
  },
  {
    id: PERCENT_LEGEND_ID,
    mode: 'coropletico-percentual',
    title: PERCENT_LEGEND_TITLE,
    subtitle:
      'Quanto mais escuro o município, maior a fatia das cozinhas do Brasil ali.',
    thresholds: PERCENT_THRESHOLDS,
    colors: PERCENT_COLORS,
    labels: PERCENT_LEGEND_LABELS,
    labelsFrom: (thresholds) => {
      return flooredBinLabels('Sem cozinha', thresholds, '%');
    },
    reference: 'Fonte dos dados: © Cozinhas Solidárias',
  },
  {
    id: CAF_PERCENT_LEGEND_ID,
    mode: 'coropletico-cafs-percentual',
    title: CAF_PERCENT_LEGEND_TITLE,
    subtitle:
      'Quanto mais escuro o município, maior a fatia dos CAFs do Brasil ali.',
    thresholds: CAF_PERCENT_THRESHOLDS,
    colors: PERCENT_COLORS,
    labels: CAF_PERCENT_LEGEND_LABELS,
    labelsFrom: (thresholds) => {
      return flooredBinLabels('Sem CAF', thresholds, '%');
    },
    reference:
      'Fonte dos dados: Cadastro Nacional da Agricultura Familiar (CAF)',
  },
  {
    id: CADINSAN_COM_PBF_LEGEND_ID,
    mode: 'coropletico-cadinsan-com-pbf',
    title: CADINSAN_COM_PBF_LEGEND_TITLE,
    subtitle:
      'Parcela das famílias do CadÚnico em insegurança alimentar já considerando o alívio do Bolsa Família. Compare com o cenário sem para ver o efeito do programa.',
    thresholds: CADINSAN_THRESHOLDS,
    colors: CADINSAN_COLORS,
    labels: CADINSAN_LEGEND_LABELS,
    labelsFrom: (thresholds) => {
      return flooredBinLabels('Sem dado', thresholds, '%');
    },
    reference: 'Fonte dos dados: MDS — CADINSAN 2025 (base do CadÚnico)',
  },
  {
    id: CADINSAN_SEM_PBF_LEGEND_ID,
    mode: 'coropletico-cadinsan-sem-pbf',
    title: CADINSAN_SEM_PBF_LEGEND_TITLE,
    subtitle:
      'Parcela das famílias do CadÚnico que estariam em insegurança alimentar se não houvesse o Bolsa Família. Quanto mais escuro, maior a parcela.',
    thresholds: CADINSAN_THRESHOLDS,
    colors: CADINSAN_COLORS,
    labels: CADINSAN_LEGEND_LABELS,
    labelsFrom: (thresholds) => {
      return flooredBinLabels('Sem dado', thresholds, '%');
    },
    reference: 'Fonte dos dados: MDS — CADINSAN 2025 (base do CadÚnico)',
  },
  {
    id: CADUNICO_LEGEND_ID,
    mode: 'coropletico-cadunico',
    title: CADUNICO_LEGEND_TITLE,
    subtitle:
      'Quanto mais escuro o município, mais cozinhas por 10 mil pessoas no CadÚnico.',
    thresholds: CADUNICO_THRESHOLDS,
    colors: CADUNICO_COLORS,
    labels: CADUNICO_LEGEND_LABELS,
    labelsFrom: (thresholds) => {
      return flooredBinLabels('Sem cozinha', thresholds);
    },
    reference: 'Fontes: © Cozinhas Solidárias · MDS/SAGI (CadÚnico, jun/2026)',
  },
  {
    id: PESSOAS_COZINHA_LEGEND_ID,
    mode: 'coropletico-pessoas-cozinha',
    title: PESSOAS_COZINHA_LEGEND_TITLE,
    subtitle:
      'Quanto mais escuro o município, mais pessoas do CadÚnico para cada cozinha.',
    thresholds: PESSOAS_COZINHA_THRESHOLDS,
    colors: PESSOAS_COZINHA_COLORS,
    labels: PESSOAS_COZINHA_LEGEND_LABELS,
    labelsFrom: (thresholds) => {
      return flooredBinLabels('Sem cozinha', thresholds);
    },
    reference: 'Fontes: © Cozinhas Solidárias · MDS/SAGI (CadÚnico, jun/2026)',
  },
  {
    id: IVS_LEGEND_ID,
    mode: 'coropletico-ivs',
    title: IVS_LEGEND_TITLE,
    subtitle:
      'Quanto mais avermelhado o município, maior a vulnerabilidade social (IVS).',
    // Floor-prefixed so geovis paints all five faixas: the base bin (`< SCORE_FLOOR`)
    // is the grey "sem dado" swatch, and `[SCORE_FLOOR, 0.2)` → the muito-baixa color.
    thresholds: IVS_FAMILY_THRESHOLDS,
    colors: IVS_FAMILY_COLORS,
    labels: IVS_LEGEND_LABELS,
    reference: IVS_FAMILY_REFERENCE,
  },
  {
    id: IVS_INFRA_LEGEND_ID,
    mode: 'coropletico-ivs-infraestrutura',
    title: IVS_INFRA_LEGEND_TITLE,
    subtitle:
      'Quanto mais avermelhado o município, maior a vulnerabilidade de infraestrutura urbana.',
    thresholds: IVS_FAMILY_THRESHOLDS,
    colors: IVS_FAMILY_COLORS,
    labels: IVS_LEGEND_LABELS,
    reference: IVS_FAMILY_REFERENCE,
  },
  {
    id: IVS_CAPITAL_LEGEND_ID,
    mode: 'coropletico-ivs-capital-humano',
    title: IVS_CAPITAL_LEGEND_TITLE,
    subtitle:
      'Quanto mais avermelhado o município, maior a vulnerabilidade de capital humano.',
    thresholds: IVS_FAMILY_THRESHOLDS,
    colors: IVS_FAMILY_COLORS,
    labels: IVS_LEGEND_LABELS,
    reference: IVS_FAMILY_REFERENCE,
  },
  {
    id: IVS_RENDA_LEGEND_ID,
    mode: 'coropletico-ivs-renda-trabalho',
    title: IVS_RENDA_LEGEND_TITLE,
    subtitle:
      'Quanto mais avermelhado o município, maior a vulnerabilidade de renda e trabalho.',
    thresholds: IVS_FAMILY_THRESHOLDS,
    colors: IVS_FAMILY_COLORS,
    labels: IVS_LEGEND_LABELS,
    reference: IVS_FAMILY_REFERENCE,
  },
  {
    id: IDHM_LEGEND_ID,
    mode: 'coropletico-idhm',
    title: IDHM_LEGEND_TITLE,
    subtitle:
      'Quanto mais escuro (verde) o município, maior o desenvolvimento humano (IDHM).',
    // Floor-prefixed so geovis paints all five faixas: the base bin (`< SCORE_FLOOR`)
    // is the grey "sem dado" swatch, and `[SCORE_FLOOR, 0.5)` → the muito-baixo color.
    thresholds: IDHM_FAMILY_THRESHOLDS,
    colors: IDHM_FAMILY_COLORS,
    labels: IDHM_LEGEND_LABELS,
    reference: IDHM_FAMILY_REFERENCE,
  },
  {
    id: IDHM_LONG_LEGEND_ID,
    mode: 'coropletico-idhm-longevidade',
    title: IDHM_LONG_LEGEND_TITLE,
    subtitle:
      'Quanto mais escuro (verde) o município, maior o desenvolvimento em longevidade.',
    thresholds: IDHM_FAMILY_THRESHOLDS,
    colors: IDHM_FAMILY_COLORS,
    labels: IDHM_LEGEND_LABELS,
    reference: IDHM_FAMILY_REFERENCE,
  },
  {
    id: IDHM_EDUC_LEGEND_ID,
    mode: 'coropletico-idhm-educacao',
    title: IDHM_EDUC_LEGEND_TITLE,
    subtitle:
      'Quanto mais escuro (verde) o município, maior o desenvolvimento em educação.',
    thresholds: IDHM_FAMILY_THRESHOLDS,
    colors: IDHM_FAMILY_COLORS,
    labels: IDHM_LEGEND_LABELS,
    reference: IDHM_FAMILY_REFERENCE,
  },
  {
    id: IDHM_RENDA_LEGEND_ID,
    mode: 'coropletico-idhm-renda',
    title: IDHM_RENDA_LEGEND_TITLE,
    subtitle:
      'Quanto mais escuro (verde) o município, maior o desenvolvimento em renda.',
    thresholds: IDHM_FAMILY_THRESHOLDS,
    colors: IDHM_FAMILY_COLORS,
    labels: IDHM_LEGEND_LABELS,
    reference: IDHM_FAMILY_REFERENCE,
  },
  {
    id: IDHM_EDUC_ESC_LEGEND_ID,
    mode: 'coropletico-idhm-educacao-escolaridade',
    title: IDHM_EDUC_ESC_LEGEND_TITLE,
    subtitle:
      'Quanto mais escuro (verde) o município, maior o subíndice de escolaridade da educação.',
    thresholds: IDHM_FAMILY_THRESHOLDS,
    colors: IDHM_FAMILY_COLORS,
    labels: IDHM_LEGEND_LABELS,
    reference: IDHM_FAMILY_REFERENCE,
  },
  {
    id: IDHM_EDUC_FREQ_LEGEND_ID,
    mode: 'coropletico-idhm-educacao-frequencia',
    title: IDHM_EDUC_FREQ_LEGEND_TITLE,
    subtitle:
      'Quanto mais escuro (verde) o município, maior o subíndice de frequência escolar da educação.',
    thresholds: IDHM_FAMILY_THRESHOLDS,
    colors: IDHM_FAMILY_COLORS,
    labels: IDHM_LEGEND_LABELS,
    reference: IDHM_FAMILY_REFERENCE,
  },
];

/**
 * Builds every choropleth legend from {@link LEGEND_CONFIGS}. `geovis`'
 * `GeoVisProvider` auto-renders any legend that carries a `position`, so only
 * the legend whose `mode` matches the active mode is positioned (and therefore
 * rendered); the others keep the same `colorBy` (still driving fill/tooltip) but
 * stay hidden.
 *
 * The `assentamentos` and `cafs` modes position a **categorical** legend
 * instead of a quantitative one (settlement status → color, CAF density →
 * color); both are appended after the choropleth legends and only positioned
 * when their own mode is active.
 *
 * @param mode - Active {@link MapMode}; positions the matching legend.
 * @returns One {@link LegendSpec} per choropleth variant, plus the settlement one.
 *
 * @example
 * buildLegends('coropletico-taxa').find((l) => l.position); // the rate legend
 * buildLegends('assentamentos').find((l) => l.position); // the settlement legend
 * buildLegends('cafs').find((l) => l.position); // the CAF density legend
 */
export const buildLegends = (
  mode: MapMode,
  jenksBreaks?: number[] | null
): LegendSpec[] => {
  const choropleths = LEGEND_CONFIGS.map((config): LegendSpec => {
    // Only the active ad-hoc choropleth swaps its hand-picked thresholds for the
    // data-driven Jenks breaks (rebuilding its labels to match). The fill and
    // the legend share this `colorBy`, so the single swap moves both together;
    // the IVS/IDHM families (no `labelsFrom`) keep their fixed official faixas.
    const jenks =
      config.labelsFrom && jenksBreaks && config.mode === mode
        ? jenksBreaks
        : null;
    const thresholds = jenks ?? config.thresholds;
    const labels =
      jenks && config.labelsFrom ? config.labelsFrom(jenks) : config.labels;
    return {
      id: config.id,
      title: config.title,
      subtitle: config.subtitle,
      ...(mode === config.mode
        ? { position: 'bottom-right' as const, offset: 12 }
        : {}),
      colorBy: {
        type: 'quantitative',
        property: 'value',
        scale: 'threshold',
        thresholds,
        colors: config.colors,
        defaultColor: WITHOUT_KITCHEN_COLOR,
      },
      labelFormat: { type: 'labels', labels },
      ...(config.noDataLabel ? { noDataLabel: config.noDataLabel } : {}),
      reference: config.reference,
    };
  });

  return [
    ...choropleths,
    buildAssentamentoLegend(mode === 'assentamentos'),
    buildCafLegend(mode === 'cafs'),
    buildCafHexbinLegend(mode === 'cafs-hexbin'),
  ];
};

/**
 * Computes the Jenks natural-breaks thresholds for a mode's painted values,
 * preserving the mode's fixed floor and band count so the result is a drop-in
 * replacement for its hand-picked threshold array. Returns `null` for modes that
 * are not Jenks-eligible — the IVS/IDHM families (official faixas) and the
 * non-choropleth overlays — or when the data has too few distinct values to
 * split; the caller then keeps the fixed scale.
 *
 * @param mode - Active {@link MapMode}.
 * @param values - The values the mode paints (the choropleth `mapData` rows' values).
 * @returns The `[floor, ...breaks]` threshold array, or `null` to keep the fixed scale.
 *
 * @example
 * jenksBreaksForMode('coropletico', [1, 1, 2, 8, 40]); // data-driven breaks
 * jenksBreaksForMode('coropletico-ivs', values); // null (official faixas)
 */
export const jenksBreaksForMode = (
  mode: MapMode,
  values: readonly (number | string | null | undefined)[]
): number[] | null => {
  const config = LEGEND_CONFIGS.find((entry) => {
    return entry.mode === mode;
  });
  if (!config?.labelsFrom) {
    return null;
  }
  return classifyValues({
    values,
    classes: config.thresholds.length,
    floor: config.thresholds[0],
  }).breaks;
};

/**
 * The id of the legend whose choropleth the given mode paints — used as the fill
 * layer's `activeLegendId`. Falls back to the count legend for the non-metric
 * modes (`coropletico`, `pontos`, `circulos`).
 *
 * @param mode - Active {@link MapMode}.
 * @returns The matching legend id, or the count legend id as fallback.
 *
 * @example
 * legendIdForMode('coropletico-taxa'); // 'legenda-taxa'
 * legendIdForMode('pontos'); // 'legenda-cozinhas'
 */
export const legendIdForMode = (mode: MapMode): string => {
  const match = LEGEND_CONFIGS.find((config) => {
    return config.mode === mode;
  });
  return match?.id ?? CHOROPLETH_LEGEND_ID;
};
