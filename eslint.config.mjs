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
      // Throwaway data-generation experiment, kept out of the app's gates.
      'scripts/minha-cozinha-nearby/**',
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
];
