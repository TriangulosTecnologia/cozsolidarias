import type { StaticIvsSource } from '../../data-source-static/readStaticIvs';
import type { MunicipioIvs } from '../schema';

/** Highest valid IVS score; the index is defined on the closed interval [0, 1]. */
const MAX_IVS = 1;

/** True when an IVS-family score sits on the valid closed interval `[0, 1]`. */
const inRange = (value: number): boolean => {
  return value >= 0 && value <= MAX_IVS;
};

/**
 * Projects the source-native Atlas IVS rows into the canonical
 * {@link MunicipioIvs} contract consumed by the choropleth family.
 *
 * Deterministic and pure. Rows whose `codigoIbge` is blank or whose `ivs` or any
 * sub-index falls outside the valid `[0, 1]` interval are dropped rather than
 * coerced — the map then treats those municípios as "sem dado" instead of
 * painting a fabricated band. The 7-digit `codigoIbge` is passed through
 * unchanged, so it joins directly to `feature.properties.codarea`.
 *
 * @param sources - Source-native IVS records (from `readStaticIvs`).
 * @returns One canonical row per município whose every IVS-family score is
 * valid, in input order.
 *
 * @example
 * toMunicipioIvs([{ codigoIbge: '5300108', municipio: 'Brasília (DF)', ivs: 0.294,
 *   ivsInfraestruturaUrbana: 0.412, ivsCapitalHumano: 0.265, ivsRendaETrabalho: 0.204 }]);
 * // [{ codigoIbge: '5300108', municipio: 'Brasília (DF)', ivs: 0.294,
 * //    ivsInfraestruturaUrbana: 0.412, ivsCapitalHumano: 0.265, ivsRendaETrabalho: 0.204 }]
 */
export const toMunicipioIvs = (sources: StaticIvsSource[]): MunicipioIvs[] => {
  return sources.flatMap((source): MunicipioIvs[] => {
    const valid =
      source.codigoIbge !== '' &&
      inRange(source.ivs) &&
      inRange(source.ivsInfraestruturaUrbana) &&
      inRange(source.ivsCapitalHumano) &&
      inRange(source.ivsRendaETrabalho);

    return valid
      ? [
          {
            codigoIbge: source.codigoIbge,
            municipio: source.municipio,
            ivs: source.ivs,
            ivsInfraestruturaUrbana: source.ivsInfraestruturaUrbana,
            ivsCapitalHumano: source.ivsCapitalHumano,
            ivsRendaETrabalho: source.ivsRendaETrabalho,
          },
        ]
      : [];
  });
};
