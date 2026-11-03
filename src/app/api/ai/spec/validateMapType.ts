import type { MapType } from '@ttoss/geovis';

import { isMapType, MAP_TYPE_OPTIONS } from './mapTypeOptions';
import { errorResponse } from './specValidation';

/**
 * Reads the optional `mapType` of a request body.
 *
 * @param rawBody - A body whose `prompt` already validated, so it is an object.
 * @returns The chosen {@link MapType}, `undefined` when none was sent, or the
 * 400 `Response` for a value outside {@link MAP_TYPE_OPTIONS}.
 *
 * @example
 * validateMapType({ prompt: 'mapa', mapType: 'dotDensity' }); // 'dotDensity'
 */
export const validateMapType = (
  rawBody: object
): MapType | undefined | Response => {
  const rawMapType = 'mapType' in rawBody ? rawBody.mapType : undefined;
  if (rawMapType === undefined) {
    return undefined;
  }
  if (!isMapType(rawMapType)) {
    const available = MAP_TYPE_OPTIONS.map((option) => {
      return option.value;
    }).join(', ');
    return errorResponse({
      status: 400,
      message: `Campo "mapType": escolha um de ${available}.`,
    });
  }
  return rawMapType;
};
