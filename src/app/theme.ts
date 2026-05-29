import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react';

import { EXPO_OUT } from '../config/site';

const config = defineConfig({
  globalCss: {
    html: {
      scrollBehavior: 'smooth',
    },
    body: {
      bg: '{colors.ivory.100}',
      color: '{colors.charcoal.900}',
      fontFamily: 'var(--font-inter), ui-sans-serif, system-ui, sans-serif',
      textRendering: 'optimizeLegibility',
    },
    'h1, h2, h3, h4, h5, h6': {
      fontFamily:
        'var(--font-inter-tight), var(--font-inter), ui-sans-serif, system-ui, sans-serif',
    },
    /* Branded text selection */
    '::selection': {
      bg: '{colors.verde.200}',
      color: '{colors.charcoal.900}',
    },
    /* Branded focus ring — visible keyboard navigation */
    ':focus-visible': {
      outline: '2px solid {colors.verde.600}',
      outlineOffset: '3px',
      borderRadius: '4px',
    },
    /* Webkit scrollbar — ivory palette, not browser default gray */
    '::-webkit-scrollbar': {
      width: '6px',
    },
    '::-webkit-scrollbar-track': {
      bg: '{colors.ivory.200}',
    },
    '::-webkit-scrollbar-thumb': {
      bg: '{colors.ivory.500}',
      borderRadius: '3px',
    },
    '::-webkit-scrollbar-thumb:hover': {
      bg: '{colors.charcoal.500}',
    },
    /* Respect reduced-motion — handled via <style> tag in layout.tsx */
  },
  theme: {
    tokens: {
      fonts: {
        body: {
          value:
            'var(--font-inter), ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
        },
        heading: {
          value:
            'var(--font-inter-tight), var(--font-inter), ui-sans-serif, system-ui, sans-serif',
        },
      },
      radii: {
        pill: { value: '9999px' },
        card: { value: '16px' },
      },
      colors: {
        /** Warm ivory surface scale — never cold white. Page bg: ivory.100 */
        ivory: {
          50: { value: '#FAF9F7' },
          100: { value: '#F4F0E8' },
          200: { value: '#EBE7DF' },
          300: { value: '#E4DED3' },
          400: { value: '#D8D1C5' },
          500: { value: '#C3BCBB' },
        },
        /** Warm charcoal text scale — never pure black. Primary text: charcoal.900 */
        charcoal: {
          500: { value: '#7A716D' },
          700: { value: '#524945' },
          900: { value: '#241F21' },
        },
        /** Verde oficial do Programa Cozinha Solidária: #337C59 */
        verde: {
          50: { value: '#EDF7F2' },
          100: { value: '#CCE9D9' },
          200: { value: '#9DD3B4' },
          300: { value: '#69BD8F' },
          400: { value: '#45A870' },
          500: { value: '#3A9160' },
          600: { value: '#337C59' },
          700: { value: '#266044' },
          800: { value: '#1A4430' },
          900: { value: '#0F2A1D' },
          950: { value: '#08150E' },
        },
        /** Coral oficial do Programa Cozinha Solidária: #E45946 */
        coral: {
          50: { value: '#FEF2F1' },
          100: { value: '#FCD9D5' },
          200: { value: '#F9B3AC' },
          300: { value: '#F48D82' },
          400: { value: '#ED6D5F' },
          500: { value: '#E45946' },
          600: { value: '#C94030' },
          700: { value: '#A23228' },
          800: { value: '#71231C' },
          900: { value: '#461610' },
          950: { value: '#290D09' },
        },
        /** Roxo oficial do Programa Cozinha Solidária: #69448C */
        roxo: {
          50: { value: '#F4F0F9' },
          100: { value: '#E3D9EF' },
          200: { value: '#C5B3DF' },
          300: { value: '#A48DCF' },
          400: { value: '#8469BE' },
          500: { value: '#7659A8' },
          600: { value: '#69448C' },
          700: { value: '#52357A' },
          800: { value: '#3B2558' },
          900: { value: '#251638' },
          950: { value: '#160D22' },
        },
        /** Laranja oficial do Programa Cozinha Solidária: #FF9D00 */
        laranja: {
          50: { value: '#FFF8E6' },
          100: { value: '#FFEFC2' },
          200: { value: '#FFE099' },
          300: { value: '#FFD070' },
          400: { value: '#FFBC3D' },
          500: { value: '#FF9D00' },
          600: { value: '#E68900' },
          700: { value: '#B86E00' },
          800: { value: '#8A5100' },
          900: { value: '#5C3600' },
          950: { value: '#3D2400' },
        },
        /** Accent: mist green — validated state backgrounds */
        mistGreen: { value: '#DCE8DD' },
      },
      sizes: {
        content: {
          max: { value: '1440px' },
        },
        header: {
          height: { value: '4.5rem' },
        },
      },
      durations: {
        fast: { value: '0.2s' },
        default: { value: '0.4s' },
        slow: { value: '0.6s' },
        enter: { value: '0.5s' },
      },
      easings: {
        expoOut: { value: EXPO_OUT },
      },
      shadows: {
        card: { value: '0 1px 3px rgba(36, 31, 33, 0.06)' },
      },
    },
    keyframes: {
      /** Fade in with upward slide — used for section and hero entrances. */
      fadeSlideUp: {
        from: { opacity: '0', transform: 'translateY(16px)' },
        to: { opacity: '1', transform: 'translateY(0)' },
      },
      /** Opacity-only fade — used for image block entrance. */
      fadeIn: {
        from: { opacity: '0' },
        to: { opacity: '1' },
      },
    },
    textStyles: {
      display: {
        value: {
          fontSize: 'clamp(3.5rem, calc(2.875rem + 2.6vw), 6rem)',
          letterSpacing: '-0.04em',
          lineHeight: '1em',
          fontWeight: '700',
        },
      },
      'title-1': {
        value: {
          fontSize: 'clamp(2.25rem, calc(1.6875rem + 2.3vw), 4rem)',
          letterSpacing: '-0.04em',
          lineHeight: '1.05em',
          fontWeight: '700',
        },
      },
      'title-2': {
        value: {
          fontSize: 'clamp(1.875rem, calc(1.4375rem + 1.8vw), 3.25rem)',
          letterSpacing: '-0.04em',
          lineHeight: '1.1em',
          fontWeight: '700',
        },
      },
      'title-3': {
        value: {
          fontSize: 'clamp(1.5rem, calc(1.25rem + 1vw), 2.25rem)',
          letterSpacing: '-0.04em',
          lineHeight: '1.15em',
          fontWeight: '600',
        },
      },
      'title-4': {
        value: {
          fontSize: 'clamp(1.25rem, calc(1.125rem + 0.5vw), 1.75rem)',
          letterSpacing: '-0.03em',
          lineHeight: '1.2em',
          fontWeight: '600',
        },
      },
      'body-lg': {
        value: {
          fontSize: 'clamp(1rem, calc(0.9375rem + 0.2vw), 1.125rem)',
          letterSpacing: '-0.02em',
          lineHeight: '1.5em',
        },
      },
      body: {
        value: {
          fontSize: 'clamp(0.9375rem, calc(0.875rem + 0.15vw), 1rem)',
          letterSpacing: '-0.015em',
          lineHeight: '1.55em',
        },
      },
      'body-sm': {
        value: {
          fontSize: '0.875rem',
          letterSpacing: '-0.01em',
          lineHeight: '1.45em',
        },
      },
      caption: {
        value: {
          fontSize: '0.75rem',
          letterSpacing: '0em',
          lineHeight: '1.4em',
        },
      },
      eyebrow: {
        value: {
          fontSize: '0.75rem',
          letterSpacing: '0.08em',
          lineHeight: '1.4em',
          textTransform: 'uppercase',
          fontWeight: '500',
        },
      },
    },
    semanticTokens: {
      colors: {
        /** Primary brand: verde — navigation, positive states, structural elements. */
        brand: {
          solid: { value: '{colors.verde.600}' },
          subtle: { value: '{colors.verde.50}' },
          contrast: { value: '{colors.ivory.50}' },
          fg: { value: '{colors.verde.700}' },
        },
        /** Accent: roxo — institutional highlights, method, depth. */
        accent: {
          solid: { value: '{colors.roxo.600}' },
          subtle: { value: '{colors.roxo.50}' },
          contrast: { value: '{colors.ivory.50}' },
          fg: { value: '{colors.roxo.700}' },
        },
        /** Action: coral — alerts, secondary CTAs, footer. */
        action: {
          solid: { value: '{colors.coral.500}' },
          subtle: { value: '{colors.coral.50}' },
          contrast: { value: '{colors.ivory.50}' },
          fg: { value: '{colors.coral.600}' },
        },
        /** Highlight: laranja — action callouts, CTA on dark. */
        highlight: {
          solid: { value: '{colors.laranja.500}' },
          subtle: { value: '{colors.laranja.50}' },
          contrast: { value: '{colors.charcoal.900}' },
          fg: { value: '{colors.laranja.700}' },
        },
        surface: {
          page: { value: '{colors.ivory.100}' },
          card: { value: '{colors.ivory.50}' },
          header: { value: '{colors.ivory.100}' },
          contrast: { value: '{colors.verde.900}' },
          footer: { value: '{colors.coral.500}' },
        },
        text: {
          primary: { value: '{colors.charcoal.900}' },
          secondary: { value: '{colors.charcoal.500}' },
          onContrast: { value: '{colors.ivory.100}' },
          onFooter: { value: '{colors.charcoal.900}' },
        },
      },
    },
  },
});

export const system = createSystem(defaultConfig, config);
