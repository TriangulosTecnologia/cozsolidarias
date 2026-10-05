import type { GeoJSONFeatureCollection } from '@ttoss/geovis';

import type { StaticCozinhaSource } from '../../data-source-static/types';
import type { KitchenByCity, KitchenRateByCity } from '../schema';
import type { IndexedMunicipio } from './municipioIndex';
import { findMunicipio, indexMunicipios } from './municipioIndex';

/**
 * Parses the free-text `publicoTotalAtendido` cell into a whole number of
 * people served. Blank or non-numeric text is unknown and becomes `null` —
 * never coerced to `0`, so a kitchen that didn't report a count is never
 * confused with one that reported serving nobody.
 *
 * @param raw - Raw `publicoTotalAtendido` value from a {@link StaticCozinhaSource}.
 * @returns The parsed count, or `null` when unknown.
 *
 * @example
 * parsePessoasAtendidas('200'); // 200
 * parsePessoasAtendidas(''); // null
 * parsePessoasAtendidas('desconhecido'); // null
 */
export const parsePessoasAtendidas = (raw: string): number | null => {
  const trimmed = raw.trim();

  if (trimmed === '') {
    return null;
  }

  const parsed = Number(trimmed);

  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : null;
};

/** Returns the most frequent (non-empty) name, ties broken by first seen. */
const mostVotedName = (nameVotes: Map<string, number>): string => {
  let best = '';
  let bestVotes = -1;

  for (const [name, votes] of nameVotes) {
    if (name !== '' && votes > bestVotes) {
      best = name;
      bestVotes = votes;
    }
  }

  return best;
};

/** Running tallies of one município while cozinhas are being aggregated. */
type MunicipioBucket = {
  quantidade: number;
  nameVotes: Map<string, number>;
  sumLng: number;
  sumLat: number;
  pessoasAtendidas: number;
  pessoasAtendidasKnown: boolean;
};

/**
 * The IBGE code a located point counts toward: the polygon containing it, else
 * the declared code when the index knows it, else `undefined` (dropped).
 */
const locateCodigoIbge = ({
  index,
  indexedCodes,
  point,
  declared,
}: {
  index: IndexedMunicipio[];
  indexedCodes: Set<string>;
  point: [number, number];
  declared: string;
}): string | undefined => {
  const match = findMunicipio({ index, point });

  if (match) {
    return match.codigoIbge;
  }

  return indexedCodes.has(declared) ? declared : undefined;
};

/**
 * A município with its cozinha count plus a representative anchor point.
 *
 * @example
 * const row: MunicipioAggregate = {
 *   codigoIbge: '3550308',
 *   municipio: 'São Paulo',
 *   quantidade: 2,
 *   pessoasAtendidas: 350,
 *   centroid: [-46.63, -23.55],
 * };
 */
export type MunicipioAggregate = KitchenByCity & {
  /**
   * Representative point for the município, as the mean of its member cozinha
   * coordinates (`[lng, lat]`). Always lands among the actual cozinhas, so it's
   * a good anchor for a proportional-symbol (bubble) marker.
   */
  centroid: [number, number];
};

/**
 * Aggregates cozinhas into per-município buckets via point-in-polygon.
 *
 * Each cozinha with coordinates is located inside one município polygon
 * (matched by `codarea`); counts are tallied per code and the member
 * coordinates are summed so a representative `centroid` (their mean) can be
 * derived. A point outside every polygon (coastline or border points against
 * the simplified geometry) falls back to the cozinha's declared `codigoIbge`
 * when that code is in the index, and then counts exactly like a polygon match
 * (count, name vote, people served, centroid). Cozinhas without coordinates, or
 * outside every polygon with an empty or unindexed declared code, are dropped.
 *
 * A polygon match always wins over the declared code, so the join key comes
 * from the geometry whenever the geometry can answer. The display `municipio`
 * name comes from the source records, which can be dirty (a record's typed
 * município may disagree with where its coordinates land), so we pick the
 * *most frequent* name among the cozinhas in each município rather than the
 * first one.
 *
 * @param params.cozinhas - Raw cozinha records from data-source-static.
 * @param params.municipios - Brazilian municipalities GeoJSON
 * (`public/geo/geojs-100-mun.json`).
 * @returns One {@link MunicipioAggregate} per município that has ≥1 cozinha,
 * in order of each município's first matched cozinha.
 *
 * @example
 * aggregateCozinhasPorMunicipio({ cozinhas, municipios });
 * // [{ codigoIbge: '3550308', municipio: 'São Paulo', quantidade: 2,
 * //    pessoasAtendidas: 350, centroid: [-46.63, -23.55] }, ...]
 */
