import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react';

const config = defineConfig({
  theme: {
    tokens: {
      colors: {
        brand: {
          50: { value: '#f0f9f0' },
          100: { value: '#d7edda' },
          200: { value: '#b0dbb5' },
          300: { value: '#80c589' },
          400: { value: '#54ae5e' },
          500: { value: '#3a9648' },
          600: { value: '#2d7a3a' },
          700: { value: '#225e2c' },
          800: { value: '#17441f' },
          900: { value: '#0d2a12' },
        },
      },
      sizes: {
        content: {
          max: { value: '1280px' },
        },
        header: {
          height: { value: '4rem' },
        },
        footer: {
          height: { value: '3.5rem' },
        },
      },
    },
    semanticTokens: {
      colors: {
        brand: {
          solid: { value: '{colors.brand.700}' },
          subtle: { value: '{colors.brand.50}' },
          contrast: { value: 'white' },
        },
        surface: {
          page: { value: 'white' },
          header: { value: 'white' },
          footer: { value: '{colors.gray.100}' },
        },
      },
    },
  },
});

export const system = createSystem(defaultConfig, config);
