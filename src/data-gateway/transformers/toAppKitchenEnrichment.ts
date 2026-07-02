import type { StaticEnrichmentSource } from '../../data-source-static/types';
import type {
  KitchenEnrichment,
  KitchenSourcing,
  PaaProduct,
  SourcedValue,
} from '../schema';

const isString = (value: unknown): value is string => {
  return typeof value === 'string';
};

const isNumber = (value: unknown): value is number => {
  return typeof value === 'number' && Number.isFinite(value);
};

const isBoolean = (value: unknown): value is boolean => {
  return typeof value === 'boolean';
};

const isStringArray = (value: unknown): value is string[] => {
  return Array.isArray(value) && value.every(isString);
};

const isPaaProduct = (item: unknown): item is PaaProduct => {
  if (typeof item !== 'object' || item === null) {
    return false;
  }
  const record = item as Record<string, unknown>;
  return isString(record['produto']) && isNumber(record['kg']);
};

const isPaaProducts = (value: unknown): value is PaaProduct[] => {
  return Array.isArray(value) && value.every(isPaaProduct);
};

/**
 * Validates one raw sourced datum and narrows its `value` to `T | null`. The
 * `source` must be a non-empty string; a present `value` must satisfy the guard.
 */
const toSourced = <T>(
  raw: { value: unknown; source: unknown; note?: unknown } | undefined,
  label: string,
  isValid: (value: unknown) => value is T
): SourcedValue<T> => {
  if (!raw || typeof raw.source !== 'string') {
    throw new Error(`[data-gateway] ${label}: malformed sourced value.`);
  }

  const value = raw.value ?? null;
  if (value !== null && !isValid(value)) {
    throw new Error(`[data-gateway] ${label}: unexpected value type.`);
  }

  const out: SourcedValue<T> = { value, source: raw.source };
  if (typeof raw.note === 'string') {
    out.note = raw.note;
  }
  return out;
};

/** Validates the optional self-reported sourcing block (may be absent). */
const toSourcing = (
  raw: StaticEnrichmentSource['sourcing'],
  label: string
): KitchenSourcing | null => {
  if (raw === null) {
    return null;
  }
  return {
    comoAdquire: toSourced(raw.comoAdquire, `${label}.comoAdquire`, isString),
    gastoMensalTexto: toSourced(
      raw.gastoMensalTexto,
      `${label}.gastoMensalTexto`,
      isString
    ),
    trabalhadores: toSourced(
      raw.trabalhadores,
      `${label}.trabalhadores`,
      isString
    ),
  };
};

/**
 * Validates a raw enrichment snapshot and returns the canonical
 * {@link KitchenEnrichment}. Narrows every sourced value to its declared type
 * and fails with a typed error on any structural or value violation.
 *
 * @param source - The raw snapshot read from disk.
 * @param context - `cozinhaId` used only for error messages.
 * @returns The validated, app-facing enrichment.
 * @throws If the snapshot or any of its sourced values is malformed.
 *
 * @example
 * const enrichment = toAppKitchenEnrichment(raw, { cozinhaId: 'CS014558' });
 * enrichment.supplyNetwork.municipio; // 'Porto Alegre'
 */
export const toAppKitchenEnrichment = (
  source: StaticEnrichmentSource,
  context: { cozinhaId: string }
): KitchenEnrichment => {
  const label = context.cozinhaId;

  if (!source || typeof source !== 'object') {
    throw new Error(`[data-gateway] ${label}: not an enrichment object.`);
  }
  if (!source.status || !source.supplyNetwork) {
    throw new Error(
      `[data-gateway] ${label}: missing status or supplyNetwork.`
    );
  }
  if (typeof source.supplyNetwork.municipio !== 'string') {
    throw new Error(`[data-gateway] ${label}: missing município.`);
  }

  const supply = source.supplyNetwork;

  return {
    cozinhaId: context.cozinhaId,
    generatedAt: source.generatedAt,
    status: {
      situacao: toSourced(
        source.status.situacao,
        `${label}.situacao`,
        isString
      ),
      emFuncionamento: toSourced(
        source.status.emFuncionamento,
        `${label}.emFuncionamento`,
        isString
      ),
      refeicoesPorDia: toSourced(
        source.status.refeicoesPorDia,
        `${label}.refeicoesPorDia`,
        isNumber
      ),
    },
    sourcing: toSourcing(source.sourcing, `${label}.sourcing`),
    supplyNetwork: {
      municipio: supply.municipio,
      paaReceivingUnits: toSourced(
        supply.paaReceivingUnits,
        `${label}.paaReceivingUnits`,
        isNumber
      ),
      isPaaReceiver: toSourced(
        supply.isPaaReceiver,
        `${label}.isPaaReceiver`,
        isBoolean
      ),
      paaProducts: toSourced(
        supply.paaProducts,
        `${label}.paaProducts`,
        isPaaProducts
      ),
      cafOrganizations: toSourced(
        supply.cafOrganizations,
        `${label}.cafOrganizations`,
        isNumber
      ),
      cafExamples: toSourced(
        supply.cafExamples,
        `${label}.cafExamples`,
        isStringArray
      ),
    },
  };
};
