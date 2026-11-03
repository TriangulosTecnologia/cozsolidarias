import { gateway } from '@/gateway';

import {
  type SituacaoAno,
  type SituacaoGrupo,
  situacaoMapDataRows,
} from './cozinhasSituacao';

/**
 * Fetcher counting one situation group of a snapshot year. Resolves to `null`
 * when the snapshot does not cover the group, so the caller refuses it.
 */
const situacaoField = (params: { ano: SituacaoAno; grupo: SituacaoGrupo }) => {
  return async () => {
    const snapshot = await gateway.getCozinhasSituacaoPorMunicipio(params.ano);
    return situacaoMapDataRows({ snapshot, grupo: params.grupo });
  };
};

/**
 * The situation-count fetchers, one per `cozinhas_<grupo>_<ano>` id. Spread
 * into `RENDERABLE_DATASET_FETCHERS`, so their keys stay literal types.
 */
export const SITUACAO_FETCHERS = {
  cozinhas_habilitadas_2025: situacaoField({ ano: 2025, grupo: 'habilitadas' }),
  cozinhas_habilitadas_2026: situacaoField({ ano: 2026, grupo: 'habilitadas' }),
  cozinhas_nao_habilitadas_2025: situacaoField({
    ano: 2025,
    grupo: 'nao_habilitadas',
  }),
  cozinhas_nao_habilitadas_2026: situacaoField({
    ano: 2026,
    grupo: 'nao_habilitadas',
  }),
  cozinhas_outras_2025: situacaoField({ ano: 2025, grupo: 'outras' }),
  cozinhas_outras_2026: situacaoField({ ano: 2026, grupo: 'outras' }),
} as const;
