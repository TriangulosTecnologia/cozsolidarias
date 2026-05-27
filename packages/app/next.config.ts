import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: [
    '@cozsolidarias/data-gateway',
    '@cozsolidarias/data-source-static',
  ],
};

export default nextConfig;
