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
  uf: string;
  email: string;
  telefone: string;
  cnpj: string;
  emFuncionamento: string;
  diasFuncionamento: string;
  situacao: string;
  dataEnvioAnalise: string;
  reanalise: string;
  avaliador: string;
  dataAvaliacao: string;
  homologador: string;
  dataHomologacao: string;
  publicoAtendido: string;
  publicoTotalAtendido: string;
  dadosAtualizados: string;
  dataUltimaAtualizacao: string;
  atualizacaoGeoFotos: string;
  linkGeolocalizacao: string;
  latitude: number | null;
  longitude: number | null;
  statusFotoGeo: string;
  enderecoCompleto: string;
};
