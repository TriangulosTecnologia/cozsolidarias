import { mapTokens } from '@/config/theme';

/**
 * The IVS and IDHM choropleth scales. Both families live on the `[0, 1]` index
 * with a five-class official faixa classification, so each shares one
 * floor-prefixed threshold/color pair (`*_FAMILY_*`) that every family member
 * reuses — the fill legend in `geovisScales` and the hover tooltip both read
 * these. IVS and IDHM run in opposite directions: higher IVS = more vulnerable
 * (red ramp), higher IDHM = better (green ramp).
 */

/** Grey fill for a município absent from the snapshot ("sem dado"). */
const SEM_DADO_COLOR = mapTokens.dataviz.color.status.masked;

/**
 * IVS faixas oficiais do Atlas da Vulnerabilidade Social (IPEA): five fixed
 * classes on the `[0, 1]` index. Break points are the class upper bounds, so
 * `value < 0.2` → "muito baixa", `[0.2, 0.3)` → "baixa", …, `>= 0.5` → "muito
 * alta". Every band is a real painted class; a município only goes grey when
 * it's absent from the IVS snapshot (see {@link SCORE_FLOOR}). These four cutpoints
 * drive the tooltip (`colorForIvs` / `ivsFaixaLabel`); the fill legend prepends
 * {@link SCORE_FLOOR} so "muito baixa" isn't swallowed by geovis' grey base bin.
 */
const IVS_THRESHOLDS = [0.2, 0.3, 0.4, 0.5];

/**
 * Leading **floor**, not a real cutpoint (see `PERCENT_THRESHOLDS`): geovis'
 * `step` fill paints every value *below the first break* with the grey
 * `defaultColor`, and missing municípios coalesce to `0`. Without a floor the
 * whole "muito baixa" class (`< 0.2`) would fall in that bin and render as "sem
 * dado". Set just above `0` so every positive score is painted; the IVS and IDHM
 * family scales both reuse it, and `ivs_infraestrutura_urbana` has real `0.0`
 * values (44 municípios) that are indistinguishable from the coalesced-`0`
 * missing sentinel, so those unavoidably stay grey.
 */
