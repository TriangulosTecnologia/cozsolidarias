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
 * Shape of one município's CADINSAN 2025 row after the comma-delimited CSV is
 * parsed. Food-insecurity headcounts among CadÚnico families, with and without
 * Programa Bolsa Família (PBF) beneficiaries, plus the CadÚnico total that is
 * their denominator. The source's own proportion columns (`"18,7%"`) are
 * ignored — the gateway recomputes the share from these counts. Count fields
 * are coerced to `number`; identity fields stay strings.
 */
export type StaticCadinsanMunicipioSource = {
  /** 7-digit IBGE code (`Cod_IBGE`); joins to `codarea` on the map. */
  codigoIbge: string;
  /** Macro-region (`Região`), e.g. `Sudeste`. */
  regiao: string;
  /** State (`UF`), the full name, e.g. `São Paulo`. */
  uf: string;
  /** Município name (`Município`). */
  municipio: string;
  /** Food-insecure CadÚnico families including PBF beneficiaries (`Cadinsan_absoluto_com_PBF`). */
  absolutoComPbf: number;
  /** Food-insecure CadÚnico families excluding PBF beneficiaries (`Cadinsan_absoluto_sem_PBF`). */
  absolutoSemPbf: number;
  /** Total CadÚnico registrations in the município (`Cadastros_Cadunico`); the share denominator. */
  cadastrosCadunico: number;
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

/**
 * Shape of the CAF anchor snapshot (`caf-pontos.json`), generated offline by
 * `scripts/generateCafPontos.ts`: one position per federative unit, the CAF
 * map's country level.
 *
 * Geometry only, deliberately: how many CAFs a UF holds is answered by summing
 * `caf-por-municipio.json` over `codigoUf`. Carrying counts here too would
 * create a second copy that can drift from the first.
 */
export type StaticCafPontosSource = {
  /** One anchor per federative unit (27), sorted by sigla. */
  ufs: {
    /** Two-digit IBGE code every município of the UF starts with, e.g. `29`. */
    codigoUf: string;
    /** Two-letter sigla, e.g. `BA`. */
    uf: string;
    /** Full state name, e.g. `Bahia`; the map's join key and hover title. */
    nome: string;
    /**
     * CAF-count-weighted mean of the UF's município centroids. The six
     * municípios created after the 2010 geometry vintage have no polygon and so
     * do not pull the anchor — they hold 2,608 CAFs (0.07%), and their counts
     * are still added to the UF's total.
     */
    longitude: number;
    /** CAF-count-weighted mean of the UF's município centroids. */
    latitude: number;
  }[];
};
