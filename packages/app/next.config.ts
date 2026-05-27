import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: [
    '@cozsolidarias/data-gateway',
    '@cozsolidarias/data-source-static',
    '@ttoss/react-i18n',
    'react-intl',
    '@formatjs/intl',
    '@formatjs/icu-messageformat-parser',
    'intl-messageformat',
  ],
};

export default nextConfig;
