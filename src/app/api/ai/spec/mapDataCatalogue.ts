import type {
  CadinsanByCity,
  CatalogueContract,
  CatalogueDatasetContract,
  CatalogueFieldContract,
  KitchenRateByCity,
  MunicipioIvs,
} from '@/data-gateway/schema';
import { gateway } from '@/gateway';

/**
 * Renderable datasets whose value is an absolute total (a raw sum), never a
 * relative variable (rate/ratio/percentage) — per Bertin's graphic semiology
 * (*Sémiologie Graphique*, 1967) and IBGE's technical cartography manuals,
 * painting an absolute total as a choropleth (area/color) introduces area
 * bias: a geographically large município reads as more intense with no
 * relation to the measured quantity. `cozinhas_pessoas_atendidas`'s own
 * catalogue `description` already states this ("nunca um coroplético");
 * `findChoroplethOnAbsoluteTotal` in `specValidation.ts` enforces it
 * deterministically instead of relying only on `route.ts`'s `INSTRUCTIONS`.
 */
export const ABSOLUTE_TOTAL_DATASET_IDS = [
  'cozinhas_pessoas_atendidas',
] as const;

/** One `MapDataRow`-shaped value per município, dropping unscored ones. */
const toMapDataRows = <T extends { codigoIbge: string }>(
  rows: T[],
  pick: (row: T) => number | null
): Array<{ geometryId: string; value: number }> => {
  return rows.flatMap((row) => {
    const value = pick(row);
    return value === null ? [] : [{ geometryId: row.codigoIbge, value }];
  });
};

/** Fetcher painting one numeric `MunicipioIvs` field (IVS, its sub-indices, IDHM family). */
const ivsField = (
  field: {
    [K in keyof MunicipioIvs]: MunicipioIvs[K] extends number ? K : never;
  }[keyof MunicipioIvs]
) => {
  return async () => {
    const rows: MunicipioIvs[] = await gateway.getIvsPorMunicipio();
    return toMapDataRows(rows, (row) => {
      return row[field];
    });
  };
};

/** Fetcher painting one `CadinsanByCity` share (%), dropping municípios without CadÚnico. */
const cadinsanField = (field: 'proporcaoComPbf' | 'proporcaoSemPbf') => {
  return async () => {
    const rows: CadinsanByCity[] = await gateway.getCadinsanPorMunicipio();
    return toMapDataRows(rows, (row) => {
      return row[field];
    });
  };
};

/**
 * Resolves each renderable dataset id to real `mapData` rows via
 * `data-gateway` — the registry `appendRealMapData` looks up to replace the
 * agent's placeholder `data` (see ADR-0001).
 */
export const RENDERABLE_DATASET_FETCHERS = {
  cozinhas_geolocalizadas: async () => {
    const rows: KitchenRateByCity[] = await gateway.getCozinhasPorMunicipio();
    return toMapDataRows(rows, (row) => {
      return row.quantidade;
    });
  },
  cozinhas_geolocalizadas_2025: async () => {
    const rows: KitchenRateByCity[] =
      await gateway.getCozinhasPorMunicipio(2025);
    return toMapDataRows(rows, (row) => {
      return row.quantidade;
    });
  },
  cozinhas_pessoas_atendidas: async () => {
    const rows: KitchenRateByCity[] = await gateway.getCozinhasPorMunicipio();
    return toMapDataRows(rows, (row) => {
      return row.pessoasAtendidas;
    });
  },
  municipios_ivs: ivsField('ivs'),
  municipios_ivs_infraestrutura: ivsField('ivsInfraestruturaUrbana'),
  municipios_ivs_capital_humano: ivsField('ivsCapitalHumano'),
  municipios_ivs_renda_trabalho: ivsField('ivsRendaETrabalho'),
  municipios_idhm: ivsField('idhm'),
  municipios_idhm_longevidade: ivsField('idhmLongevidade'),
  municipios_idhm_educacao: ivsField('idhmEducacao'),
  municipios_idhm_renda: ivsField('idhmRenda'),
  municipios_idhm_educacao_escolaridade: ivsField('idhmEducacaoEscolaridade'),
  municipios_idhm_educacao_frequencia: ivsField('idhmEducacaoFrequencia'),
  municipios_cadinsan: cadinsanField('proporcaoComPbf'),
  municipios_cadinsan_sem_pbf: cadinsanField('proporcaoSemPbf'),
} as const;

export type RenderableDatasetId = keyof typeof RENDERABLE_DATASET_FETCHERS;

/** List of dataset IDs that the agent may reference in `mapData`. */
export const RENDERABLE_DATASET_IDS = Object.keys(
  RENDERABLE_DATASET_FETCHERS
) as RenderableDatasetId[];

/** Type guard: check if a dataset ID is renderable. */
export const isRenderableDatasetId = (
  id: unknown
): id is RenderableDatasetId => {
  return typeof id === 'string' && id in RENDERABLE_DATASET_FETCHERS;
};

