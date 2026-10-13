import * as React from 'react';

import type {
  CadinsanByCity,
  KitchenEnabledShare2025,
} from '@/data-gateway/schema';

/**
 * Bridges runtime control visibility (inside the map slot) to the app's year
 * and lazy dataset state. Null is a missing-provider error, not an off layer.
 * @example <EnabledShareContext.Provider value={state}>...</EnabledShareContext.Provider>
 */
export const EnabledShareContext = React.createContext<{
  active: boolean;
  municipalActive?: boolean;
  setMunicipalActive?: (active: boolean) => void;
  summary?: boolean;
  setSummary?: (value: boolean) => void;
  cadinsan?: CadinsanByCity[];
  scenario?: 'com' | 'sem';
  setActive: (active: boolean) => void;
  snapshot: KitchenEnabledShare2025 | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
} | null>(null);
