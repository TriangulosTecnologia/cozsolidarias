import type { CozinhasSituacaoPorMunicipio } from '@/data-gateway/schema';
import { gateway } from '@/gateway';

import {
  FAMILY_DEFS,
  familyOf,
  FILTER_FIELDS,
  FILTERABLE_BASES,
  type FilterableBaseId,
  type FilterField,
} from './renderableFields';

/**
 * A filter on one allowlisted field of a filterable base: the base, its
 * snapshot year, the field and the raw value. It lives only on the server: the
 * public `mapDataId` stays the base id (G-1 option A).
 *
 * @example
 * const filter: ParsedFilter = { baseId: 'cozinhas_geolocalizadas', ano: 2026, field: 'situacao', value: 'Habilitada' };
 */
export type ParsedFilter = {
  baseId: FilterableBaseId;
  ano: 2025 | 2026;
  field: FilterField;
  value: string;
};

/**
 * The field and value of a {@link ParsedFilter}, as the preflight resolves it
 * for the dataset it also resolves.
 *
 * @example
 * const filter: ServerFilter = { field: 'situacao', value: 'Habilitada' };
 */
export type ServerFilter = Pick<ParsedFilter, 'field' | 'value'>;

/**
 * The values one field holds in one filterable base's snapshot, restricted to
 * what the snapshot covers: a value outside it is unknown, never zero.
 *
 * @example
 * const domain: FilterDomain = { baseId: 'cozinhas_geolocalizadas', ano: 2026, field: 'situacao', values: ['Habilitada'] };
 */
export type FilterDomain = Omit<ParsedFilter, 'value'> & { values: string[] };

const isFilterField = (field: string): field is FilterField => {
  return Object.hasOwn(FILTER_FIELDS, field);
};

const isFilterValue = (value: unknown): value is string => {
  return typeof value === 'string' && value.trim() !== '';
};

/** The single allowlisted `{ field: value }` pair of a `filter`, or `undefined`. */
const fieldValueOf = (filter: unknown): ServerFilter | undefined => {
  if (typeof filter !== 'object' || filter === null) {
    return undefined;
  }
  const pairs = Object.entries(filter);
  if (pairs.length !== 1) {
    return undefined;
  }
  const [[field, value]] = pairs;
  return isFilterField(field) && isFilterValue(value)
    ? { field, value }
    : undefined;
};

/**
 * The {@link ParsedFilter} of a filterable base id and a field value, or
 * `undefined` when the id does not accept filters.
 *
 * @example
 * filterOn({ baseId: 'cozinhas_geolocalizadas_2025', field: 'situacao', value: 'Mapeada' })?.ano; // 2025
 */
export const filterOn = (
  params: { baseId: string } & ServerFilter
): ParsedFilter | undefined => {
  const base = FILTERABLE_BASES.find(({ baseId }) => {
    return baseId === params.baseId;
  });
  return base && { ...base, field: params.field, value: params.value };
};

/**
 * Reads the `filter` the agent put on a `mapData` entry (`{ <field>: <value> }`)
 * when it recognized a value, a synonym included, from the catalogue's
 * `filters`. The base must accept filters, the field must be on
 * {@link FILTER_FIELDS} and the value must be a non-blank string; the value's
 * presence in the data is checked when it is fetched.
 *
 * @param params.mapDataId - The entry's `mapDataId`, as written; only text names a base.
 * @param params.filter - The entry's `filter`, as the agent wrote it.
 * @returns The filter, or the pt-BR reason it is refused.
 *
 * @example
 * parseMapDataFilter({ mapDataId: 'cozinhas_geolocalizadas', filter: { cnpj: '1' } }); // 'O filter ...'
 */
export const parseMapDataFilter = (params: {
  mapDataId: unknown;
  filter: unknown;
}): ParsedFilter | string => {
  const pair = fieldValueOf(params.filter);
  // Only a text id names a base; nothing is coerced into one.
  const filter =
    pair && typeof params.mapDataId === 'string'
      ? filterOn({ baseId: params.mapDataId, ...pair })
      : undefined;
  return (
    filter ??
    `O filter de "${String(params.mapDataId)}" precisa ser {"<campo>": "<valor>"} com um campo de ${Object.keys(FILTER_FIELDS).join(', ')}, e só vale em dataset com "filters" no catálogo.`
  );
};

