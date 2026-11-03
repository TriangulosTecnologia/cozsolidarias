/** Dataset families the preflight groups renderable fields into. */
export type FamilyName = 'ivs' | 'idhm' | 'cadinsan' | 'cozinhas';

/** The pt-BR alias a prompt uses to name one variant of a family. */
export type VariantSpec = { label: string; match: RegExp };

/** How a field appears in the dataset catalogue sent to the agent. */
export type CatalogSpec = {
  datasetId: string;
  fieldName: string;
  note?: string;
  officialFaixas?: 'ivs' | 'idhm';
};

/** The situation group and snapshot year a cozinhas count is taken for. */
export type SituacaoSpec = {
  grupo: 'habilitadas' | 'nao_habilitadas' | 'outras';
  ano: 2025 | 2026;
};

/** Everything the app knows about one renderable `mapDataId`. */
export type RenderableFieldMeta = {
  family?: FamilyName;
  isDefault?: true;
  variant?: VariantSpec;
  catalog?: CatalogSpec;
  absolutoTotal?: true;
  situacao?: SituacaoSpec;
};

/**
 * The single source of truth for renderable fields. The fetchers, the
 * preflight families, the catalogue variants and the absolute-total list are
 * all derived from this object; `RENDERABLE_DATASET_FETCHERS` is typed to its
 * keys, so a field added here without a fetcher (or the reverse) fails to
 * compile.
 *
 * Insertion order is the order the variants appear in each family.
 *
 * @example
 * RENDERABLE_FIELD_META.municipios_ivs.family; // 'ivs'
 */
export const RENDERABLE_FIELD_META = {
  municipios_ivs: {
    family: 'ivs',
    isDefault: true,
    catalog: {
      datasetId: 'municipios_ivs',
      fieldName: 'ivs',
      officialFaixas: 'ivs',
    },
  },
  municipios_ivs_infraestrutura: {
    family: 'ivs',
    variant: {
      label: 'IVS – Infraestrutura urbana',
      match: /infraestrutura/,
    },
    catalog: {
      datasetId: 'municipios_ivs',
      fieldName: 'ivs_infraestrutura_urbana',
      officialFaixas: 'ivs',
      note: 'Maior = mais vulnerável',
    },
  },
  municipios_ivs_capital_humano: {
    family: 'ivs',
    variant: { label: 'IVS – Capital humano', match: /capital humano/ },
    catalog: {
      datasetId: 'municipios_ivs',
      fieldName: 'ivs_capital_humano',
      officialFaixas: 'ivs',
      note: 'Maior = mais vulnerável',
    },
  },
  municipios_ivs_renda_trabalho: {
    family: 'ivs',
    variant: { label: 'IVS – Renda e trabalho', match: /renda|trabalho/ },
    catalog: {
      datasetId: 'municipios_ivs',
      fieldName: 'ivs_renda_e_trabalho',
      officialFaixas: 'ivs',
      note: 'Maior = mais vulnerável',
    },
  },
  municipios_idhm: {
    family: 'idhm',
    isDefault: true,
    catalog: {
      datasetId: 'municipios_ivs',
      fieldName: 'idhm',
      officialFaixas: 'idhm',
      note: 'Maior = melhor desenvolvimento humano (escala oposta à do IVS)',
    },
  },
  municipios_idhm_longevidade: {
    family: 'idhm',
    variant: { label: 'IDHM – Longevidade', match: /longevidade/ },
    catalog: {
      datasetId: 'municipios_ivs',
      fieldName: 'idhm_long',
      officialFaixas: 'idhm',
      note: 'Maior = melhor',
    },
  },
  municipios_idhm_educacao: {
    family: 'idhm',
    variant: { label: 'IDHM – Educação', match: /educacao/ },
    catalog: {
      datasetId: 'municipios_ivs',
      fieldName: 'idhm_educ',
      officialFaixas: 'idhm',
      note: 'Maior = melhor',
    },
  },
  municipios_idhm_educacao_escolaridade: {
    family: 'idhm',
    variant: { label: 'IDHM – Educação (escolaridade)', match: /escolaridade/ },
    catalog: {
      datasetId: 'municipios_ivs',
      fieldName: 'idhm_educ_sub_esc',
      officialFaixas: 'idhm',
      note: 'Maior = melhor',
    },
  },
  municipios_idhm_educacao_frequencia: {
    family: 'idhm',
    variant: {
      label: 'IDHM – Educação (frequência escolar)',
      match: /frequencia/,
    },
    catalog: {
      datasetId: 'municipios_ivs',
      fieldName: 'idhm_educ_sub_freq',
      officialFaixas: 'idhm',
      note: 'Maior = melhor',
    },
  },
  municipios_idhm_renda: {
    family: 'idhm',
    variant: { label: 'IDHM – Renda', match: /renda/ },
    catalog: {
      datasetId: 'municipios_ivs',
      fieldName: 'idhm_renda',
      officialFaixas: 'idhm',
      note: 'Maior = melhor',
    },
  },
  municipios_cadinsan: {
    family: 'cadinsan',
    isDefault: true,
    variant: {
      label: 'Insegurança alimentar com Bolsa Família',
      match: /com (o )?(pbf|bolsa)/,
    },
  },
  municipios_cadinsan_sem_pbf: {
    family: 'cadinsan',
    variant: {
      label: 'Insegurança alimentar sem Bolsa Família',
      match: /sem (o )?(pbf|bolsa)/,
    },
    catalog: {
      datasetId: 'municipios_cadinsan',
      fieldName: 'Cadinsan_absoluto_sem_PBF',
      note: 'O mapa pinta a proporção (%) sobre o total de cadastros do CadÚnico, não a contagem',
    },
  },
  cozinhas_geolocalizadas: { family: 'cozinhas', isDefault: true },
  cozinhas_geolocalizadas_2025: {
    family: 'cozinhas',
    variant: { label: 'Cozinhas em 2025', match: /2025/ },
  },
  cozinhas_pessoas_atendidas: {
    family: 'cozinhas',
    variant: {
      label: 'Pessoas atendidas pelas cozinhas',
      match: /atendid/,
    },
    absolutoTotal: true,
  },
  cozinhas_habilitadas_2025: {
    family: 'cozinhas',
    situacao: { grupo: 'habilitadas', ano: 2025 },
  },
  cozinhas_habilitadas_2026: {
    family: 'cozinhas',
    situacao: { grupo: 'habilitadas', ano: 2026 },
  },
  cozinhas_nao_habilitadas_2025: {
    family: 'cozinhas',
    situacao: { grupo: 'nao_habilitadas', ano: 2025 },
  },
  cozinhas_nao_habilitadas_2026: {
    family: 'cozinhas',
    situacao: { grupo: 'nao_habilitadas', ano: 2026 },
  },
  cozinhas_outras_2025: {
    family: 'cozinhas',
    situacao: { grupo: 'outras', ano: 2025 },
  },
  cozinhas_outras_2026: {
    family: 'cozinhas',
    situacao: { grupo: 'outras', ano: 2026 },
  },
} satisfies Record<string, RenderableFieldMeta>;

