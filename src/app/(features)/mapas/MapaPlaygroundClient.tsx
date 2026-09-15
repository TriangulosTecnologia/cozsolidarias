'use client';

import dynamic from 'next/dynamic';

import MapLoadingIndicator from './MapLoadingIndicator';

/**
 * Client-only boundary for `MapaPlayground`: it transitively imports
 * `@ttoss/geovis` (via `@ttoss/geovis-workspace`), which `next.config.ts`
 * marks `serverExternalPackages` so `/api/ai/spec` can `require()` it under
 * plain Node resolution. That externalization also applies to this page's
 * SSR/prerender pass, where webpack resolves the package under the
 * `react-server` condition and nulls out client hooks (`useState`), crashing
 * prerendering. `ssr: false` skips that pass entirely — `next/dynamic` only
 * allows the option from a Client Component, hence this thin wrapper.
 *
 * `loading` covers the window between hydration and the chunk arriving, which
 * would otherwise paint the empty box `page.tsx` reserves. It is the same
 * indicator `MapaPlayground` shows while its datasets load, so the handover
 * between the two is invisible. It stays out of the dynamic chunk on purpose:
 * a fallback imported lazily could not render before the import it waits on.
 */
const MapaPlaygroundClient = dynamic(
  () => {
    return import('./MapaPlayground');
  },
  {
    ssr: false,
    loading: () => {
      return <MapLoadingIndicator />;
    },
  }
);

export default MapaPlaygroundClient;
