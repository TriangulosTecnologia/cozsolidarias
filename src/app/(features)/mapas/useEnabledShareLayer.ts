import * as React from 'react';

import { useEnabledShare2025 } from './useEnabledShare2025';

/**
 * Owns the independent layer's state and pins point/detail year while active.
 * The caller's selection is preserved so turning off restores its prior year.
 * @param selectedYear - Year retained by the timeline selection.
 * @returns Effective year and the map-slot bridge state.
 * @example const { year, enabledShareState } = useEnabledShareLayer(2026);
 */
export const useEnabledShareLayer = (selectedYear: number) => {
  const [active, setActive] = React.useState(false);
  const [municipalActive, setMunicipalActive] = React.useState(false);
  const [summary, setSummary] = React.useState(false);
  const { snapshot, loading, error, retry } = useEnabledShare2025(
    active || municipalActive
  );
  const enabledShareState = React.useMemo(() => {
    return {
      active,
      municipalActive,
      setMunicipalActive,
      summary,
      setSummary,
      setActive,
      snapshot,
      loading,
      error,
      retry,
    };
  }, [active, municipalActive, summary, snapshot, loading, error, retry]);
  return {
    year: active || municipalActive ? 2025 : selectedYear,
    enabledShareState,
  };
};