/** Every renderable `mapDataId`, typed from the registry. */
export type RenderableFieldId = keyof typeof RENDERABLE_FIELD_META;

/** The ids of the registry, in registry order. */
export const RENDERABLE_FIELD_IDS = Object.keys(
  RENDERABLE_FIELD_META
) as RenderableFieldId[];

/** The keyword and default dataset of each family the preflight can name. */
export const FAMILY_DEFS: Record<
  FamilyName,
  { keyword: RegExp; defaultId: RenderableFieldId }
> = {
  ivs: { keyword: /\bivs\b/, defaultId: 'municipios_ivs' },
  idhm: { keyword: /idhm/, defaultId: 'municipios_idhm' },
  cadinsan: {
    keyword: /cadinsan|cadunico|inseguranca alimentar/,
    defaultId: 'municipios_cadinsan',
  },
  cozinhas: {
    keyword: /cozinha|atendid/,
    defaultId: 'cozinhas_geolocalizadas',
  },
};

/** The family order the preflight tests a prompt against. */
export const FAMILY_NAMES: FamilyName[] = [
  'ivs',
  'idhm',
  'cadinsan',
  'cozinhas',
];

/** Entries of the registry with a value, as `[id, meta]` pairs in registry order. */
const entriesWhere = (
  predicate: (meta: RenderableFieldMeta) => boolean
): Array<[RenderableFieldId, RenderableFieldMeta]> => {
  return (
    Object.entries(RENDERABLE_FIELD_META) as Array<
      [RenderableFieldId, RenderableFieldMeta]
    >
  ).filter(([, meta]) => {
    return predicate(meta);
  });
};

/** The ids whose value is an absolute total, never a choropleth. */
export const ABSOLUTE_TOTAL_IDS = entriesWhere((meta) => {
  return meta.absolutoTotal === true;
}).map(([id]) => {
  return id;
});

/** The catalogue variants, keyed by `mapDataId` (see `CatalogSpec`). */
export const CATALOG_VARIANTS: Record<string, CatalogSpec> = Object.fromEntries(
  entriesWhere((meta) => {
    return meta.catalog !== undefined;
  }).map(([id, meta]): [string, CatalogSpec] => {
    return [id, meta.catalog as CatalogSpec];
  })
);

/**
 * The family variants the preflight groups by family name, in registry order,
 * each with its alias. A family's default id is not a variant unless it has
 * its own alias.
 */
export const familyVariants = (
  family: FamilyName
): Array<{ id: RenderableFieldId; variant: VariantSpec }> => {
  return entriesWhere((meta) => {
    return meta.family === family && meta.variant !== undefined;
  }).map(([id, meta]) => {
    return { id, variant: meta.variant as VariantSpec };
  });
};

/** The family a renderable id belongs to, or `undefined` when it has none. */
export const familyOf = (id: string): FamilyName | undefined => {
  return (
    RENDERABLE_FIELD_META as Record<string, RenderableFieldMeta | undefined>
  )[id]?.family;
};
