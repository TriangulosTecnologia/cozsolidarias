import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ['@chakra-ui/react'],
  },
  // `/dados` reads the data catalogue from `public/` with `fs` at request time.
  // The path is built at runtime, so Next.js cannot trace it — pin the file into
  // the route's bundle or the read fails once deployed.
  outputFileTracingIncludes: {
    '/dados': ['./public/dataset_catalogue.json'],
  },
};

export default nextConfig;
