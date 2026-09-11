'use client';

import dynamic from 'next/dynamic';

/**
 * Client-only boundary for `MapaPlayground`: it transitively imports
 * `@ttoss/geovis` (via `@ttoss/geovis-workspace`), which `next.config.ts`
 * marks `serverExternalPackages` so `/api/ai/spec` can `require()` it under
 * plain Node resolution. That externalization also applies to this page's
 * SSR/prerender pass, where webpack resolves the package under the
 * `react-server` condition and nulls out client hooks (`useState`), crashing
 * prerendering. `ssr: false` skips that pass entirely — `next/dynamic` only
 * allows the option from a Client Component, hence this thin wrapper.
 */
const MapaPlaygroundClient = dynamic(
  () => {
    return import('./MapaPlayground');
  },
  {
    ssr: false,
  }
);

export default MapaPlaygroundClient;
