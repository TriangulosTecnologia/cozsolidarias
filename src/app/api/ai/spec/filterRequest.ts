import {
  type FilterDomain,
  matchFilterValues,
  namesFilterableFamily,
} from './fieldFilters';
import type { RenderableDatasetId } from './mapDataCatalogue';
import type { PreflightResult } from './preflight';
import { FILTER_FIELDS } from './renderableFields';

/** The pt-BR refusal for a prompt that names a field value while the user already chose another dataset. */
const VALUE_WITH_DATASET_MESSAGE =
  'Escolher um dataset e pedir uma situação de cozinhas ao mesmo tempo ainda não é suportado. Peça uma coisa por vez.';

/** The pt-BR refusal for a prompt that names two values at once. */
const VALUES_COMBINED_MESSAGE =
  'Combinar mais de uma situação de cozinhas em um mapa ainda não é suportado. Peça uma situação por vez.';

/** Words asking for "the other" values, which no single value answers. */
const OTHERS = /\boutr[oa]s?\b|\bdemais\b/;

/** The pt-BR refusal for a prompt that names two snapshot years at once. */
const YEARS_COMBINED_MESSAGE =
  'Combinar mais de um ano de cozinhas em um mapa ainda não é suportado. Peça um ano por vez.';

/**
 * The domain of the dataset the user chose, else the one the prompt's year
 * names, else the most recent snapshot's; `undefined` when the prompt names
 * several years.
 */
const domainFor = (params: {
  text: string;
  datasetId?: RenderableDatasetId;
  domains: FilterDomain[];
}): FilterDomain | undefined => {
  const chosen = params.domains.find((domain) => {
    return domain.baseId === params.datasetId;
  });
  const latest = params.domains.reduce((best, domain) => {
    return domain.ano > best.ano ? domain : best;
  });
  const named = params.domains.filter((domain) => {
    return new RegExp(`\\b${domain.ano}\\b`).test(params.text);
  });
  return chosen ?? (named.length > 1 ? undefined : (named[0] ?? latest));
};

/**
 * The refusal asking the user to name one exact value: the choice cannot travel
 * back in a public `datasetId` without exposing the filter (G-1 option A).
 */
const pickOneMessage = (params: {
  domain: FilterDomain;
  values: string[];
}): string => {
  const { domain, values } = params;
  return `Este pedido não aponta um único valor de "${FILTER_FIELDS[domain.field]}". Peça de novo nomeando exatamente um destes valores de ${domain.ano}: ${values.join('; ')}.`;
};

/**
 * The values the prompt names, across every domain; none when it names no
 * filterable family. `combined` marks a request for several values at once:
 * two named exactly, or one named next to "outras"/"demais". "Outras" with no
 * value named names every value of every domain, so the user is asked which.
 */
const namedValues = (params: {
  text: string;
  domains: FilterDomain[];
}): { values: string[]; combined: boolean; others?: true } => {
  if (!namesFilterableFamily(params.text)) {
    return { values: [], combined: false };
  }
  const values = [
    ...new Set(
      params.domains.flatMap((domain) => {
        return domain.values;
      })
    ),
  ];
  const named = matchFilterValues({ text: params.text, values });
  if (!OTHERS.test(params.text)) {
    return {
      values: named.values,
      combined: named.exact && named.values.length > 1,
    };
  }
  // A value named next to "outras" asks for it plus the rest: a combination.
  return named.values.length === 0
    ? { values, combined: false, others: true }
    : { values: named.values, combined: true };
};

/**
 * Resolves the named values against the snapshot the user's dataset or the
 * prompt's year picks, refusing with the exact values to pick from when
 * several are covered or the prompt asked for "outras".
 */
const resolveValues = (params: {
  text: string;
  datasetId?: RenderableDatasetId;
  domains: FilterDomain[];
  values: string[];
  others?: true;
}): PreflightResult => {
  const domain = domainFor(params);
  if (domain === undefined) {
    return { status: 'unsupported', message: YEARS_COMBINED_MESSAGE };
  }
  const covered = params.values.filter((value) => {
    return domain.values.includes(value);
  });
  if (covered.length === 0) {
    return {
      status: 'unsupported',
      message: `O snapshot de ${domain.ano} não cobre esse valor de "${FILTER_FIELDS[domain.field]}": o dado é desconhecido, não zero. Peça outro ano.`,
    };
  }
  return covered.length > 1 || params.others
    ? {
        status: 'unsupported',
        message: pickOneMessage({ domain, values: covered }),
      }
    : {
        status: 'resolved',
        datasetId: domain.baseId,
        filter: { field: domain.field, value: covered[0] },
      };
};

/**
 * Resolves a prompt naming a value of an allowlisted field (see
 * `fieldFilters.ts`) against the values the data actually holds. Yields
 * nothing when the prompt names no such value.
 */
const filterRequest = (params: {
  text: string;
  datasetId?: RenderableDatasetId;
  domains: FilterDomain[];
}): PreflightResult | undefined => {
  const named = namedValues(params);
  if (named.values.length === 0) {
    return undefined;
  }
  const otherDataset =
    params.datasetId !== undefined &&
    !params.domains.some((domain) => {
      return domain.baseId === params.datasetId;
    });
  if (otherDataset) {
    return { status: 'unsupported', message: VALUE_WITH_DATASET_MESSAGE };
  }
  return named.combined
    ? { status: 'unsupported', message: VALUES_COMBINED_MESSAGE }
    : resolveValues({ ...params, ...named });
};

/**
 * The preflight verdict for a prompt naming a value the data holds for an
 * allowlisted field: the base id plus a server-side `filter`, never a
 * parameterized id. A user's pick of a filterable base fixes the year; a value
 * named next to another pick is refused; two values or two years named are
 * refused; a value the snapshot does not cover is refused (unknown, never
 * zero); a head word starting several covered values, or "outras", is refused
 * with the exact values to name.
 *
 * @param params.text - The prompt, accent-stripped and lower-cased.
 * @param params.datasetId - The dataset the user already chose, if any.
 * @param params.domains - The values each filterable base holds; omitted = none.
 * @returns The verdict, or `undefined` when the prompt names no value.
 *
 * @example
 * valueRequest({ text: 'cozinhas mapeadas 2025', domains });
 * // { status: 'resolved', datasetId: 'cozinhas_geolocalizadas_2025', filter: { field: 'situacao', value: 'Mapeada' } }
 */
export const valueRequest = (params: {
  text: string;
  datasetId?: RenderableDatasetId;
  domains?: FilterDomain[];
}): PreflightResult | undefined => {
  return filterRequest({ ...params, domains: params.domains ?? [] });
};
