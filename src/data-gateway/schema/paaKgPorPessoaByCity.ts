/**
 * Canonical shape for the "kg previstos por pessoa atendida" aggregation of the
 * 2025 PAA purchases for the Cozinhas Solidárias, per **cozinha** município
 * (where the food is consumed).
 *
 * Built by joining the CONAB product rows to the receiving units through the
 * purchase proposal (TPAF): each proposal's planned kg are split among its
 * cozinhas in proportion to the people each one serves, then summed per
 * município. The supplier's município plays no part — the food is counted where
 * it is eaten. Proposals with no receiving unit (e.g. the CDAF/CI ones) are
 * left out. Only municípios with ≥1 receiving cozinha have a row.
 *
 * @example
 * const rioBranco: PaaKgPorPessoaByCity = {
 *   codigoIbge: '1200401',
 *   municipio: 'RIO BRANCO',
 *   kgPrevistos: 12020,
 *   pessoasAtendidas: 2650,
 *   cozinhas: 1,
 *   kgPorPessoa: 4.5, // 12020 / 2650
 * };
 */
export type PaaKgPorPessoaByCity = {
  /** 7-digit IBGE code of the cozinhas' município; joins to `codarea`. */
  codigoIbge: string;
  /** Município name as spelled in the CONAB receiving-units source. */
  municipio: string;
  /** Planned kg allocated to the município's cozinhas (see the type note). */
  kgPrevistos: number;
  /**
   * People served by the município's cozinhas, summed over every proposal row.
   * A cozinha listed under several proposals counts once per proposal, as each
   * row declares the people that proposal serves.
   */
  pessoasAtendidas: number;
  /** Distinct cozinhas (by registration code) receiving in the município. */
  cozinhas: number;
  /**
   * `kgPrevistos / pessoasAtendidas`, rounded to one decimal, or `null` when
   * no one is declared served (no denominator).
   */
  kgPorPessoa: number | null;
};
