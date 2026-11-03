import type { CozinhasSituacaoPorMunicipio } from '@/data-gateway/schema';

/**
 * Snapshot years the situation datasets can count. Mirrors `COZINHAS_YEARS` of
 * `data-source-static`, which the app may not import; a test pins the two
 * together.
 */
export const SITUACAO_ANOS = [2025, 2026] as const;

/** One of {@link SITUACAO_ANOS}. */
export type SituacaoAno = (typeof SITUACAO_ANOS)[number];

/** The most recent of {@link SITUACAO_ANOS}, the default when a prompt names no year. */
export const SITUACAO_ANO_MAIS_RECENTE: SituacaoAno = 2026;

/** Situation groups a `cozinhas_<grupo>_<ano>` dataset can count. */
export const SITUACAO_GRUPOS = [
  'habilitadas',
  'nao_habilitadas',
  'outras',
] as const;

/** One of {@link SITUACAO_GRUPOS}. */
export type SituacaoGrupo = (typeof SITUACAO_GRUPOS)[number];

/** The `mapDataId` of one situation group and year: `cozinhas_<grupo>_<ano>`. */
export type SituacaoMapDataId = `cozinhas_${SituacaoGrupo}_${SituacaoAno}`;

/** One `mapData` row: a município code and its count. */
export type SituacaoMapDataRow = { geometryId: string; value: number };

const HABILITADA = 'Habilitada';
const NAO_HABILITADA = 'Não Habilitada';

const isCovered = (params: {
  snapshot: CozinhasSituacaoPorMunicipio;
  situacao: string;
}): boolean => {
  const { snapshot, situacao } = params;
  return (
    snapshot.situacoesCobertas === null ||
    snapshot.situacoesCobertas.includes(situacao)
  );
};

/** Whether the snapshot can answer a group: unknown groups are refused, never zero. */
const isGroupCovered = (params: {
  snapshot: CozinhasSituacaoPorMunicipio;
  grupo: SituacaoGrupo;
}): boolean => {
  const { snapshot, grupo } = params;
  if (grupo === 'habilitadas') {
    return isCovered({ snapshot, situacao: HABILITADA });
  }
  if (grupo === 'nao_habilitadas') {
    return isCovered({ snapshot, situacao: NAO_HABILITADA });
  }
  // `outras` is every situação but the two above, so it needs the full set.
  return snapshot.situacoesCobertas === null;
};

const groupValue = (params: {
  grupo: SituacaoGrupo;
  quantidadePorSituacao: Record<string, number>;
}): number => {
  const { grupo, quantidadePorSituacao } = params;
  const habilitadas = quantidadePorSituacao[HABILITADA] ?? 0;
  const naoHabilitadas = quantidadePorSituacao[NAO_HABILITADA] ?? 0;
  if (grupo === 'habilitadas') {
    return habilitadas;
  }
  if (grupo === 'nao_habilitadas') {
    return naoHabilitadas;
  }
  const total = Object.values(quantidadePorSituacao).reduce((sum, n) => {
    return sum + n;
  }, 0);
  return total - habilitadas - naoHabilitadas;
};

/**
 * Projects one situation group of a year's snapshot into `mapData` rows, one
 * per município, keyed by IBGE code. Returns `null` when the snapshot does not
 * cover the group: the caller must refuse the request, because a missing
 * situação is unknown and not zero.
 *
 * @param params.snapshot - The year's per-situação counts from the gateway.
 * @param params.grupo - The situation group to count.
 * @returns One row per município in the snapshot, or `null` when uncovered.
 *
 * @example
 * situacaoMapDataRows({ snapshot: snapshot2026, grupo: 'nao_habilitadas' }); // null
 */
export const situacaoMapDataRows = (params: {
  snapshot: CozinhasSituacaoPorMunicipio;
  grupo: SituacaoGrupo;
}): SituacaoMapDataRow[] | null => {
  const { snapshot, grupo } = params;
  if (!isGroupCovered({ snapshot, grupo })) {
    return null;
  }
  return snapshot.porMunicipio.map(({ codigoIbge, quantidadePorSituacao }) => {
    return {
      geometryId: codigoIbge,
      value: groupValue({ grupo, quantidadePorSituacao }),
    };
  });
};

/**
 * The `mapDataId` of a situation group for one year.
 *
 * @example
 * situacaoMapDataId({ grupo: 'habilitadas', ano: 2025 }); // 'cozinhas_habilitadas_2025'
 */
export const situacaoMapDataId = (params: {
  grupo: SituacaoGrupo;
  ano: SituacaoAno;
}): SituacaoMapDataId => {
  return `cozinhas_${params.grupo}_${params.ano}` as const;
};

