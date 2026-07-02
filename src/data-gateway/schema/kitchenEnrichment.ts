/**
 * Canonical shapes for the "enrichment" layer of the Minha Cozinha page — a
 * public-policy/supply reading of a kitchen, complementary to the physical
 * surroundings ({@link NearbyPlacesContract}). It is built offline from four
 * external spreadsheets for the 10 sample kitchens only.
 *
 * Every datum carries its own provenance via {@link SourcedValue} so the UI can
 * show, per field, which file/column/aggregation it came from. No personal data
 * (CPF, representative names, personal phones) ever reaches this contract.
 */

/**
 * A single enriched datum with its provenance. `value` is `null` when the
 * source has no entry for this kitchen; `source` still explains where the field
 * would come from (or why it is absent). `note` carries an optional caveat
 * (e.g. "autodeclarado").
 *
 * @example
 * const situacao: SourcedValue<string> = {
 *   value: 'Habilitada',
 *   source: "Banco de Cozinhas Solidárias (03/11/2025) — coluna 'Situação'",
 * };
 */
export type SourcedValue<T> = {
  value: T | null;
  source: string;
  note?: string;
};

/**
 * Angle C — official programme status, joined by kitchen code against the
 * Banco de Cozinhas Solidárias. All fields are `null` when the kitchen is not
 * listed there.
 */
export type KitchenStatus = {
  /** Programme situation (e.g. `Habilitada`, `Mapeada`). */
  situacao: SourcedValue<string>;
  /** Whether it currently operates (source's free text). */
  emFuncionamento: SourcedValue<string>;
  /** Meals produced per day. */
  refeicoesPorDia: SourcedValue<number>;
};

/**
 * Angle A — self-reported sourcing, fuzzy-joined by name + município against the
 * 2024 Mapeamento form. Free text is kept verbatim; values are display strings.
 */
export type KitchenSourcing = {
  /** How food is acquired today (self-reported free text). */
  comoAdquire: SourcedValue<string>;
  /** Monthly spend on food, as self-reported free text (not normalized). */
  gastoMensalTexto: SourcedValue<string>;
  /** Number of people working, as self-reported free text. */
  trabalhadores: SourcedValue<string>;
};

/** One PAA product aggregate for the município (kilograms, rounded). */
export type PaaProduct = {
  produto: string;
  kg: number;
};

/**
 * Angle A/B — the federal supply network around the kitchen's município,
 * aggregated from CONAB/PAA 2025 and CAF-PJ. When every count is zero the
 * município is a "supply desert" — a qualitative note the UI surfaces.
 */
export type KitchenSupplyNetwork = {
  municipio: string;
  /** PAA receiving units in the município (count). */
  paaReceivingUnits: SourcedValue<number>;
  /** Whether this kitchen itself is a PAA receiver (matched by CNPJ). */
  isPaaReceiver: SourcedValue<boolean>;
  /** Top products delivered via PAA in the município, by volume. */
  paaProducts: SourcedValue<PaaProduct[]>;
  /** Family-farming organizations registered in the município (count). */
  cafOrganizations: SourcedValue<number>;
  /** A few example organization names (razão social). */
  cafExamples: SourcedValue<string[]>;
};

/**
 * Full enrichment for one cozinha. `sourcing` is `null` when no Mapeamento form
 * matched the kitchen.
 *
 * @example
 * const enrichment: KitchenEnrichment = {
 *   cozinhaId: 'CS014558',
 *   generatedAt: '2025-11-04',
 *   status: {
 *     situacao: { value: 'Habilitada', source: "Banco … 'Situação'" },
 *     emFuncionamento: { value: 'Sim', source: 'Banco …' },
 *     refeicoesPorDia: { value: null, source: 'Banco …' },
 *   },
 *   sourcing: null,
 *   supplyNetwork: {
 *     municipio: 'Porto Alegre',
 *     paaReceivingUnits: { value: 126, source: 'CONAB/PAA 2025 …' },
 *     isPaaReceiver: { value: false, source: 'CONAB/PAA 2025 …' },
 *     paaProducts: { value: [], source: 'CONAB/PAA 2025 …' },
 *     cafOrganizations: { value: 0, source: 'CAF-PJ …' },
 *     cafExamples: { value: [], source: 'CAF-PJ …' },
 *   },
 * };
 */
export type KitchenEnrichment = {
  cozinhaId: string;
  /** ISO date the enrichment JSON was generated. */
  generatedAt: string;
  status: KitchenStatus;
  sourcing: KitchenSourcing | null;
  supplyNetwork: KitchenSupplyNetwork;
};
