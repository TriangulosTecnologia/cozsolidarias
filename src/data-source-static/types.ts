/** Raw shape of the greeting record as it lives in the static snapshot. */
export type StaticGreetingSource = {
  message: string;
  source: string;
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