/** The pt-BR refusal for a prompt that names a situation while the user already chose a dataset. */
export const SITUACAO_COM_DATASET_MESSAGE =
  'Escolher um dataset e pedir uma situação de cozinhas ao mesmo tempo ainda não é suportado. Peça uma coisa por vez.';

/** The pt-BR refusal for a prompt that names two situations at once. */
export const SITUACAO_COMBINACAO_MESSAGE =
  'Combinar mais de uma situação de cozinhas em um mapa ainda não é suportado. Peça uma situação por vez.';

/**
 * The situation groups a prompt names, in the order `nao_habilitadas`,
 * `habilitadas`, `outras`. Negated "não habilitada" is removed before the
 * positive test, so it never also counts as `habilitadas`.
 *
 * @param text - The prompt, accent-stripped and lower-cased.
 * @returns The groups named, possibly none or several.
 *
 * @example
 * situacaoGroupsIn('cozinhas nao habilitadas'); // ['nao_habilitadas']
 */
export const situacaoGroupsIn = (text: string): SituacaoGrupo[] => {
  const withoutNegated = text.replace(/\bnao habilitad\w*/g, ' ');
  const groups: SituacaoGrupo[] = [];
  if (/\bnao habilitad/.test(text)) {
    groups.push('nao_habilitadas');
  }
  if (/\bhabilitad/.test(withoutNegated)) {
    groups.push('habilitadas');
  }
  if (/\boutr[oa]s?\b|\bdemais\b/.test(text)) {
    groups.push('outras');
  }
  return groups;
};

/** A prompt's situation request: its resolved id, or the refusal for a combination. */
export type SituacaoRequest =
  | { status: 'resolved'; datasetId: SituacaoMapDataId }
  | { status: 'unsupported'; message: string };

/**
 * Resolves a cozinhas situation request. Yields nothing when the prompt names
 * no situation, or when the user's pick already answers the request.
 *
 * @param params.text - The prompt, accent-stripped and lower-cased.
 * @param params.answered - Whether the user already chose a dataset.
 * @returns The resolved id, the refusal, or `undefined`.
 *
 * @example
 * situacaoRequest({ text: 'cozinhas habilitadas 2025', answered: false });
 * // { status: 'resolved', datasetId: 'cozinhas_habilitadas_2025' }
 */
export const situacaoRequest = (params: {
  text: string;
  datasetId?: string;
}): SituacaoRequest | undefined => {
  const groups = /cozinha/.test(params.text)
    ? situacaoGroupsIn(params.text)
    : [];
  if (groups.length === 0) {
    return undefined;
  }
  if (params.datasetId !== undefined) {
    return { status: 'unsupported', message: SITUACAO_COM_DATASET_MESSAGE };
  }
  if (groups.length > 1) {
    return { status: 'unsupported', message: SITUACAO_COMBINACAO_MESSAGE };
  }
  const ano = /2025/.test(params.text) ? 2025 : SITUACAO_ANO_MAIS_RECENTE;
  return {
    status: 'resolved',
    datasetId: situacaoMapDataId({ grupo: groups[0], ano }),
  };
};

const SITUACAO_DESCRIPTIONS: Record<SituacaoGrupo, string> = {
  habilitadas: 'Número de cozinhas habilitadas por município',
  nao_habilitadas:
    'Número de cozinhas não habilitadas por município. Indisponível quando o snapshot não cobre essa situação (o snapshot de 2026 só contém cozinhas habilitadas)',
  outras:
    'Número de cozinhas com outra situação, nem habilitada nem não habilitada, por município. Indisponível quando o snapshot não cobre todas as situações',
};

/**
 * One catalogue entry per situation group and year, built on a copy of the
 * cozinhas dataset's provenance with no fields: the count is computed by
 * {@link situacaoMapDataRows}, not read from a field.
 *
 * @param projection - The cozinhas dataset's catalogue projection.
 * @returns The entries, one per group and year.
 *
 * @example
 * situacaoCatalogueEntries({ ...projection }).map(({ id }) => id); // ['cozinhas_habilitadas_2025', ...]
 */
export const situacaoCatalogueEntries = <T extends object>(
  projection: T
): Array<
  T & { id: SituacaoMapDataId; title: string; description: string; fields: [] }
> => {
  return SITUACAO_GRUPOS.flatMap((grupo) => {
    return SITUACAO_ANOS.map((ano) => {
      return {
        ...projection,
        id: situacaoMapDataId({ grupo, ano }),
        title: `Cozinhas por situação: ${grupo} (${ano})`,
        description: `${SITUACAO_DESCRIPTIONS[grupo]} no ano ${ano}.`,
        fields: [] as [],
      };
    });
  });
};
