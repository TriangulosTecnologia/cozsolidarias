import type { MapType } from '@ttoss/geovis';

import { isCadunicoRateId } from './cadunicoRateId';
import { namedYears, periodFeedback } from './catalogueFeedback';
import { type ConceptEntry, coversYear, normalize } from './conceptIndex';
import { isRecord, type SpecIssue, type UnknownRecord } from './specValidation';

/**
 * The request a generated spec must keep, bound by the route into the
 * `validate_spec` tool (`validateCandidateFor`) and into the final gate on the
 * agent's reply. Read only by {@link collectRequestIssues}.
 *
 * @example
 * const request: SpecRequest = { prompt: 'mapa do ivs', mapType: 'choropleth', conceptIds: ['municipios_ivs'], concepts };
 */
export type SpecRequest = {
  /** The user's prompt, as sent. */
  prompt: string;
  /** The map type the user chose, if any. */
  mapType?: MapType;
  /** The dataset the user chose, or the proxy the server pinned with {@link SpecRequest.note}. */
  datasetId?: string;
  /** The server's warning that `datasetId` is only a proxy of what the prompt asked. */
  note?: string;
  /** Every id of the dataset families the preflight matched in the prompt; absent when the user chose a dataset. */
  conceptIds?: string[];
  /** The catalogue index (see `buildConceptIndex`). */
  concepts: ConceptEntry[];
};

type Check = (params: {
  spec: UnknownRecord;
  request: SpecRequest;
}) => SpecIssue[];

const arrayOf = (value: unknown): unknown[] => {
  return Array.isArray(value) ? value : [];
};

/** A text field normalized for comparison (see `normalize`); empty when absent. */
const textOf = (value: unknown): string => {
  return typeof value === 'string' ? normalize(value) : '';
};

/** The `mapData[].mapDataId` strings the spec paints. */
const paintedIds = (spec: UnknownRecord): string[] => {
  return arrayOf(spec['mapData']).flatMap((entry) => {
    return isRecord(entry) && typeof entry['mapDataId'] === 'string'
      ? [entry['mapDataId']]
      : [];
  });
};

/** The catalogue datasets that feed a renderable id. */
const holdersOf = (params: {
  id: string;
  concepts: ConceptEntry[];
}): ConceptEntry[] => {
  return params.concepts.filter((entry) => {
    return entry.ids.includes(params.id);
  });
};

const ignoredMapType: Check = ({ spec, request }) => {
  if (!request.mapType || spec['mapType'] === request.mapType) {
    return [];
  }
  const written =
    spec['mapType'] === undefined
      ? 'nenhum mapType'
      : `mapType "${String(spec['mapType'])}"`;
  return [
    {
      code: 'ignored-user-map-type',
      path: 'mapType',
      message: `O usuário escolheu o tipo de mapa "${request.mapType}", mas a spec traz ${written}. Use exatamente mapType "${request.mapType}".`,
    },
  ];
};

const ignoredDataset: Check = ({ spec, request }) => {
  const ids = paintedIds(spec);
  const kept =
    ids.length > 0 &&
    ids.every((id) => {
      return id === request.datasetId;
    });
  if (!request.datasetId || kept) {
    return [];
  }
  const painted = ids.length > 0 ? `"${ids.join('", "')}"` : 'nenhum dataset';
  return [
    {
      code: 'ignored-user-dataset',
      path: 'mapData',
      message: `O usuário escolheu o dataset "${request.datasetId}", mas a spec pinta ${painted}. Use exatamente mapDataId "${request.datasetId}" em "mapData".`,
    },
  ];
};

const periodNotCovered: Check = ({ spec, request }) => {
  const text = normalize(request.prompt);
  return paintedIds(spec).flatMap((id) => {
    const feedback = periodFeedback({
      text,
      ids: [id],
      concepts: request.concepts,
    });
    return feedback
      ? [
          {
            code: 'period-not-covered',
            path: `mapData[${id}].mapDataId`,
            message: `${feedback.reason} O dataset "${id}" não cobre o ano pedido: use um dataset do mesmo conceito que cubra esse ano, ou responda com o erro missing_data.`,
          },
        ]
      : [];
  });
};

const multiplePaintedVariables: Check = ({ spec }) => {
  const count = arrayOf(spec['mapData']).length;
  return count > 1
    ? [
        {
          code: 'multiple-painted-variables',
          path: 'mapData',
          message: `A spec pinta ${count} variáveis em "mapData", mas um mapa pinta uma só: mantenha apenas a entrada que responde ao pedido.`,
        },
      ]
    : [];
};

const legendCountMismatch: Check = ({ spec }) => {
  const variables = arrayOf(spec['mapData']).length;
  const legends = arrayOf(spec['legends']).length;
  return variables > 0 && legends > 0 && legends !== variables
    ? [
        {
          code: 'legend-count-mismatch',
          path: 'legends',
          message: `A spec declara ${legends} legends para ${variables} entrada(s) de "mapData": declare exatamente uma legend de primeiro nível por entrada de "mapData", na mesma ordem.`,
        },
      ]
    : [];
};

const POINT_GEOMETRIES: unknown[] = ['point', 'heatmap'];

const pointsSpecWithMapData: Check = ({ spec }) => {
  const drawsPoints = arrayOf(spec['layers']).some((layer) => {
    return isRecord(layer) && POINT_GEOMETRIES.includes(layer['geometry']);
  });
  const paintsAVariable =
    spec['mapType'] !== undefined || arrayOf(spec['mapData']).length > 0;
  return drawsPoints && paintsAVariable
    ? [
        {
          code: 'points-spec-with-map-data',
          path: 'layers',
          message:
            'A spec desenha camadas de pontos ou de calor e também traz "mapType" ou "mapData". Um mapa de pontos ou de calor omite os dois; um mapa de uma variável por município omite "layers".',
        },
      ]
    : [];
};

