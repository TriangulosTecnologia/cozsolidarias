import type { RenderableDatasetId } from './mapDataCatalogue';

/**
 * A dataset a prompt can name within its family. `base` is the "per N people"
 * a CadÚnico coverage rate is painted on (see {@link variantBase}).
 */
export type Variant = {
  id: RenderableDatasetId;
  label: string;
  match: RegExp;
  base?: number;
};

type Family = {
  keyword: RegExp;
  defaultId: RenderableDatasetId;
  variants: Variant[];
};

/**
 * A prompt asking for cozinhas per CadÚnico people, or the inverse: the
 * coverage family answers it alone, so neither CadinSan (`cadunico`) nor the
 * kitchen count (`cozinha`) claims it too.
 */
const COVERAGE =
  /cozinhas? (?:por|a cada|para cada) .*cadunico|cadunico (?:por|a cada|para cada) cozinha/;

/** `keyword`, unless the prompt asks for a CadÚnico coverage ratio. */
const outsideCoverage = (keyword: RegExp): RegExp => {
  return new RegExp(`^(?!.*(?:${COVERAGE.source})).*(?:${keyword.source})`);
};

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
    keyword: outsideCoverage(/cadinsan|cadunico|inseguranca alimentar/),
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
    keyword: outsideCoverage(/cozinha|atendid/),
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
  {
    keyword: COVERAGE,
    defaultId: 'cozinhas_por_10mil_cadunico',
    variants: [
      {
        id: 'cozinhas_por_10mil_cadunico',
        label: 'Cozinhas por 10 mil pessoas no CadÚnico',
        match: /\b10 ?mil\b|\b10\.?000\b|\bdez mil\b/,
        base: 10_000,
      },
      {
        id: 'cozinhas_por_100mil_cadunico',
        label: 'Cozinhas por 100 mil pessoas no CadÚnico',
        match: /\b100 ?mil\b|\b100\.?000\b|\bcem mil\b/,
        base: 100_000,
      },
      {
        id: 'cadunico_pessoas_por_cozinha',
        label: 'Pessoas no CadÚnico por cozinha',
        match: /cadunico (?:por|a cada|para cada) cozinha/,
      },
    ],
  },
];

/**
 * The base (per N CadÚnico people) a coverage rate id is painted on: the
 * `base` its variant in {@link FAMILIES} carries, the one the prompt's `match`
 * picks.
 *
 * @param id - A renderable id painted per CadÚnico people.
 * @returns The variant's `base`.
 * @throws When no variant of that id carries a `base`.
 *
 * @example
 * variantBase('cozinhas_por_100mil_cadunico'); // 100_000
 */
export const variantBase = (id: string): number => {
  const base = FAMILIES.flatMap((family) => {
    return family.variants;
  }).find((variant) => {
    return variant.id === id;
  })?.base;
  if (base === undefined) {
    throw new Error(`No CadÚnico base for "${id}"`);
  }
  return base;
};

/**
 * Renderable ids that paint one field of a catalogue dataset: each is exposed
 * to the agent as its own entry whose `description` is that field's own
 * `description` (plus `note` when the field text omits what the id's scale
 * means), so the agent can tell IVS from IDHM and "com PBF" from "sem PBF".
 * A variant whose id equals its dataset's id replaces that dataset's entry.
 * `officialFaixas` marks an official IPEA index whose legend thresholds the
 * model must not reclassify (see `officialFaixasOf`).
 */
export const CATALOGUE_VARIANTS: Record<
  string,
  {
    datasetId: string;
    fieldName: string;
    note?: string;
    officialFaixas?: 'ivs' | 'idhm';
  }
> = {
  municipios_ivs: {
    datasetId: 'municipios_ivs',
    fieldName: 'ivs',
    officialFaixas: 'ivs',
  },
  municipios_ivs_infraestrutura: {
    datasetId: 'municipios_ivs',
    fieldName: 'ivs_infraestrutura_urbana',
    officialFaixas: 'ivs',
    note: 'Maior = mais vulnerável',
  },
  municipios_ivs_capital_humano: {
    datasetId: 'municipios_ivs',
    fieldName: 'ivs_capital_humano',
    officialFaixas: 'ivs',
    note: 'Maior = mais vulnerável',
  },
  municipios_ivs_renda_trabalho: {
    datasetId: 'municipios_ivs',
    fieldName: 'ivs_renda_e_trabalho',
    officialFaixas: 'ivs',
    note: 'Maior = mais vulnerável',
  },
  municipios_idhm: {
    datasetId: 'municipios_ivs',
    fieldName: 'idhm',
    officialFaixas: 'idhm',
    note: 'Maior = melhor desenvolvimento humano (escala oposta à do IVS)',
  },
  municipios_idhm_longevidade: {
    datasetId: 'municipios_ivs',
    fieldName: 'idhm_long',
    officialFaixas: 'idhm',
    note: 'Maior = melhor',
  },
  municipios_idhm_educacao: {
    datasetId: 'municipios_ivs',
    fieldName: 'idhm_educ',
    officialFaixas: 'idhm',
    note: 'Maior = melhor',
  },
  municipios_idhm_renda: {
    datasetId: 'municipios_ivs',
    fieldName: 'idhm_renda',
    officialFaixas: 'idhm',
    note: 'Maior = melhor',
  },
  municipios_idhm_educacao_escolaridade: {
    datasetId: 'municipios_ivs',
    fieldName: 'idhm_educ_sub_esc',
    officialFaixas: 'idhm',
    note: 'Maior = melhor',
  },
  municipios_idhm_educacao_frequencia: {
    datasetId: 'municipios_ivs',
    fieldName: 'idhm_educ_sub_freq',
    officialFaixas: 'idhm',
    note: 'Maior = melhor',
  },
  municipios_cadinsan_sem_pbf: {
    datasetId: 'municipios_cadinsan',
    fieldName: 'Cadinsan_absoluto_sem_PBF',
    note: 'O mapa pinta a proporção (%) sobre o total de cadastros do CadÚnico, não a contagem',
  },
  cozinhas_por_10mil_cadunico: {
    datasetId: 'municipios_cadunico',
    fieldName: 'pessoasCadastradas',
    note: 'O mapa pinta cozinhas por 10 mil pessoas no CadÚnico (cozinhas do município ÷ pessoas no CadÚnico × 10 mil), não a contagem de pessoas. Maior = mais cozinhas para a população do CadÚnico',
  },
  cozinhas_por_100mil_cadunico: {
    datasetId: 'municipios_cadunico',
    fieldName: 'pessoasCadastradas',
    note: 'O mapa pinta cozinhas por 100 mil pessoas no CadÚnico (cozinhas do município ÷ pessoas no CadÚnico × 100 mil), não a contagem de pessoas. Maior = mais cozinhas para a população do CadÚnico',
  },
  cadunico_pessoas_por_cozinha: {
    datasetId: 'municipios_cadunico',
    fieldName: 'pessoasCadastradas',
    note: 'O mapa pinta pessoas no CadÚnico por cozinha (pessoas no CadÚnico ÷ cozinhas do município), a razão inversa da cobertura. Maior = cada cozinha atende mais gente = cobertura mais fina',
  },
};
