/**
 * Shape of a single CAF (Cadastro Ambiental Rural) area record after the
 * semicolon-delimited CSV snapshot is parsed. Numeric fields (`nrArea`,
 * `latitude`, `longitude`) are coerced to `number | null`; all others are
 * strings.
 */
export type StaticCafAreaSource = {
  nrCaf: string;
  dsTipoArea: string;
  dsTipoUnidadeMedida: string;
  nrArea: number | null;
  cdMunicipio: string;
  sgUf: string;
  nmMunicipio: string;
  dsTipoLocalizacaoArea: string;
  dsCondicaoDominio: string;
  stImovelPrincipal: string;
  latitude: number | null;
  longitude: number | null;
};

/**
 * Shape of one município's pre-aggregated CAF count, read from the
 * `caf-por-municipio.json` snapshot generated offline by
 * `scripts/generateCafPorMunicipio.ts` (see that script for the aggregation
 * semantics). The raw `caf-area.csv` is far too large to aggregate at request
 * time, so this snapshot is the source the gateway reads instead.
 */
export type StaticCafPorMunicipioSource = {
  /** 7-digit IBGE municipality code (`cd_municipio`); joins to `codarea` on the map. */
  cdMunicipio: string;
  /** Município name as spelled in the CAF source (`nm_municipio`). */
  nmMunicipio: string;
  /** Number of distinct CAFs (`nr_caf`) counted in this município. */
  quantidade: number;
};

/**
 * Shape of a single CAF (Cadastro Ambiental Rural) production/income record
 * after the semicolon-delimited CSV snapshot is parsed. Numeric fields
 * (`vlRendaAuferida`, `vlRendaEstimada`) are coerced to `number | null`; all
 * others are strings.
 */
export type StaticCafProducaoSource = {
  nrCaf: string;
  categoriaRenda: string;
  dsTipoRenda: string;
  dsProduto: string;
  vlRendaAuferida: number | null;
  vlRendaEstimada: number | null;
};

/**
 * Shape of a single "cozinha solidária" record after the CSV snapshot is
 * parsed. Every column becomes a string, except the coordinates which are
 * coerced to `number | null` (missing values in the CSV are `---`).
 */
export type StaticCozinhaSource = {
  codigo: string;
  nome: string;
  endereco: string;
  bairro: string;
  cep: string;
  municipio: string;
  codigoIbge: string;
  uf: string;
  email: string;
  cnpj: string;
  emFuncionamento: string;
  diasFuncionamento: string;
  situacao: string;
  publicoAtendido: string;
  publicoTotalAtendido: string;
  refeicoesPorDia: string;
  latitude: number | null;
  longitude: number | null;
};
