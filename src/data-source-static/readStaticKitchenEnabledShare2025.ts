import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Offline snapshot of habilitadas assigned to municipalities, including records
 * without coordinates. The denominator includes every national 2025 record.
 * @example const source: StaticKitchenEnabledShareSource = await readStaticKitchenEnabledShare2025();
 */
export type StaticKitchenEnabledShareSource = {
  year: 2025;
  nationalTotal: number;
  nationalEnabled: number;
  unresolvedEnabled: number;
  registeredMunicipalities: Array<{
    code: string;
    name: string;
    uf: string;
    total: number;
    enabled: number;
    anchor: [number, number];
  }>;
  municipalities: Array<{
    code: string;
    name: string;
    uf: string;
    count: number;
    anchor: [number, number];
  }>;
};

const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};
const isCount = (value: unknown): value is number => {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
};
const isPosition = (value: unknown): value is [number, number] => {
  return (
    Array.isArray(value) && value.length === 2 && value.every(Number.isFinite)
  );
};
const isIdentity = (row: Record<string, unknown>): boolean => {
  return (
    typeof row['code'] === 'string' &&
    /^\d{7}$/.test(row['code']) &&
    typeof row['name'] === 'string' &&
    typeof row['uf'] === 'string'
  );
};
const isMunicipality = (
  value: unknown
): value is StaticKitchenEnabledShareSource['municipalities'][number] => {
  return (
    isObject(value) &&
    isIdentity(value) &&
    isCount(value['count']) &&
    isPosition(value['anchor'])
  );
};
const isMunicipalityList = (value: unknown): boolean => {
  return Array.isArray(value) && value.every(isMunicipality);
};

const validRegisteredCounts = (row: Record<string, unknown>): boolean => {
  return (
    isCount(row['total']) &&
    row['total'] > 0 &&
    isCount(row['enabled']) &&
    row['enabled'] <= row['total']
  );
};
const isRegistered = (row: unknown): boolean => {
  if (!isObject(row)) return false;
  return (
    isIdentity(row) && isPosition(row['anchor']) && validRegisteredCounts(row)
  );
};
const isRegisteredList = (value: unknown): boolean => {
  return (
    Array.isArray(value) &&
    value.every((row) => {
      return isRegistered(row);
    })
  );
};
const reconcileRegistered = (
  source: StaticKitchenEnabledShareSource
): boolean => {
  const rows = source.registeredMunicipalities;
  const codes = new Set(
    rows.map((row) => {
      return row.code;
    })
  );
  const totals = rows.reduce((sum, row) => {
    return sum + row.total;
  }, 0);
  const enabled = rows.reduce((sum, row) => {
    return sum + row.enabled;
  }, 0);
  return (
    codes.size === rows.length &&
    totals === source.nationalTotal &&
    enabled === source.nationalEnabled &&
    source.municipalities.every((row) => {
      return (
        rows.find((entry) => {
          return entry.code === row.code;
        })?.enabled === row.count
      );
    })
  );
};

const hasValidTotals = (value: Record<string, unknown>): boolean => {
  return (
    isCount(value['nationalTotal']) &&
    isCount(value['nationalEnabled']) &&
    value['unresolvedEnabled'] === 0
  );
};
const assertRegistered = (value: StaticKitchenEnabledShareSource): void => {
  if (!reconcileRegistered(value))
    throw new Error(
      '[data-source-static] Municipal denominator reconciliation failed.'
    );
};

const isSnapshot = (
  value: unknown
): value is StaticKitchenEnabledShareSource => {
  if (!isObject(value) || value['year'] !== 2025) return false;
  return (
    hasValidTotals(value) &&
    isMunicipalityList(value['municipalities']) &&
    isRegisteredList(value['registeredMunicipalities'])
  );
};

/**
 * Validates source shape, unique municipal codes and the national reconciliation.
 * @param text - Generated snapshot JSON.
 * @returns The validated source; provenance remains internal to this layer.
 * @throws When structure, denominator or reconciliation is invalid.
 * @example parseKitchenEnabledShare2025('{"year":2025,"nationalTotal":10,"nationalEnabled":1,"unresolvedEnabled":0,"municipalities":[{"code":"3550308","name":"São Paulo","uf":"SP","count":1,"anchor":[-46.6,-23.5]}]}');
 */
export const parseKitchenEnabledShare2025 = (
  text: string
): StaticKitchenEnabledShareSource => {
  const value: unknown = JSON.parse(text);
  if (!isSnapshot(value))
    throw new Error('[data-source-static] Invalid enabled kitchen snapshot.');
  const codes = new Set(
    value.municipalities.map((row) => {
      return row.code;
    })
  );
  const assigned = value.municipalities.reduce((sum, row) => {
    return sum + row.count;
  }, 0);
  if (
    codes.size !== value.municipalities.length ||
    value.nationalTotal === 0 ||
    value.nationalEnabled > value.nationalTotal ||
    assigned + value.unresolvedEnabled !== value.nationalEnabled
  ) {
    throw new Error(
      '[data-source-static] Enabled kitchen reconciliation failed.'
    );
  }
  assertRegistered(value);
  return value;
};

let cache: StaticKitchenEnabledShareSource | null = null;

/**
 * Reads the versioned snapshot once per server process, failing on invalid data.
 * @returns Source-native municipal counts and national totals for 2025.
 * @example const snapshot = await readStaticKitchenEnabledShare2025();
 */
export const readStaticKitchenEnabledShare2025 =
  async (): Promise<StaticKitchenEnabledShareSource> => {
    if (cache) return cache;
    const text = await readFile(
      join(
        process.cwd(),
        'src/data-source-static/data/kitchen-enabled-share-2025.json'
      ),
      'utf8'
    );
    cache = parseKitchenEnabledShare2025(text);
    return cache;
  };