export const aggregateCozinhasPorMunicipio = ({
  cozinhas,
  municipios,
}: {
  cozinhas: StaticCozinhaSource[];
  municipios: GeoJSONFeatureCollection;
}): MunicipioAggregate[] => {
  const index = indexMunicipios(municipios);
  const indexedCodes = new Set(
    index.map(({ codigoIbge }) => {
      return codigoIbge;
    })
  );
  const counts = new Map<string, MunicipioBucket>();

  for (const cozinha of cozinhas) {
    if (cozinha.latitude === null || cozinha.longitude === null) {
      continue;
    }

    const codigoIbge = locateCodigoIbge({
      index,
      indexedCodes,
      point: [cozinha.longitude, cozinha.latitude],
      declared: cozinha.codigoIbge,
    });

    if (!codigoIbge) {
      continue;
    }

    let current = counts.get(codigoIbge);
    if (!current) {
      current = {
        quantidade: 0,
        nameVotes: new Map(),
        sumLng: 0,
        sumLat: 0,
        pessoasAtendidas: 0,
        pessoasAtendidasKnown: false,
      };
      counts.set(codigoIbge, current);
    }

    current.quantidade += 1;
    current.sumLng += cozinha.longitude;
    current.sumLat += cozinha.latitude;
    const name = cozinha.municipio;
    current.nameVotes.set(name, (current.nameVotes.get(name) ?? 0) + 1);

    const pessoas = parsePessoasAtendidas(cozinha.publicoTotalAtendido);
    if (pessoas !== null) {
      current.pessoasAtendidas += pessoas;
      current.pessoasAtendidasKnown = true;
    }
  }

  return [...counts].map(
    ([
      codigoIbge,
      {
        quantidade,
        nameVotes,
        sumLng,
        sumLat,
        pessoasAtendidas,
        pessoasAtendidasKnown,
      },
    ]) => {
      return {
        codigoIbge,
        municipio: mostVotedName(nameVotes),
        quantidade,
        pessoasAtendidas: pessoasAtendidasKnown ? pessoasAtendidas : null,
        centroid: [sumLng / quantidade, sumLat / quantidade] as [
          number,
          number,
        ],
      };
    }
  );
};

/**
 * Cozinhas per 100,000 inhabitants for a single município:
 * `(quantidade / populacao) * 100_000`, rounded to two decimals.
 *
 * @param params.quantidade - Cozinha count in the município (≥ 0).
 * @param params.populacao - Resident population, or `null`/`undefined` when the
 * município is missing from the population snapshot.
 * @returns The rounded rate, or `null` when the population is unknown or
 * non-positive (no valid denominator).
 *
 * @example
 * cozinhasPorCemMil({ quantidade: 10, populacao: 250_000 }); // 4
 * cozinhasPorCemMil({ quantidade: 3, populacao: null }); // null
 */
export const cozinhasPorCemMil = ({
  quantidade,
  populacao,
}: {
  quantidade: number;
  populacao: number | null | undefined;
}): number | null => {
  if (populacao === null || populacao === undefined || populacao <= 0) {
    return null;
  }

  return Math.round((quantidade / populacao) * 100_000 * 100) / 100;
};

/**
 * Cozinhas per 10,000 people registered in the Cadastro Único:
 * `(quantidade / pessoas) * 10_000`, rounded to two decimals.
 *
 * @param params.quantidade - Cozinha count in the município (≥ 0).
 * @param params.pessoas - People registered in the Cadastro Único, or
 * `null`/`undefined` when the município is missing from the snapshot.
 * @returns The rounded rate, or `null` when the denominator is unknown or
 * non-positive (no valid denominator).
 *
 * @example
 * cozinhasPorDezMilCadUnico({ quantidade: 573, pessoas: 3_884_884 }); // 1.47
 * cozinhasPorDezMilCadUnico({ quantidade: 3, pessoas: null }); // null
 */
export const cozinhasPorDezMilCadUnico = ({
  quantidade,
  pessoas,
}: {
  quantidade: number;
  pessoas: number | null | undefined;
}): number | null => {
  if (pessoas === null || pessoas === undefined || pessoas <= 0) {
    return null;
  }

  return Math.round((quantidade / pessoas) * 10_000 * 100) / 100;
};

