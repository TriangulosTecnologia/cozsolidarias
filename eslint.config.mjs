import ttossEslintConfig from '@ttoss/eslint-config';

export default [
  {
    ignores: [
      '**/src/generated/**',
      '.commitlintrc.js',
      '.lintstagedrc.js',
      '.syncpackrc.js',
    ],
  },
  ...ttossEslintConfig,
  {
    rules: {
      'turbo/no-undeclared-env-vars': 'off',
    },
  },
  {
    files: ['packages/app/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@cozsolidarias/data-source-*'],
              message:
                'The app must consume data only through @cozsolidarias/data-gateway. Source packages are an implementation detail of the gateway.',
            },
          ],
        },
      ],
      'react-refresh/only-export-components': [
        'warn',
        {
          allowExportNames: [
            'metadata',
            'generateMetadata',
            'viewport',
            'generateViewport',
            'dynamic',
            'dynamicParams',
            'revalidate',
            'fetchCache',
            'runtime',
            'preferredRegion',
            'maxDuration',
            'generateStaticParams',
          ],
        },
      ],
    },
  },
];