/**
 * The legend note stating the filter a map was served with.
 *
 * @example
 * filterNote({ baseId: 'cozinhas_geolocalizadas_2025', ano: 2025, field: 'situacao', value: 'Mapeada' });
 * // 'Recorte: situação Mapeada (2025).'
 */
export const filterNote = (filter: ParsedFilter): string => {
  return `Recorte: ${FILTER_FIELDS[filter.field].toLowerCase()} ${filter.value} (${filter.ano}).`;
};

const coveredValues = (snapshot: CozinhasSituacaoPorMunicipio): string[] => {
  const observed = new Set(
    snapshot.porMunicipio.flatMap((row) => {
      return Object.keys(row.quantidadePorSituacao);
    })
  );
  return [...observed]
    .filter((value) => {
      return (
        snapshot.situacoesCobertas === null ||
        snapshot.situacoesCobertas.includes(value)
      );
    })
    .sort((a, b) => {
      return a.localeCompare(b, 'pt-BR');
    });
};

/**
 * Counts, per município, the located cozinhas of the filter's snapshot whose
 * field holds the filter's value.
 *
 * @param filter - A {@link ParsedFilter}.
 * @returns One `mapData` row per município of the snapshot, or `null` when the
 * snapshot does not cover the value or never holds it (unknown, never zero).
 *
 * @example
 * await filteredMapDataRows({ baseId: 'cozinhas_geolocalizadas', ano: 2026, field: 'situacao', value: 'Mapeada' }); // null
 */
export const filteredMapDataRows = async (
  filter: ParsedFilter
): Promise<Array<{ geometryId: string; value: number }> | null> => {
  const snapshot = await gateway.getCozinhasSituacaoPorMunicipio(filter.ano);
  if (!coveredValues(snapshot).includes(filter.value)) {
    return null;
  }
  return snapshot.porMunicipio.map(({ codigoIbge, quantidadePorSituacao }) => {
    return {
      geometryId: codigoIbge,
      value: quantidadePorSituacao[filter.value] ?? 0,
    };
  });
};

/**
 * The {@link FilterDomain} of every filterable base, read from the data the
 * gateway serves, so a value new in the source is accepted with no code change.
 *
 * @example
 * (await readFilterDomains())[0].values; // ['Habilitada']
 */
export const readFilterDomains = (): Promise<FilterDomain[]> => {
  return Promise.all(
    FILTERABLE_BASES.map(async (base) => {
      return {
        ...base,
        field: 'situacao' as const,
        values: coveredValues(
          await gateway.getCozinhasSituacaoPorMunicipio(base.ano)
        ),
      };
    })
  );
};

/**
 * Lower-cases a text and strips its diacritics, the form every prompt match runs on.
 *
 * @example
 * normalizeText('Não Habilitada'); // 'nao habilitada'
 */
export const normalizeText = (text: string): string => {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
};

/**
 * Whether a prompt names the family of a filterable base.
 *
 * @example
 * namesFilterableFamily('cozinhas mapeadas'); // true
 */
export const namesFilterableFamily = (prompt: string): boolean => {
  const text = normalizeText(prompt);
  return FILTERABLE_BASES.some(({ baseId }) => {
    const family = familyOf(baseId);
    return family !== undefined && FAMILY_DEFS[family].keyword.test(text);
  });
};

/**
 * The filter domains a prompt can use: read only when it names a filterable
 * family, so other prompts never pay for the cozinhas aggregation.
 *
 * @example
 * await readFilterDomainsFor('IVS'); // []
 */
export const readFilterDomainsFor = async (
  prompt: string
): Promise<FilterDomain[]> => {
  return namesFilterableFamily(prompt) ? readFilterDomains() : [];
};

const tokensOf = (text: string): string[] => {
  return normalizeText(text)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
};

