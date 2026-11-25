/**
 * Renderable ids that paint one field of a catalogue dataset: each is exposed
 * to the agent as its own entry whose `description` is that field's own
 * `description` (plus `note` when the field text omits what the id's scale
 * means), so the agent can tell IVS from IDHM and "com PBF" from "sem PBF".
 * A variant whose id equals its dataset's id replaces that dataset's entry.
 * `officialFaixas` marks an official IPEA index whose legend thresholds the
 * model must not reclassify (see `officialFaixasOf`). A ratio no single
 * field holds (the CadÚnico coverage ids) carries its own `title` and
 * `description` instead, under the dataset of its denominator.
 */
export const CATALOGUE_VARIANTS: Record<
  string,
  {
    datasetId: string;
    fieldName: string;
    note?: string;
    officialFaixas?: 'ivs' | 'idhm';
    title?: string;
    description?: string;
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
    title: 'Cozinhas por 10 mil pessoas no CadÚnico por município',
    description:
      'Número de cozinhas por 10 mil pessoas registradas no Cadastro Único em cada município (cozinhas / pessoas no CadÚnico × 10 mil): a cobertura da população vulnerável. Maior = mais cozinhas para a mesma população. Município sem cozinha ou sem CadÚnico fica sem dado. Para outra base, use o id com ela no nome, cozinhas_por_<N>mil_cadunico (ex.: cozinhas_por_50mil_cadunico para 50 mil; cozinhas_por_2_5mil_cadunico para 2,5 mil); o servidor serve sempre a base que o pedido nomeia.',
  },
  cozinhas_por_100mil_cadunico: {
    datasetId: 'municipios_cadunico',
    fieldName: 'pessoasCadastradas',
    title: 'Cozinhas por 100 mil pessoas no CadÚnico por município',
    description:
      'Número de cozinhas por 100 mil pessoas registradas no Cadastro Único em cada município (cozinhas / pessoas no CadÚnico × 100 mil): a mesma cobertura na base 100 mil. Maior = mais cozinhas para a mesma população. Município sem cozinha ou sem CadÚnico fica sem dado. Para outra base, use cozinhas_por_<N>mil_cadunico; o servidor serve sempre a base que o pedido nomeia.',
  },
  cadunico_pessoas_por_cozinha: {
    datasetId: 'municipios_cadunico',
    fieldName: 'pessoasCadastradas',
    title: 'Pessoas no CadÚnico por cozinha por município',
    description:
      'Pessoas registradas no Cadastro Único por cozinha em cada município (pessoas no CadÚnico / cozinhas): a razão inversa da cobertura. Maior = cada cozinha atende mais pessoas = cobertura mais fina. Município sem cozinha ou sem CadÚnico fica sem dado.',
  },
};
