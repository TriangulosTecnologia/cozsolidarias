/** A CadÚnico rate id: its base, in thousands, in the name (`2_5mil` is 2,5 mil). */
const CADUNICO_RATE_ID = /^cozinhas_por_(\d+(?:_\d+)?)mil_cadunico$/;

/**
 * A CadÚnico rate id, `cozinhas_por_<N>mil_cadunico`: cozinhas per N mil
 * people in the CadÚnico, any base. `cozinhas_por_10mil_cadunico` and
 * `cozinhas_por_100mil_cadunico` are two of them.
 */
export type CadunicoRateId = `cozinhas_por_${string}mil_cadunico`;

/** The base a well-formed rate id names, in people, or `undefined`. */
const baseInId = (id: string): number | undefined => {
  const thousands = CADUNICO_RATE_ID.exec(id)?.[1];
  const base =
    thousands === undefined
      ? undefined
      : Math.round(Number(thousands.replace('_', '.')) * 1000);
  return base !== undefined && base > 0 ? base : undefined;
};

/**
 * Whether `id` is a CadÚnico rate id with a positive base.
 *
 * @example
 * isCadunicoRateId('cozinhas_por_50mil_cadunico'); // true
 * isCadunicoRateId('cozinhas_por_0mil_cadunico'); // false
 */
export const isCadunicoRateId = (id: unknown): id is CadunicoRateId => {
  return typeof id === 'string' && baseInId(id) !== undefined;
};

/**
 * The rate base a CadÚnico rate id names: the one source of the base, from the
 * prompt to the fetcher, the legend and the hover card.
 *
 * @param id - A CadÚnico rate id.
 * @returns The base, in people.
 * @throws When `id` is not a CadÚnico rate id: it names no base.
 *
 * @example
 * rateBaseOf('cozinhas_por_50mil_cadunico'); // 50_000
 * rateBaseOf('cozinhas_por_2_5mil_cadunico'); // 2_500
 */
export const rateBaseOf = (id: string): number => {
  const base = baseInId(id);
  if (base === undefined) {
    throw new Error(`no rate base for "${id}": it is not a CadÚnico rate id`);
  }
  return base;
};

/**
 * The CadÚnico rate id for a base: the id a prompt that names `base` is served
 * under.
 *
 * @param base - The base, in people (positive).
 * @returns `cozinhas_por_<base / 1000>mil_cadunico`, a decimal written with `_`.
 *
 * @example
 * cadunicoRateId(50_000); // 'cozinhas_por_50mil_cadunico'
 * cadunicoRateId(2_500); // 'cozinhas_por_2_5mil_cadunico'
 */
export const cadunicoRateId = (base: number): CadunicoRateId => {
  return `cozinhas_por_${String(base / 1000).replace('.', '_')}mil_cadunico`;
};
