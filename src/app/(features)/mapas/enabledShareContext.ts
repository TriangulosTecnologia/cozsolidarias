import * as React from 'react';

import type { KitchenEnabledShare2025 } from '@/data-gateway/schema';

/**
 * Bridges runtime control visibility (inside the map slot) to the app's year
 * and lazy dataset state. Null is a missing-provider error, not an off layer.
 * @example <EnabledShareContext.Provider value={state}>...</EnabledShareContext.Provider>
 */
export const EnabledShareContext = React.createContext<{
  active: boolean;
  setActive: (active: boolean) => void;
  snapshot: KitchenEnabledShare2025 | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
} | null>(null);
