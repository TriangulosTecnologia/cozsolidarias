/**
 * Habilitadas in each municipality divided by ALL national 2025 kitchens.
 * Percentages are unrounded. Anchors lie inside the map's municipal geometry.
 * @example const result: KitchenEnabledShare2025 = { year: 2025, nationalTotal: 10, nationalEnabled: 3, unresolvedEnabled: 0, municipalities: [] };
 */
export type KitchenEnabledShare2025 = {
  year: 2025;
  nationalTotal: number;
  nationalEnabled: number;
  unresolvedEnabled: number;
  municipalities: Array<{
    codigoIbge: string;
    municipio: string;
    uf: string;
    enabledCount: number;
    sharePercent: number;
    anchor: [number, number];
  }>;
};
