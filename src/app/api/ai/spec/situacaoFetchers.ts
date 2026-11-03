import { gateway } from '@/gateway';

import {
  type SituacaoMapDataRow,
  situacaoMapDataRows,
} from './cozinhasSituacao';
import {
  RENDERABLE_FIELD_META,
  type RenderableFieldMeta,
  type SituacaoSpec,
} from './renderableFields';

/**
 * Fetcher counting one situation group of a snapshot year, read from the
 * registry entry's `situacao`. Resolves to `null` when the snapshot does not
 * cover the group, so the caller refuses it.
 */
const situacaoField = (spec: SituacaoSpec) => {
  return async (): Promise<SituacaoMapDataRow[] | null> => {
    const snapshot = await gateway.getCozinhasSituacaoPorMunicipio(spec.ano);
    return situacaoMapDataRows({ snapshot, grupo: spec.grupo });
  };
};

/** The registry ids whose entry declares a situação. */
type SituacaoId = {
  [K in keyof typeof RENDERABLE_FIELD_META]: (typeof RENDERABLE_FIELD_META)[K] extends {
    situacao: SituacaoSpec;
  }
    ? K
    : never;
}[keyof typeof RENDERABLE_FIELD_META];

/** One fetcher per situação id, typed to the ids the registry declares. */
export type SituacaoFetchers = Record<
  SituacaoId,
  () => Promise<SituacaoMapDataRow[] | null>
>;

/**
 * The situação fetchers, one per registry entry that declares a `situacao`.
 * Derived from the registry, so adding a situação id there adds its fetcher.
 * Spread into `RENDERABLE_DATASET_FETCHERS`, which keeps the literal keys.
 */
export const SITUACAO_FETCHERS = Object.fromEntries(
  (
    Object.entries(RENDERABLE_FIELD_META) as Array<
      [string, RenderableFieldMeta]
    >
  ).flatMap(
    ([id, meta]): Array<
      [string, () => Promise<SituacaoMapDataRow[] | null>]
    > => {
      return meta.situacao === undefined
        ? []
        : [[id, situacaoField(meta.situacao)]];
    }
  )
) as SituacaoFetchers;
