import type { RenderableDatasetId } from './mapDataCatalogue';

export type Variant = { id: RenderableDatasetId; label: string; match: RegExp };

type Family = {
  keyword: RegExp;
  defaultId: RenderableDatasetId;
  variants: Variant[];
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
    keyword: /cadinsan|cadunico|inseguranca alimentar/,
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
    keyword: /cozinha|atendid/,
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
