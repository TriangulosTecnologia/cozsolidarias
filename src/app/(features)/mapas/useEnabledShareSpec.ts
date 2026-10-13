import type { VisualizationSpec } from '@ttoss/geovis';
import * as React from 'react';

import { withEnabledShare } from './geovisEnabledShare';
import type { useEnabledShareLayer } from './useEnabledShareLayer';

/**
 * Memoizes the independent overlay after the existing map spec and boundaries.
 * @param params - Base map and the fixed-2025 layer state.
 * @returns A stable spec until data, visibility or the base changes.
 * @example useEnabledShareSpec({ spec, state: enabledShareState });
 */
export const useEnabledShareSpec = ({
  spec,
  state,
}: {
  spec: VisualizationSpec;
  state: ReturnType<typeof useEnabledShareLayer>['enabledShareState'];
}) => {
  return React.useMemo(() => {
    return withEnabledShare({
      spec,
      snapshot: state.snapshot,
      active: state.active,
    });
  }, [spec, state.snapshot, state.active]);
};
