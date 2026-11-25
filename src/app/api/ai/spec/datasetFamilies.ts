import type { RenderableDatasetId } from './mapDataCatalogue';

/** A dataset a prompt can name within its family. */
export type Variant = {
  id: RenderableDatasetId;
  label: string;
  match: RegExp;
};

type Family = {
  keyword: RegExp;
  defaultId: RenderableDatasetId;
  variants: Variant[];
};

/**
 * A prompt about how the cozinhas cover the CadÚnico population: it names both
 * and not food insecurity. Its family takes such a prompt from the CADINSAN
 * (`cadunico`) and kitchen (`cozinha`) families, which would both match it.
 */
const CADUNICO_COVERAGE =
  '(?=.*cozinha)(?=.*cadunico)(?!.*(?:inseguranca|cadinsan))';

/**
 * Dataset families whose variants a prompt can tell apart. `keyword` and
 * `match` run over the accent-stripped, lower-cased prompt.
 */
export const FAMILIES: Family[] = [
  {
    keyword: /\bivs\b/,
    defaultId: 'municipios_ivs',
    variants: [
      {
        id: 'municipios_ivs_infraestrutura',
        label: 'IVS – Infraestrutura urbana',
        match: /infraestrutura/,
      },
      {
        id: 'municipios_ivs_capital_humano',
        label: 'IVS – Capital humano',
        match: /capital humano/,
      },
      {
        id: 'municipios_ivs_renda_trabalho',
        label: 'IVS – Renda e trabalho',
        match: /renda|trabalho/,
      },
    ],
  },
  {
    keyword: /idhm/,
    defaultId: 'municipios_idhm',
    variants: [
      {
        id: 'municipios_idhm_longevidade',
        label: 'IDHM – Longevidade',
        match: /longevidade/,
      },
      {
        id: 'municipios_idhm_educacao',
        label: 'IDHM – Educação',
        match: /educacao/,
      },
      {
        id: 'municipios_idhm_educacao_escolaridade',
        label: 'IDHM – Educação (escolaridade)',
        match: /escolaridade/,
      },
      {
        id: 'municipios_idhm_educacao_frequencia',
        label: 'IDHM – Educação (frequência escolar)',
        match: /frequencia/,
      },
      { id: 'municipios_idhm_renda', label: 'IDHM – Renda', match: /renda/ },
    ],
  },
  {
    keyword: new RegExp(
      `^(?!${CADUNICO_COVERAGE}).*(?:cadinsan|cadunico|inseguranca alimentar)`,
      's'
    ),
    defaultId: 'municipios_cadinsan',
    variants: [
      {
        id: 'municipios_cadinsan',
        label: 'Insegurança alimentar com Bolsa Família',
        match: /com (o )?(pbf|bolsa)/,
      },
      {
        id: 'municipios_cadinsan_sem_pbf',
        label: 'Insegurança alimentar sem Bolsa Família',
        match: /sem (o )?(pbf|bolsa)/,
      },
    ],
  },
  {
    keyword: new RegExp(`^${CADUNICO_COVERAGE}`, 's'),
    defaultId: 'cozinhas_por_10mil_cadunico',
    variants: [
      {
        id: 'cozinhas_por_10mil_cadunico',
        label: 'Cozinhas por 10 mil pessoas no CadÚnico',
        match: /\b(?:10 mil|dez mil|10\.?000)\b/,
      },
      {
        id: 'cozinhas_por_100mil_cadunico',
        label: 'Cozinhas por 100 mil pessoas no CadÚnico',
        match: /\b(?:100 mil|cem mil|100\.?000)\b/,
      },
      {
        id: 'cadunico_pessoas_por_cozinha',
        label: 'Pessoas no CadÚnico por cozinha',
        match: /pessoas[\s\S]*\b(?:por|para cada) cozinha\b/,
      },
    ],
  },
  {
    keyword: new RegExp(`^(?!${CADUNICO_COVERAGE}).*(?:cozinha|atendid)`, 's'),
    defaultId: 'cozinhas_geolocalizadas',
    variants: [
      {
        id: 'cozinhas_geolocalizadas_2025',
        label: 'Cozinhas em 2025',
        match: /2025/,
      },
      {
        id: 'cozinhas_pessoas_atendidas',
        label: 'Pessoas atendidas pelas cozinhas',
        match: /atendid/,
      },
    ],
  },
];

/**
 * Every id of every family a prompt names: each family's default and all its
 * variants, once each, in {@link FAMILIES} order. The concept a prompt asks
 * for, as far as the families can tell it.
 *
 * @param text - The normalized prompt (see `normalize`).
 * @returns The ids; empty when the prompt names no family.
 *
 * @example
 * familyIdsOf('inseguranca alimentar'); // ['municipios_cadinsan', 'municipios_cadinsan_sem_pbf']
 */
export const familyIdsOf = (text: string): string[] => {
  const ids = FAMILIES.filter((family) => {
    return family.keyword.test(text);
  }).flatMap((family) => {
    return [
      family.defaultId,
      ...family.variants.map((variant) => {
        return variant.id;
      }),
    ];
  });
  return [...new Set(ids)];
};

/** "por N mil", "por 50mil", "a cada dez mil", "por mil": the thousands a prompt names. */
const BASE_IN_THOUSANDS =
  /\b(?:por|a cada|para cada) (?:cada )?(?:(\d+(?:,\d+)?|dez|cem) ?)?mil\b/;

/** "por 50k", "por 50 k": thousands written with `k`. */
const BASE_IN_K = /\b(?:por|a cada|para cada) (?:cada )?(\d+(?:,\d+)?) ?k\b/;

/**
 * "por 100.000", "para cada 20000", "por 5000 pessoas": a base written in full.
 * Four digits count only when followed by the people they count, so a year
 * ("por 2025") is not read as a base.
 */
const BASE_IN_UNITS =
  /\b(?:por|a cada|para cada) (?:cada )?(\d{1,3}(?:\.\d{3})+|\d{5,}|\d{4}(?= (?:pessoas|habitantes)\b))\b/;

/** The thousands a "por N mil" amount names: a number, "dez", "cem", or none ("por mil"). */
const countOf = (amount: string | undefined): number => {
  if (amount === undefined) {
    return 1;
  }
  const words: Record<string, number> = { dez: 10, cem: 100 };
  return words[amount] ?? Number(amount.replace(',', '.'));
};

/**
 * The rate base a prompt names ("por 50 mil pessoas" → `50_000`), read from
 * the accent-stripped, lower-cased prompt. It is the base a rate is computed
 * on when the prompt names one, whatever the id the agent picked: the route
 * serves the rate under the id that names it (`cadunicoRateId`).
 *
 * @param text - The normalized prompt.
 * @returns The base, in people, or `undefined` when the prompt names none.
 *
 * @example
 * rateBaseFromPrompt('cozinhas por 50 mil pessoas no cadunico'); // 50_000
 * rateBaseFromPrompt('pessoas no cadunico por cozinha'); // undefined
 */
export const rateBaseFromPrompt = (text: string): number | undefined => {
  const thousands = BASE_IN_THOUSANDS.exec(text);
  if (thousands) {
    return Math.round(countOf(thousands[1]) * 1000);
  }
  const k = BASE_IN_K.exec(text)?.[1];
  if (k !== undefined) {
    return Math.round(Number(k.replace(',', '.')) * 1000);
  }
  const units = BASE_IN_UNITS.exec(text)?.[1];
  return units === undefined ? undefined : Number(units.replaceAll('.', ''));
};