/** Whether an id is one of the concept's: listed, or a CadÚnico rate on any base when the concept has one. */
const inConcept = (params: { id: string; conceptIds: string[] }): boolean => {
  return (
    params.conceptIds.includes(params.id) ||
    (isCadunicoRateId(params.id) && params.conceptIds.some(isCadunicoRateId))
  );
};

const conceptDrift: Check = ({ spec, request }) => {
  const conceptIds = request.conceptIds ?? [];
  if (conceptIds.length === 0) {
    return [];
  }
  return paintedIds(spec)
    .filter((id) => {
      return !inConcept({ id, conceptIds });
    })
    .map((id) => {
      return {
        code: 'concept-drift',
        path: `mapData[${id}].mapDataId`,
        message: `O dataset "${id}" mede outro conceito que o do pedido. Pinte um dataset do conceito pedido (${conceptIds.join(', ')}) ou responda com o erro missing_data.`,
      };
    });
};

const COMPLETENESS_CLAIM = /\b(todos|todas|completo|completa)\b/;

const completenessClaim: Check = ({ spec, request }) => {
  const claim = COMPLETENESS_CLAIM.exec(textOf(spec['title']))?.[1];
  const partialId = paintedIds(spec).find((id) => {
    return holdersOf({ id, concepts: request.concepts }).some((entry) => {
      return entry.partialCoverage;
    });
  });
  return claim && partialId
    ? [
        {
          code: 'completeness-claim-on-partial-coverage',
          path: 'title',
          message: `O título afirma completude ("${claim}"), mas o dataset "${partialId}" cobre só parte dos municípios: tire do título "todos", "todas", "completo" e "completa", e diga a cobertura parcial na "description".`,
        },
      ]
    : [];
};

/** Wordings that say the data only approximates the asked concept. */
const PROXY_MARKER =
  /aproxima|proxy|mais proxim|indiret|nao (e )?medid|nao mede/;

const missingProxyCaveat: Check = ({ spec, request }) => {
  return request.note && !PROXY_MARKER.test(textOf(spec['description']))
    ? [
        {
          code: 'missing-proxy-caveat',
          path: 'description',
          message: `O servidor indicou que o dataset é só o indicador mais próximo do pedido ("${request.note}"). A "description" precisa dizer isso em pt-BR: que o dado é uma aproximação, um indicador indireto, ou que o conceito não é medido diretamente.`,
        },
      ]
    : [];
};

/** Whether inclusive year ranges cover more than one year. */
const spansSeveralYears = (ranges: Array<[number, number]>): boolean => {
  return (
    ranges.some(([from, to]) => {
      return from !== to;
    }) ||
    new Set(
      ranges.map(([from]) => {
        return from;
      })
    ).size > 1
  );
};

const missingDefaultPeriodCaveat: Check = ({ spec, request }) => {
  if (namedYears(normalize(request.prompt)).length > 0) {
    return [];
  }
  const index = request.concepts;
  const stated = namedYears(textOf(spec['description']));
  return paintedIds(spec)
    .filter((id) => {
      const years = holdersOf({ id, concepts: index }).flatMap((entry) => {
        return entry.years;
      });
      return (
        spansSeveralYears(years) &&
        !stated.some((year) => {
          return coversYear({ index, id, year });
        })
      );
    })
    .map((id) => {
      return {
        code: 'missing-default-period-caveat',
        path: 'description',
        message: `O pedido não diz o ano e o dataset "${id}" tem dados de mais de um ano: diga na "description" qual ano o mapa mostra (por exemplo: "Dados de <ano>.").`,
      };
    });
};

const CHECKS: Check[] = [
  ignoredMapType,
  ignoredDataset,
  periodNotCovered,
  multiplePaintedVariables,
  legendCountMismatch,
  pointsSpecWithMapData,
  conceptDrift,
  completenessClaim,
  missingProxyCaveat,
  missingDefaultPeriodCaveat,
];

/**
 * The request-contract and caveat checks of a spec the agent wrote: the
 * user's map type and dataset, the period the prompt names, one painted
 * variable with one legend each, a points or heatmap spec that paints no
 * variable, the concept the preflight resolved, and the caveats a partial
 * coverage, a proxy or a default year demand. Title and description are
 * compared after `normalize`.
 *
 * Runs only on the agent's normalized spec (`normalizeCandidate`), never on a
 * resolved spec or one the preflight settled: those carry the `/mapas`
 * builders' own ids and several `mapData` entries.
 *
 * @param params.spec - The agent's normalized spec.
 * @param params.request - The request it answers.
 * @returns One issue per broken rule, uncategorized and unordered (see
 * `normalizeIssues`); empty when the spec keeps the request.
 *
 * @example
 * collectRequestIssues({ spec: { mapType: 'choropleth', mapData: [{ mapDataId: 'municipios_ivs' }] }, request: { prompt: 'mapa do ivs', mapType: 'dotDensity', concepts } });
 * // → [{ code: 'ignored-user-map-type', path: 'mapType', message: '...' }]
 */
export const collectRequestIssues = (params: {
  spec: UnknownRecord;
  request: SpecRequest;
}): SpecIssue[] => {
  return CHECKS.flatMap((check) => {
    return check(params);
  });
};
