/**
 * Canonical detail of a single cozinha solidária, keyed by its registration
 * code. Feeds the per-cozinha detail endpoint (`GET /api/cozinhas/[codigo]`)
 * and, later, the click-to-inspect panel on the map.
 *
 * Descriptive fields only. The source's contact/PII columns (email, telefone,
 * CNPJ) and its internal review-workflow columns (avaliador, homologador,
 * analysis/homologation dates, …) are intentionally left out of the contract.
 * An empty string means "não informado" — the source already normalizes blank
 * cells to `''`.
 */
export type CozinhaDetalhe = {
  /** Registration code (`Código da Cozinha`), e.g. `CS016282`. The lookup key. */
  codigo: string;
  /** Kitchen name. */
  nome: string;
  /** Street address. */
  endereco: string;
  /** Neighbourhood. */
  bairro: string;
  /** Postal code (CEP). */
  cep: string;
  /** Município name, as typed in the source. */
  municipio: string;
  /** State (UF) abbreviation. */
  uf: string;
  /** Free-text answer to "está em funcionamento atualmente?". */
  emFuncionamento: string;
  /** Free-text description of the weekly operating days. */
  diasFuncionamento: string;
  /** Registration status (`Situação`), e.g. `Habilitada`. */
  situacao: string;
  /** Comma-separated groups the kitchen serves (`Público Atendido`). */
  publicoAtendido: string;
  /** People served, as reported. Kept as text; may be blank. */
  publicoTotalAtendido: string;
  /** Date of the last data update, as reported. */
  dataUltimaAtualizacao: string;
  /** Latitude in decimal degrees, or `null` when the source has no coordinate. */
  latitude: number | null;
  /** Longitude in decimal degrees, or `null` when the source has no coordinate. */
  longitude: number | null;
  /** Full formatted address (`Endereço Completo`). */
  enderecoCompleto: string;
};