/** A spoken word naming a value word, singular or plural. */
const sameWord = (spoken: string, word: string): boolean => {
  return spoken === word || spoken === `${word}s` || spoken === `${word}es`;
};

/** Every `[start, end)` span of `words` inside `spoken`. */
const spansOf = (
  spoken: string[],
  words: string[]
): Array<[number, number]> => {
  return spoken.flatMap((_, start): Array<[number, number]> => {
    const fits = words.every((word, offset) => {
      const token = spoken[start + offset];
      return token !== undefined && sameWord(token, word);
    });
    return fits ? [[start, start + words.length]] : [];
  });
};

const HEAD_MIN_LENGTH = 4;

/**
 * The values a prompt names. A value is named exactly when all its words
 * appear in order; overlapping hits keep the longest, so "não habilitada"
 * never also names "habilitada". With no exact hit, a value is named by its
 * first word alone when that word has at least four letters, which may name
 * several values at once (`exact: false`).
 *
 * deferred: no synonyms or typos here; the agent reads the values in the
 * catalogue's `filters` and may send a filter for a synonym (see
 * {@link parseMapDataFilter}). Revisit when `generationLogger` shows filter
 * wording that neither recognizes.
 *
 * @param params.text - The user's prompt.
 * @param params.values - The candidate raw values.
 * @returns The values named, in `values` order, and whether the hit was exact.
 *
 * @example
 * matchFilterValues({ text: 'cozinhas mapeadas', values: ['Mapeada'] }); // { exact: true, values: ['Mapeada'] }
 */
export const matchFilterValues = (params: {
  text: string;
  values: string[];
}): { exact: boolean; values: string[] } => {
  const spoken = tokensOf(params.text);
  const hits = params.values
    .flatMap((value) => {
      return spansOf(spoken, tokensOf(value)).map(([start, end]) => {
        return { value, start, end };
      });
    })
    .sort((a, b) => {
      return b.end - b.start - (a.end - a.start);
    });
  const kept: typeof hits = [];
  for (const hit of hits) {
    const overlaps = kept.some((other) => {
      return hit.start < other.end && other.start < hit.end;
    });
    if (!overlaps) {
      kept.push(hit);
    }
  }
  if (kept.length > 0) {
    return {
      exact: true,
      values: params.values.filter((value) => {
        return kept.some((hit) => {
          return hit.value === value;
        });
      }),
    };
  }
  return {
    exact: false,
    values: params.values.filter((value) => {
      const [head] = tokensOf(value);
      return (
        head !== undefined &&
        head.length >= HEAD_MIN_LENGTH &&
        spoken.some((token) => {
          return sameWord(token, head);
        })
      );
    }),
  };
};

/**
 * The coverage note (G-6) of each filterable base among `mapDataIds` whose
 * snapshot holds only some values: the map answers within that coverage, and
 * its legend must say so. Pass only unfiltered bases: a filtered one's value is
 * either covered in full or refused.
 *
 * @param mapDataIds - The `mapData[].mapDataId`s of a spec.
 * @returns The note per base id; empty when every snapshot is complete.
 *
 * @example
 * await coverageNotes(['cozinhas_geolocalizadas']);
 * // Map { 'cozinhas_geolocalizadas' => 'Dados de 2026: apenas situação Habilitada; o snapshot não contém as demais.' }
 */
export const coverageNotes = async (
  mapDataIds: string[]
): Promise<Map<string, string>> => {
  const bases = FILTERABLE_BASES.filter(({ baseId }) => {
    return mapDataIds.includes(baseId);
  });
  const notes = await Promise.all(
    bases.map(async ({ baseId, ano }): Promise<Array<[string, string]>> => {
      const { situacoesCobertas } =
        await gateway.getCozinhasSituacaoPorMunicipio(ano);
      return situacoesCobertas === null
        ? []
        : [
            [
              baseId,
              `Dados de ${ano}: apenas ${FILTER_FIELDS.situacao.toLowerCase()} ${situacoesCobertas.join(', ')}; o snapshot não contém as demais.`,
            ],
          ];
    })
  );
  return new Map(notes.flat());
};
