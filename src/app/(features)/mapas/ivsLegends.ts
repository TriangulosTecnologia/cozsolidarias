import type { LegendSpec } from '@ttoss/geovis';

import { mapTokens } from '@/config/theme';

import { WITHOUT_KITCHEN_COLOR } from './legendsBuilders';

/**
 * IVS faixas oficiais do Atlas da Vulnerabilidade Social (IPEA): five fixed
 * classes on the `[0, 1]` index. Break points are the class upper bounds, so
 * `value < 0.2` → "muito baixa", `[0.2, 0.3)` → "baixa", …, `>= 0.5` → "muito
 * alta". Every band is a real painted class; a município only goes grey when
 * it's absent from the IVS snapshot (see `IVS_FLOOR`). These four cutpoints
 * drive the tooltip (`colorForIvs` / `ivsFaixaLabel`); the fill legend prepends
 * `IVS_FLOOR` so "muito baixa" isn't swallowed by geovis' grey base bin.
 */
const IVS_THRESHOLDS = [0.2, 0.3, 0.4, 0.5];

/**
 * Leading **floor**, not a real cutpoint: geovis' `step` fill paints every
 * value *below the first break* with the grey `defaultColor`, and missing
 * municípios coalesce to `0`. Without a floor the whole "muito baixa" class
 * (`< 0.2`) would fall in that bin and render as "sem dado". Set just above `0`
 * so every positive score is painted; the shared IVS family scale reuses it,
 * and `ivs_infraestrutura_urbana` has real `0.0` values (44 municípios) that are
 * indistinguishable from the coalesced-`0` missing sentinel, so those
 * unavoidably stay grey.
 */
const IVS_FLOOR = 0.001;

/** Faixa names, one per band (`IVS_THRESHOLDS.length + 1`), low → high. */
const IVS_FAIXA_LABELS = [
  'Muito baixa',
  'Baixa',
  'Média',
  'Alta',
  'Muito alta',
];

/**
 * Legend swatch labels, one per rendered bin (`IVS_THRESHOLDS.length + 2`): the
 * first is the grey `defaultColor` base bin (município absent from the snapshot),
 * labelled "Sem dado"; the rest are the faixa name + its official IPEA class
 * range (`0,201` etc.), so they read as the canonical classification.
 */
const IVS_LEGEND_LABELS = [
  'Sem dado',
  'Muito baixa (≤ 0,200)',
  'Baixa (0,201–0,300)',
  'Média (0,301–0,400)',
  'Alta (0,401–0,500)',
  'Muito alta (≥ 0,501)',
];

/**
 * Single-hue red ramp for the IVS faixas (`IVS_THRESHOLDS.length + 1` steps):
 * light red = low vulnerability, dark red = high. Sampled at evenly spaced
 * indices of the brand `red` sequential ramp so the scale reads as a
 * monochromatic light→dark gradient — the more reddish the município, the higher
 * its social vulnerability.
 */
const IVS_COLORS = [
  mapTokens.dataviz.color.sequential[5][0], // muito baixa — light red
  mapTokens.dataviz.color.sequential[5][3], // baixa
  mapTokens.dataviz.color.sequential[5][6], // média
  mapTokens.dataviz.color.sequential[5][9], // alta
  mapTokens.dataviz.color.sequential[5][13], // muito alta — dark red
];

/**
 * Resolves the IVS-choropleth band color for an overall IVS score, mirroring the
 * `threshold` scale that paints the fill (`IVS_THRESHOLDS`/`IVS_COLORS`). A
 * `null` score (município missing from the IVS snapshot) resolves to
 * `WITHOUT_KITCHEN_COLOR` so the hover-tooltip swatch matches the "sem dado"
 * fill.
 *
 * @param ivs overall IVS score in `[0, 1]`, or `null` when unknown.
 * @returns the CSS color of the score's faixa.
 *
 * @example
 * colorForIvs(null); // → WITHOUT_KITCHEN_COLOR (grey "sem dado")
 * colorForIvs(0.15); // → the "muito baixa" light-red band
 */
export const colorForIvs = (ivs: number | null): string => {
  if (ivs === null) {
    return WITHOUT_KITCHEN_COLOR;
  }
  const index = IVS_THRESHOLDS.findIndex((threshold) => {
    return ivs < threshold;
  });
  return index === -1 ? IVS_COLORS[IVS_COLORS.length - 1] : IVS_COLORS[index];
};

/**
 * Resolves the IVS faixa name for a score (see `IVS_FAIXA_LABELS`), or `null`
 * when the score is unknown. Shared by the tooltip so the faixa it shows can't
 * drift from the band {@link colorForIvs} paints (both read `IVS_THRESHOLDS`).
 *
 * @param ivs overall IVS score in `[0, 1]`, or `null` when unknown.
 * @returns the faixa name (e.g. `'Média'`), or `null`.
 *
 * @example
 * ivsFaixaLabel(0.35); // → 'Média'
 * ivsFaixaLabel(null); // → null
 */
export const ivsFaixaLabel = (ivs: number | null): string | null => {
  if (ivs === null) {
    return null;
  }
  const index = IVS_THRESHOLDS.findIndex((threshold) => {
    return ivs < threshold;
  });
  return index === -1
    ? IVS_FAIXA_LABELS[IVS_FAIXA_LABELS.length - 1]
    : IVS_FAIXA_LABELS[index];
};