/** The index-only shape a non-renderable dataset is reduced to — enough for
 * the agent to recognize the dataset exists, compare `description` against
 * the request (per `route.ts`'s "resolução de mapDataId" instruction, which
 * requires scanning every dataset, not just the renderable ones) and respond
 * "not available" instead of silently mismapping to a wrong renderable
 * dataset — never enough to reference it in `mapData` (no `fields`). */
type CatalogueDatasetIndexEntry = Pick<
  CatalogueDatasetContract,
  'id' | 'title' | 'description'
>;

/** The full shape a renderable dataset keeps — every field the `route.ts`
 * instructions actually read (mapType, variável, abrangência espacial,
 * intervalo temporal), nothing else. */
type CatalogueDatasetDetailEntry = Pick<
  CatalogueDatasetContract,
  'id' | 'title' | 'description' | 'spatial' | 'temporal'
> & {
  access: { notes: string | null };
  fields: Array<Pick<CatalogueFieldContract, 'name' | 'description' | 'unit'>>;
};

/**
 * Projects one catalogue dataset down to what the agent needs: non-renderable
 * datasets (can never populate `mapData`, see {@link RENDERABLE_DATASET_IDS})
 * collapse to `{id, title, description}` — enough to match/reject a request,
 * never enough to reference in `mapData`; renderable ones keep only the
 * fields each `route.ts` instruction reads, dropping provenance (`source`, `organization`,
 * `originNotes`), volume/size, derived `gaps`, unused spatial detail
 * (`geometry`, `precision`, `srid`), unused field `role`, and — critically —
 * any `sensitive` field entirely, since no instruction ever needs one.
 */
const toAiDatasetProjection = (
  dataset: CatalogueDatasetContract
): CatalogueDatasetIndexEntry | CatalogueDatasetDetailEntry => {
  return {
    id: dataset.id,
    title: dataset.title,
    description: dataset.description,
    spatial: dataset.spatial,
    temporal: dataset.temporal,
    access: { notes: dataset.access.notes },
    fields: dataset.fields
      .filter((field) => {
        return !field.sensitive;
      })
      .map((field) => {
        return {
          name: field.name,
          description: field.description,
          unit: field.unit,
        };
      }),
  };
};

/**
 * Renderable ids that paint one field of a catalogue dataset: each is exposed
 * to the agent as its own entry whose `description` is that field's own
 * `description` (plus `note` when the field text omits what the id's scale
 * means), so the agent can tell IVS from IDHM and "com PBF" from "sem PBF".
 * A variant whose id equals its dataset's id replaces that dataset's entry.
 * `officialFaixas` marks an official IPEA index whose legend thresholds the
 * model must not reclassify (see {@link officialFaixasOf}).
 */
const CATALOGUE_VARIANTS: Record<
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
};

/**
 * The official faixa family (IPEA) a renderable id paints, or `undefined` when
 * its scale is free to be chosen. Read by `findReclassifiedOfficialIndex`.
 *
 * @param mapDataId - A `mapData[].mapDataId`.
 * @returns `'ivs'`, `'idhm'` or `undefined`.
 *
 * @example
 * officialFaixasOf('municipios_idhm_renda'); // 'idhm'
 */
export const officialFaixasOf = (
  mapDataId: string
): 'ivs' | 'idhm' | undefined => {
  return CATALOGUE_VARIANTS[mapDataId]?.officialFaixas;
};

/** The catalogue entries a dataset yields: itself, unless a variant takes its id, plus one per variant it owns. */
const toAiDatasetEntries = (
  dataset: CatalogueDatasetContract
): Array<CatalogueDatasetIndexEntry | CatalogueDatasetDetailEntry> => {
  const projection = toAiDatasetProjection(dataset);
  const variants = Object.entries(CATALOGUE_VARIANTS).flatMap(
    ([id, variant]) => {
      const field = dataset.fields.find((candidate) => {
        return candidate.name === variant.fieldName && !candidate.sensitive;
      });
      if (variant.datasetId !== dataset.id || !field) {
        return [];
      }
      return [
        {
          ...projection,
          id,
          title: `${dataset.title} — ${field.name}`,
          description: variant.note
            ? `${field.description}. ${variant.note}.`
            : field.description,
          fields: [
            {
              name: field.name,
              description: field.description,
              unit: field.unit,
            },
          ],
        },
      ];
    }
  );
  const replaced = variants.some((variant) => {
    return variant.id === dataset.id;
  });
  return replaced ? variants : [projection, ...variants];
};

/**
 * Builds the catalogue context sent to the agent: a structured JSON object
 * containing a two-tier view — an index of all datasets (id + title +
 * description) and, for only the {@link RENDERABLE_DATASET_IDS} (the ones
 * the agent may reference in `mapData`), just the fields the `route.ts`
 * instructions read (see
 * {@link toAiDatasetProjection}). See ADR-0001 for why the split exists (token
 * cost vs. silent mismapping).
 */
export const buildCatalogueContext = (catalogue: CatalogueContract): string => {
  return JSON.stringify({
    catalogue: {
      ...catalogue,
      datasets: catalogue.datasets.flatMap(toAiDatasetEntries),
    },
  });
};