const SCORE_FLOOR = 0.001;

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
export const IVS_LEGEND_LABELS = [
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
 * `SEM_DADO_COLOR` so the hover-tooltip swatch matches the "sem dado" fill.
 *
 * @param ivs - Overall IVS score in `[0, 1]`, or `null` when unknown.
 * @returns The hex color for the score's faixa.
 *
 * @example
 * colorForIvs(null); // SEM_DADO_COLOR (grey "sem dado")
 * colorForIvs(0.15); // the "muito baixa" light-red band
 * colorForIvs(0.55); // the "muito alta" dark-red band
 */
export const colorForIvs = (ivs: number | null): string => {
  if (ivs === null) {
    return SEM_DADO_COLOR;
  }
  const index = IVS_THRESHOLDS.findIndex((threshold) => {
    return ivs < threshold;
  });
  return index === -1 ? IVS_COLORS[IVS_COLORS.length - 1] : IVS_COLORS[index];
};

/**
 * Resolves the IVS faixa name for a score (see {@link IVS_FAIXA_LABELS}), or
 * `null` when the score is unknown. Shared by the tooltip so the faixa it shows
 * can't drift from the band {@link colorForIvs} paints (both read
 * `IVS_THRESHOLDS`).
 *
 * @param ivs - Overall IVS score in `[0, 1]`, or `null` when unknown.
 * @returns The faixa name (e.g. `'Média'`), or `null`.
 *
 * @example
 * ivsFaixaLabel(0.35); // 'Média'
 * ivsFaixaLabel(null); // null
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
 * differ in copy. See {@link SCORE_FLOOR} for why the floor leads the breaks.
 */
export const IVS_FAMILY_THRESHOLDS = [SCORE_FLOOR, ...IVS_THRESHOLDS];
export const IVS_FAMILY_COLORS = [SEM_DADO_COLOR, ...IVS_COLORS];

/** Source note shared by the IVS-family legends: data vintage + IPEA classification. */
export const IVS_FAMILY_REFERENCE =
  'Fonte dos dados: Atlas da Vulnerabilidade Social — IPEA (2010). Faixas de classificação conforme IPEA, Atlas da Vulnerabilidade Social nos Municípios Brasileiros (2015), seção “Como ler o IVS”.';

/**
 * IDHM faixas oficiais de desenvolvimento humano (Atlas do Desenvolvimento
 * Humano): five fixed classes on the `[0, 1]` index. Break points are the class
 * upper bounds, so `value < 0.5` → "muito baixo", `[0.5, 0.6)` → "baixo", …,
 * `>= 0.8` → "muito alto". Unlike IVS, higher IDHM = *better*, so the ramp runs
 * from light (low development) to dark green (high). These four cutpoints drive
 * the tooltip (`colorForIdhm` / `idhmFaixaLabel`); the fill legend prepends
 * {@link SCORE_FLOOR} so "muito baixo" isn't swallowed by geovis' grey base bin.
 */
const IDHM_THRESHOLDS = [0.5, 0.6, 0.7, 0.8];

/** Faixa names, one per band (`IDHM_THRESHOLDS.length + 1`), low → high. */
const IDHM_FAIXA_LABELS = [
  'Muito baixo',
  'Baixo',
  'Médio',
  'Alto',
  'Muito alto',
];

/**
 * Legend swatch labels, one per rendered bin (`IDHM_THRESHOLDS.length + 2`): the
 * first is the grey `defaultColor` base bin (município absent from the snapshot),
 * labelled "Sem dado"; the rest are the faixa name + its official class range.
 */
export const IDHM_LEGEND_LABELS = [
  'Sem dado',
  'Muito baixo (≤ 0,499)',
  'Baixo (0,500–0,599)',
  'Médio (0,600–0,699)',
  'Alto (0,700–0,799)',
  'Muito alto (≥ 0,800)',
];

/**
 * Single-hue green ramp for the IDHM faixas (`IDHM_THRESHOLDS.length + 1` steps):
 * light green = low development, dark green = high. Sampled at evenly spaced
 * indices of the brand `green` sequential ramp so the scale reads as a
 * monochromatic light→dark gradient — the greener the município, the higher its
 * human development (the inverse reading of the IVS red ramp).
 */
const IDHM_COLORS = [
  mapTokens.dataviz.color.sequential[2][1], // muito baixo — light green
  mapTokens.dataviz.color.sequential[2][4], // baixo
  mapTokens.dataviz.color.sequential[2][7], // médio
  mapTokens.dataviz.color.sequential[2][11], // alto
  mapTokens.dataviz.color.sequential[2][13], // muito alto — dark green
];

/**
 * Resolves the IDHM-choropleth band color for a score, mirroring the `threshold`
 * scale that paints the fill (`IDHM_THRESHOLDS`/`IDHM_COLORS`). A `null` score
 * (município missing from the snapshot) resolves to `SEM_DADO_COLOR` so the
 * hover-tooltip swatch matches the "sem dado" fill.
 *
 * @param idhm - IDHM score in `[0, 1]`, or `null` when unknown.
 * @returns The hex color for the score's faixa.
 *
 * @example
 * colorForIdhm(null); // SEM_DADO_COLOR (grey "sem dado")
 * colorForIdhm(0.45); // the "muito baixo" light-green band
 * colorForIdhm(0.85); // the "muito alto" dark-green band
 */
export const colorForIdhm = (idhm: number | null): string => {
  if (idhm === null) {
    return SEM_DADO_COLOR;
  }
  const index = IDHM_THRESHOLDS.findIndex((threshold) => {
    return idhm < threshold;
  });
  return index === -1
    ? IDHM_COLORS[IDHM_COLORS.length - 1]
    : IDHM_COLORS[index];
};

/**
 * Resolves the IDHM faixa name for a score (see {@link IDHM_FAIXA_LABELS}), or
 * `null` when the score is unknown. Shared by the tooltip so the faixa it shows
 * can't drift from the band {@link colorForIdhm} paints (both read
 * `IDHM_THRESHOLDS`).
 *
 * @param idhm - IDHM score in `[0, 1]`, or `null` when unknown.
 * @returns The faixa name (e.g. `'Alto'`), or `null`.
 *
 * @example
 * idhmFaixaLabel(0.75); // 'Alto'
 * idhmFaixaLabel(null); // null
 */
export const idhmFaixaLabel = (idhm: number | null): string | null => {
  if (idhm === null) {
    return null;
  }
  const index = IDHM_THRESHOLDS.findIndex((threshold) => {
    return idhm < threshold;
  });
  return index === -1
    ? IDHM_FAIXA_LABELS[IDHM_FAIXA_LABELS.length - 1]
    : IDHM_FAIXA_LABELS[index];
};

/**
 * Shared fill scale for the whole IDHM family (overall IDHM + its dimensions and
 * education sub-components): every one lives on the same `[0, 1]` scale, faixas
 * and colors, so they reuse a single floor-prefixed threshold/color pair and only
 * differ in copy. See {@link SCORE_FLOOR} for why the floor leads the breaks.
 */
export const IDHM_FAMILY_THRESHOLDS = [SCORE_FLOOR, ...IDHM_THRESHOLDS];
export const IDHM_FAMILY_COLORS = [SEM_DADO_COLOR, ...IDHM_COLORS];

/** Source note shared by the IDHM-family legends: data vintage + classification. */
export const IDHM_FAMILY_REFERENCE =
  'Fonte dos dados: Atlas da Vulnerabilidade Social — IPEA (2010). Faixas de desenvolvimento humano conforme PNUD, Ipea e Fundação João Pinheiro, Atlas do Desenvolvimento Humano no Brasil.';
