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
 * A `mapDataId` that counts the cozinhas of a filterable base whose field holds
 * one raw value: `<base>?<field>=<value>`, the value verbatim from the source.
 *
 * @example
 * const id: FilteredMapDataId = 'cozinhas_geolocalizadas_2025?situacao=Mapeada';
 */
export type FilteredMapDataId = `${FilterableBaseId}?${string}`;

/**
 * A parsed {@link FilteredMapDataId}: its base, the base's snapshot year, the
 * field and the raw value.
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
 * The values one field holds in one filterable base's snapshot, restricted to
 * what the snapshot covers: a value outside it is unknown, never zero.
 *
 * @example
 * const domain: FilterDomain = { baseId: 'cozinhas_geolocalizadas', ano: 2026, field: 'situacao', values: ['Habilitada'] };
 */
export type FilterDomain = Omit<ParsedFilter, 'value'> & { values: string[] };

const splitOnce = (
  text: string,
  separator: string
): [string, string | undefined] => {
  const at = text.indexOf(separator);
  return at < 0 ? [text, undefined] : [text.slice(0, at), text.slice(at + 1)];
};

/** A non-blank single value: `&` would start a second filter. */
const isFilterValue = (value: string | undefined): value is string => {
  return value !== undefined && value.trim() !== '' && !value.includes('&');
};

const isFilterField = (field: string): field is FilterField => {
  return Object.hasOwn(FILTER_FIELDS, field);
};

/**
 * Parses a {@link FilteredMapDataId}: the base must accept filters, the field
 * must be on {@link FILTER_FIELDS} and the value must not be blank. One filter
 * per id; the value's presence in the data is checked when it is fetched.
 *
 * @param id - Any `mapDataId`.
 * @returns The parsed filter, or `null` when `id` is not a valid filtered id.
 *
 * @example
 * parseFilteredMapDataId('cozinhas_geolocalizadas?cnpj=1'); // null
 */
export const parseFilteredMapDataId = (id: string): ParsedFilter | null => {
  const [baseId, query] = splitOnce(id, '?');
  const base = FILTERABLE_BASES.find((candidate) => {
    return candidate.baseId === baseId;
  });
  if (!base || query === undefined) {
    return null;
  }
  const [field, value] = splitOnce(query, '=');
  if (!isFilterField(field) || !isFilterValue(value)) {
    return null;
  }
  return { ...base, field, value };
};

/**
 * Formats the {@link FilteredMapDataId} of one value of a base's field.
 *
 * @example
 * filteredMapDataId({ baseId: 'cozinhas_geolocalizadas', field: 'situacao', value: 'Mapeada' });
 * // 'cozinhas_geolocalizadas?situacao=Mapeada'
 */
export const filteredMapDataId = (
  filter: Pick<ParsedFilter, 'baseId' | 'field' | 'value'>
): FilteredMapDataId => {
  return `${filter.baseId}?${filter.field}=${filter.value}`;
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
 * deferred: no synonyms or typos, revisit when `generationLogger` shows
 * filter wording that reaches generation unmatched.
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
 * The coverage note (G-6) of each unfiltered filterable base among
 * `mapDataIds` whose snapshot holds only some values: the map answers within
 * that coverage, and its legend must say so. A filtered id needs no note: its
 * value is either covered in full or refused.
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
