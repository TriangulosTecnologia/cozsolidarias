import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ['@chakra-ui/react'],
  },
  // `@ttoss/geovis` bundles its Chakra UI theme wiring into the same entry
  // point as `validateSpec`. Under the RSC webpack layer that pulls in
  // `@ark-ui/react`'s React Server Components condition, which is
  // incompatible with the Chakra anatomy it's paired with (`accordionAnatomy
  // .extendWith is not a function`). Marking the package external forces
  // Next.js to `require()` it with plain Node resolution instead, which
  // sidesteps the broken condition — Route Handlers importing `validateSpec`
  // (e.g. `/api/ai/spec`) need this to not crash at import time.
  serverExternalPackages: ['@ttoss/geovis'],
  // `/dados` reads the data catalogue from `public/` with `fs` at request time.
  // The path is built at runtime, so Next.js cannot trace it — pin the file into
  // the route's bundle or the read fails once deployed.
  outputFileTracingIncludes: {
    '/dados': ['./public/dataset_catalogue.json'],
  },
};

export default nextConfig;
