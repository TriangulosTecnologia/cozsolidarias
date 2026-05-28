import ttossEslintConfig from '@ttoss/eslint-config';

export default [
  ...ttossEslintConfig,
  {
    ignores: ['**/src/generated/**', '.commitlintrc.js', '.lintstagedrc.js'],
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
