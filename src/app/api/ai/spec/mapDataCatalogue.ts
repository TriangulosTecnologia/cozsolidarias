import type {
  cadinsanByCity,
  CatalogueContract,
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

/**
 * Builds the catalogue context sent to the agent: a structured JSON object
 * containing a two-tier view — an index of all datasets (id + title) and full
 * field-level detail of only the {@link RENDERABLE_DATASET_IDS} — the ones
 * it's allowed to reference in `mapData`. See ADR-0001 for why (token cost vs.
 * silent mismapping).
 */
export const buildCatalogueContext = (catalogue: CatalogueContract): string => {
  return JSON.stringify({
    catalogue,
  });
};
