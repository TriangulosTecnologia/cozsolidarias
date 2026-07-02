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

/**
 * Raw nearby-POI snapshot as read from disk, before validation. Produced by the
 * `scripts/minha-cozinha-nearby` generators. `category`/`ring` arrive as plain
 * `string`/`number` and are narrowed to their unions inside the gateway
 * transformer; nothing is trusted until then.
 */
export type StaticNearbyPlacesSource = {
  type: string;
  metadata: {
    provider: string;
    cozinhaId: string;
    center: { latitude: number; longitude: number };
    radiusMeters: number;
    generatedAt: string;
    attribution: string;
    truncatedCategories: string[];
  };
  features: Array<{
    type: string;
    geometry: { type: string; coordinates: [number, number] };
    properties: {
      id: string;
      name: string | null;
      category: string;
      sourceType: string;
      distanceMeters: number;
      ring: number;
    };
  }>;
};

/**
 * Raw kitchen-enrichment snapshot as read from disk, before validation.
 * Produced by `scripts/minha-cozinha-enrichment/generate.py` (PII-free). Every
 * datum is `{ value, source, note? }`; `value` may be `null` when the source
 * has no entry. Nothing is trusted until the gateway transformer validates it.
 */
export type StaticEnrichmentSource = {
  cozinhaId: string;
  generatedAt: string;
  status: {
    situacao: StaticSourcedValue<string>;
    emFuncionamento: StaticSourcedValue<string>;
    refeicoesPorDia: StaticSourcedValue<number>;
  };
  sourcing: {
    comoAdquire: StaticSourcedValue<string>;
    gastoMensalTexto: StaticSourcedValue<string>;
    trabalhadores: StaticSourcedValue<string>;
  } | null;
  supplyNetwork: {
    municipio: string;
    paaReceivingUnits: StaticSourcedValue<number>;
    isPaaReceiver: StaticSourcedValue<boolean>;
    paaProducts: StaticSourcedValue<Array<{ produto: string; kg: number }>>;
    cafOrganizations: StaticSourcedValue<number>;
    cafExamples: StaticSourcedValue<string[]>;
  };
};

/** A single sourced datum in the raw enrichment snapshot. */
type StaticSourcedValue<T> = {
  value: T | null;
  source: string;
  note?: string;
};
