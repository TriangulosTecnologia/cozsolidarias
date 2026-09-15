import type {
  cadinsanByCity,
  CatalogueContract,
  CatalogueDatasetContract,
  CatalogueFieldContract,
  kitchenRateByCity,
  MunicipioIvs,
} from '@/data-gateway/schema';
import { gateway } from '@/gateway';

/**
 * The catalog datasets with a real, end-to-end path to `data-gateway` data —
 * the only ids the agent may reference in `mapData[].mapDataId` (see
 * `RENDERABLE_DATASET_FETCHERS`). Every other catalog entry stays
 * index-only context (see {@link buildCatalogueContext}).
 */
export const RENDERABLE_DATASET_IDS = [
  'cozinhas_geolocalizadas',
  'cozinhas_geolocalizadas_2025',
  'cozinhas_pessoas_atendidas',
  'municipios_ivs',
  'municipios_cadinsan',
] as const;

export type RenderableDatasetId = (typeof RENDERABLE_DATASET_IDS)[number];

export const isRenderableDatasetId = (
  value: string
): value is RenderableDatasetId => {
  return (RENDERABLE_DATASET_IDS as readonly string[]).includes(value);
};

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

/**
 * Resolves each renderable dataset id to real `mapData` rows via
 * `data-gateway` — the registry `appendRealMapData` looks up to replace the
 * agent's placeholder `data` (see ADR-0001).
 */
export const RENDERABLE_DATASET_FETCHERS: Record<
  RenderableDatasetId,
  () => Promise<Array<{ geometryId: string; value: number }>>
> = {
  cozinhas_geolocalizadas: async () => {
    const rows: kitchenRateByCity[] = await gateway.getCozinhasPorMunicipio();
    return toMapDataRows(rows, (row) => {
      return row.quantidade;
    });
  },
  cozinhas_geolocalizadas_2025: async () => {
    const rows: kitchenRateByCity[] =
      await gateway.getCozinhasPorMunicipio(2025);
    return toMapDataRows(rows, (row) => {
      return row.quantidade;
    });
  },
  cozinhas_pessoas_atendidas: async () => {
    const rows: kitchenRateByCity[] = await gateway.getCozinhasPorMunicipio();
    return toMapDataRows(rows, (row) => {
      return row.pessoasAtendidas;
    });
  },
  municipios_ivs: async () => {
    const rows: MunicipioIvs[] = await gateway.getIvsPorMunicipio();
    return toMapDataRows(rows, (row) => {
      return row.ivs;
    });
  },
  municipios_cadinsan: async () => {
    const rows: cadinsanByCity[] = await gateway.getCadinsanPorMunicipio();
    return toMapDataRows(rows, (row) => {
      return row.proporcaoComPbf;
    });
  },
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
  if (!isRenderableDatasetId(dataset.id)) {
    return {
      id: dataset.id,
      title: dataset.title,
      description: dataset.description,
    };
  }

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
      datasets: catalogue.datasets.map(toAiDatasetProjection),
    },
  });
};