/**
 * People registered in the Cadastro Único per cozinha — the inverse coverage
 * ratio `pessoas / quantidade`, rounded to a whole person.
 *
 * @param params.pessoas - People registered in the Cadastro Único, or
 * `null`/`undefined` when the município is missing from the snapshot.
 * @param params.quantidade - Cozinha count in the município.
 * @returns The rounded people-per-cozinha, or `null` when `pessoas` is unknown
 * or `quantidade` is non-positive (no valid ratio).
 *
 * @example
 * pessoasCadUnicoPorCozinha({ pessoas: 3_884_884, quantidade: 573 }); // 6780
 * pessoasCadUnicoPorCozinha({ pessoas: null, quantidade: 3 }); // null
 */
export const pessoasCadUnicoPorCozinha = ({
  pessoas,
  quantidade,
}: {
  pessoas: number | null | undefined;
  quantidade: number;
}): number | null => {
  if (pessoas === null || pessoas === undefined || quantidade <= 0) {
    return null;
  }

  return Math.round(pessoas / quantidade);
};

/**
 * Share (%) of all Brazilian cozinhas located in a single município:
 * `(quantidade / total) * 100`, rounded to two decimals.
 *
 * @param params.quantidade - Cozinha count in the município (≥ 0).
 * @param params.total - National total (sum of `quantidade` across every
 * município).
 * @returns The rounded share, or `0` when `total` is non-positive (no cozinhas
 * to take a share of).
 *
 * @example
 * cozinhasPercentualDoBrasil({ quantidade: 5, total: 5000 }); // 0.1
 * cozinhasPercentualDoBrasil({ quantidade: 2, total: 0 }); // 0
 */
export const cozinhasPercentualDoBrasil = ({
  quantidade,
  total,
}: {
  quantidade: number;
  total: number;
}): number => {
  if (total <= 0) {
    return 0;
  }

  return Math.round((quantidade / total) * 100 * 100) / 100;
};

/**
 * Projects the per-município aggregate into the enriched canonical contract,
 * joining each município's Census population and Cadastro Único registrations by
 * IBGE code and deriving the two per-100k rates plus the share (%) of Brazil's
 * cozinhas.
 *
 * Kept separate from {@link aggregateCozinhasPorMunicipio} (the expensive
 * point-in-polygon step) so the gateway can memoize the aggregate once and
 * project it cheaply. The national total (the share denominator) is the sum of
 * the aggregate's counts, so the shares add up to 100% of what the choropleth
 * paints.
 *
 * @param params.aggregate - Per-município aggregate from
 * {@link aggregateCozinhasPorMunicipio}.
 * @param params.populacao - Flat `{ codigoIbge: habitantes }` snapshot.
 * @param params.cadunico - Flat `{ codigoIbge: pessoasCadastradas }` snapshot.
 * @returns One {@link KitchenRateByCity} per município in the aggregate.
 *
 * @example
 * projectComTaxa({ aggregate, populacao, cadunico });
 * // [{ codigoIbge, ..., porDezMilCadUnico, pessoasPorCozinha }, ...]
 */
export const projectComTaxa = ({
  aggregate,
  populacao,
  cadunico,
}: {
  aggregate: MunicipioAggregate[];
  populacao: Record<string, number>;
  cadunico: Record<string, number>;
}): KitchenRateByCity[] => {
  const total = aggregate.reduce((sum, { quantidade }) => {
    return sum + quantidade;
  }, 0);

  return aggregate.map(
    ({ codigoIbge, municipio, quantidade, pessoasAtendidas }) => {
      const habitantes = populacao[codigoIbge] ?? null;
      const pessoasCadUnico = cadunico[codigoIbge] ?? null;
      return {
        codigoIbge,
        municipio,
        quantidade,
        pessoasAtendidas,
        populacao: habitantes,
        porCemMil: cozinhasPorCemMil({ quantidade, populacao: habitantes }),
        percentualDoBrasil: cozinhasPercentualDoBrasil({ quantidade, total }),
        pessoasCadUnico,
        porDezMilCadUnico: cozinhasPorDezMilCadUnico({
          quantidade,
          pessoas: pessoasCadUnico,
        }),
        pessoasPorCozinha: pessoasCadUnicoPorCozinha({
          pessoas: pessoasCadUnico,
          quantidade,
        }),
      };
    }
  );
};
