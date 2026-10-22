import type { MapType } from '@ttoss/geovis';

/** One map type the user can pick, with its pt-BR label. */
export type MapTypeOption = { value: MapType; label: string };

/**
 * Every geovis `mapType` the playground can generate, in display order.
 * Returned with every `POST /api/ai/spec` response so the client can always
 * offer another map type.
 *
 * @example
 * MAP_TYPE_OPTIONS.map((option) => option.value); // ['choropleth', 'dotDensity', 'proportionalCircles']
 */
export const MAP_TYPE_OPTIONS = [
  { value: 'choropleth', label: 'Coroplético (áreas coloridas por valor)' },
  { value: 'dotDensity', label: 'Densidade de pontos' },
  { value: 'proportionalCircles', label: 'Círculos proporcionais' },
] as const satisfies readonly MapTypeOption[];

/**
 * Type guard for a user-supplied `mapType`.
 *
 * @param value - Untrusted value from the request body.
 * @returns Whether `value` is one of {@link MAP_TYPE_OPTIONS}.
 *
 * @example
 * isMapType('dotDensity'); // true
 */
export const isMapType = (value: unknown): value is MapType => {
  return MAP_TYPE_OPTIONS.some((option) => {
    return option.value === value;
  });
};
