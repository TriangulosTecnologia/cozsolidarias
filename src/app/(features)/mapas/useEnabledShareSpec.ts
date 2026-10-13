import type { VisualizationSpec } from '@ttoss/geovis';
import * as React from 'react';

import type { CadinsanByCity } from '@/data-gateway/schema';

import { withEnabledShare } from './geovisEnabledShare';
import { withMunicipalCoverage } from './geovisMunicipalCoverage';
import type { useEnabledShareLayer } from './useEnabledShareLayer';

/**
 * Memoizes the independent overlay after the existing map spec and boundaries.
 * @param params - Base map and the fixed-2025 layer state.
 * @returns A stable spec until data, visibility or the base changes.
 * @example useEnabledShareSpec(spec, enabledShareState);
 */
const EMPTY_CADINSAN: CadinsanByCity[] = [];

export const useEnabledShareSpec = (
  spec: VisualizationSpec,
  state: ReturnType<typeof useEnabledShareLayer>['enabledShareState'] & {
    cadinsan?: CadinsanByCity[];
    scenario?: 'com' | 'sem';
  }
) => {
  const cadinsan = state.cadinsan ?? EMPTY_CADINSAN;
  const scenario = state.scenario ?? 'com';
  return React.useMemo(() => {
    const national = withEnabledShare({
      spec,
      snapshot: state.snapshot,
      active: state.active,
    });
    return withMunicipalCoverage({
      spec: national,
      snapshot: state.snapshot,
      active: state.municipalActive,
      summary: state.summary,
      risks: cadinsan,
      scenario,
    });
  }, [
    spec,
    state.snapshot,
    state.active,
    state.municipalActive,
    state.summary,
    cadinsan,
    scenario,
  ]);
};
