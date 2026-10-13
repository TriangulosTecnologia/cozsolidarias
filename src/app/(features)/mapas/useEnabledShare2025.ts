import * as React from 'react';

import type { KitchenEnabledShare2025 } from '@/data-gateway/schema';

/**
 * Loads the fixed-2025 aggregate on first activation, caches it for this mount
 * and surfaces failures without inventing zeros. Turning off cancels updates.
 * @param active - Whether the layer control is on.
 * @returns Snapshot, error/loading state and an explicit retry callback.
 * @example const share = useEnabledShare2025(active);
 */
export const useEnabledShare2025 = (active: boolean) => {
  const [snapshot, setSnapshot] =
    React.useState<KitchenEnabledShare2025 | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const [attempt, retry] = React.useReducer((value: number) => {
    return value + 1;
  }, 0);
  React.useEffect(() => {
    if (!active || snapshot) return;
    const controller = new AbortController();

    const load = async () => {
      await Promise.resolve();
      if (controller.signal.aborted) return;
      setError(null);
      const response = await fetch('/api/cozinhas/habilitadas-participacao', {
        signal: controller.signal,
      });
      if (!response.ok)
        throw new Error('Não foi possível carregar a camada de 2025.');
      const data: KitchenEnabledShare2025 = await response.json();
      if (!controller.signal.aborted) setSnapshot(data);
    };
    void load().catch(() => {
      if (!controller.signal.aborted)
        setError('Não foi possível carregar a camada de 2025.');
    });
    return () => {
      return controller.abort();
    };
  }, [active, snapshot, attempt]);
  return { snapshot, error, loading: active && !snapshot && !error, retry };
};
