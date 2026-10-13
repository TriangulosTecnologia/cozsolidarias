import type { StaticKitchenEnabledShareSource } from '../../data-source-static/readStaticKitchenEnabledShare2025';
import type { KitchenEnabledShare2025 } from '../schema/kitchenEnabledShare';

/**
 * Projects source counts into the app contract without leaking assignment IDs.
 * @param source - Validated snapshot; nationalTotal is positive.
 * @returns Municipal percentages with the unchanged national denominator.
 * @example toKitchenEnabledShare2025(source).municipalities[0].sharePercent;
 */
export const toKitchenEnabledShare2025 = (
  source: StaticKitchenEnabledShareSource
): KitchenEnabledShare2025 => {
  return {
    year: source.year,
    nationalTotal: source.nationalTotal,
    nationalEnabled: source.nationalEnabled,
    unresolvedEnabled: source.unresolvedEnabled,
    municipalities: source.municipalities.map((row) => {
      return {
        codigoIbge: row.code,
        municipio: row.name,
        uf: row.uf,
        enabledCount: row.count,
        sharePercent: (100 * row.count) / source.nationalTotal,
        anchor: [...row.anchor],
      };
    }),
  };
};