/**
 * Shared fill scale for the whole IVS family (overall IVS + the three
 * sub-indices): every one lives on the same `[0, 1]` IPEA scale, faixas and
 * colors, so they reuse a single floor-prefixed threshold/color pair and only
 * differ in copy. See `IVS_FLOOR` for why the floor leads the breaks.
 */
const IVS_FAMILY_THRESHOLDS = [IVS_FLOOR, ...IVS_THRESHOLDS];
const IVS_FAMILY_COLORS = [WITHOUT_KITCHEN_COLOR, ...IVS_COLORS];

/** Source note shared by the IVS-family legends: data vintage + IPEA classification. */
const IVS_FAMILY_REFERENCE =
  'Fonte dos dados: Atlas da Vulnerabilidade Social — IPEA (2010). Faixas de classificação conforme IPEA, Atlas da Vulnerabilidade Social nos Municípios Brasileiros (2015), seção "Como ler o IVS".';

/**
 * Id of the overall-IVS legend; also the fill's `activeLegendId` in
 * `coropletico-ivs` mode.
 *
 * @example
 * spec.legends?.find((legend) => legend.id === IVS_LEGEND_ID);
 */
export const IVS_LEGEND_ID = 'legenda-ivs';

/** Id of the IVS Infraestrutura Urbana sub-index legend. */
export const IVS_INFRA_LEGEND_ID = 'legenda-ivs-infraestrutura';

/** Id of the IVS Capital Humano sub-index legend. */
export const IVS_CAPITAL_LEGEND_ID = 'legenda-ivs-capital-humano';

/** Id of the IVS Renda e Trabalho sub-index legend. */
export const IVS_RENDA_LEGEND_ID = 'legenda-ivs-renda-trabalho';

/** Title of the IVS legend; also the menu label for the IVS choropleth. */
const IVS_LEGEND_TITLE = 'Índice de vulnerabilidade social';

/** Titles of the three IVS sub-index legends; also their menu labels. */
const IVS_INFRA_LEGEND_TITLE = 'IVS Infraestrutura Urbana';
const IVS_CAPITAL_LEGEND_TITLE = 'IVS Capital Humano';
const IVS_RENDA_LEGEND_TITLE = 'IVS Renda e Trabalho';

/**
 * The IVS-family legend ids, titles and subtitles the four IVS choropleth
 * variants (overall + three sub-indices) share everything except copy — each
 * one only varies the legend id, title, and subtitle text.
 */
const IVS_LEGEND_VARIANTS: {
  id: string;
  title: string;
  subtitleTopic: string;
}[] = [
  {
    id: IVS_LEGEND_ID,
    title: IVS_LEGEND_TITLE,
    subtitleTopic: 'a vulnerabilidade social (IVS)',
  },
  {
    id: IVS_INFRA_LEGEND_ID,
    title: IVS_INFRA_LEGEND_TITLE,
    subtitleTopic: 'a vulnerabilidade de infraestrutura urbana',
  },
  {
    id: IVS_CAPITAL_LEGEND_ID,
    title: IVS_CAPITAL_LEGEND_TITLE,
    subtitleTopic: 'a vulnerabilidade de capital humano',
  },
  {
    id: IVS_RENDA_LEGEND_ID,
    title: IVS_RENDA_LEGEND_TITLE,
    subtitleTopic: 'a vulnerabilidade de renda e trabalho',
  },
];

/**
 * Builds one of the four IVS-family legends (overall IVS or a sub-index),
 * selected by `legendId`. Every variant shares the same floor-prefixed
 * `IVS_FAMILY_THRESHOLDS`/`IVS_FAMILY_COLORS` scale and labels — only the
 * title/subtitle copy differs — since all four scores live on the same
 * `[0, 1]` IPEA scale.
 *
 * @param legendId one of `IVS_LEGEND_ID`, `IVS_INFRA_LEGEND_ID`,
 * `IVS_CAPITAL_LEGEND_ID`, `IVS_RENDA_LEGEND_ID`.
 * @returns the matching IVS-family `LegendSpec`.
 *
 * @example
 * buildIvsLegend(IVS_LEGEND_ID).id; // → IVS_LEGEND_ID
 */
export const buildIvsLegend = (legendId: string): LegendSpec => {
  const variant =
    IVS_LEGEND_VARIANTS.find((candidate) => {
      return candidate.id === legendId;
    }) ?? IVS_LEGEND_VARIANTS[0];

  return {
    id: variant.id,
    title: variant.title,
    subtitle: `Quanto mais avermelhado o município, maior ${variant.subtitleTopic}.`,
    position: 'bottom-right',
    // Floor-prefixed so geovis paints all five faixas: the base bin
    // (`< IVS_FLOOR`) is the grey "sem dado" swatch, and `[IVS_FLOOR, 0.2)` →
    // the muito-baixa color.
    colorBy: {
      type: 'quantitative',
      property: 'value',
      scale: 'threshold',
      thresholds: IVS_FAMILY_THRESHOLDS,
      colors: IVS_FAMILY_COLORS,
      defaultColor: WITHOUT_KITCHEN_COLOR,
    },
    labelFormat: { type: 'labels', labels: IVS_LEGEND_LABELS },
    reference: IVS_FAMILY_REFERENCE,
  };
};
