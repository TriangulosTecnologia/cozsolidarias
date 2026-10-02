import ttossEslintConfig from '@ttoss/eslint-config';

export default [
  ...ttossEslintConfig,
  {
    files: ['scripts/**/*.{js,mjs,cjs}'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
    },
  },
  {
    ignores: [
      '**/src/generated/**',
      '.commitlintrc.js',
      '.lintstagedrc.js',
      '**/coverage/**',
      '.next/**',
      'next-env.d.ts',
      'dist/**',
      'build/**',
      'out/**',
      'public/**',
      '**/*.example.ts',
    ],
  },
  {
    rules: {
      'formatjs/no-literal-string-in-jsx': 'off',
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
  // Ratchets over the base limits (complexity 10, max-lines 400): thresholds
  // calibrated on src/, legacy outliers frozen in eslint-suppressions.json.
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      complexity: ['error', { max: 6 }],
      'max-lines': [
        'error',
        { max: 249, skipBlankLines: true, skipComments: true },
      ],
      '@typescript-eslint/naming-convention': [
        'error',
        { selector: 'typeLike', format: ['PascalCase'] },
      ],
    },
  },
  // Layer boundaries: src/app → src/data-gateway → src/data-source-*.
  {
    files: ['src/app/**', 'src/components/**', 'src/config/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/data-source-*', '**/data-source-*'],
              message: 'The app reads data only through src/data-gateway.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/data-gateway/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@/app/*',
                '@/components/*',
                '@/config/*',
                '**/app/*',
                '**/components/*',
                '**/config/*',
              ],
              message: 'data-gateway never imports from the app layer.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/data-source-*/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@/app/*',
                '@/components/*',
                '@/config/*',
                '@/data-gateway*',
                '**/app/*',
                '**/components/*',
                '**/config/*',
                '**/data-gateway*',
              ],
              message:
                'A data source never imports from the app or data-gateway.',
            },
          ],
        },
      ],
    },
  },
];
