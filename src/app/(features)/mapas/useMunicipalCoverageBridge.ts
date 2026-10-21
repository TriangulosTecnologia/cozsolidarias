import * as React from 'react';

import type { CadinsanByCity } from '@/data-gateway/schema';

import type { MapMode } from './geovisMapMode';
import { useEnabledShareLayer } from './useEnabledShareLayer';
import type { MapaDatasets } from './useMapaDatasets';

/** Keeps the reference dataset available independently of the selected base map. */
export const useMunicipalCoverageBridge = (
  selectedYear: number,
  ensure: MapaDatasets['ensure'],
  cadinsan: CadinsanByCity[],
  mode: MapMode
) => {
  const { year, enabledShareState: state } = useEnabledShareLayer(selectedYear);
  React.useEffect(() => {
    if (state.municipalActive)
      void ensure('coropletico-cadinsan-com-pbf')?.catch(() => {});
  }, [state.municipalActive, ensure]);
  return {
    year,
    state: {
      ...state,
      cadinsan,
      scenario:
        mode === 'coropletico-cadinsan-sem-pbf'
          ? ('sem' as const)
          : ('com' as const),
    },
    active: state.active || state.municipalActive,
  };
};
