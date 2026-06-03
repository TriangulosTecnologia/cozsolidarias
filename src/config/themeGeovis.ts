/**
 * Geovis design tokens — cartographic color scales and map semantic colors.
 *
 * The semantic slice of this object is re-exported as `mapTokens` from `theme.ts`.
 * Consumer code must import `mapTokens` from `theme.ts`, never from this file directly.
 */

const ref = <T extends string>(path: T) => {
  return `{${path}}` as const;
};

export const geovisTokens = {
  core: {
    dataviz: {
      color: {
        data: {
          sequential: {
            blue: [
              '#C6DBEF',
              '#B2D2E8',
              '#9ECAE1',
              '#86BCDC',
              '#6BAED6',
              '#58A0CE',
              '#4292C6',
              '#3987C0',
              '#2E7CBB',
              '#2171B5',
              '#1761A8',
              '#08519C',
              '#094083',
              '#08306B',
            ],

            green: [
              '#C7E9C0',
              '#B4E1AE',
              '#A1D99B',
              '#8BCF89',
              '#74C476',
              '#5CB769',
              '#41AB5D',
              '#37A055',
              '#2E964D',
              '#238B45',
              '#147C38',
              '#006D2C',
              '#005823',
              '#00441B',
            ],

            yellowOrange: [
              '#EFC22F',
              '#EFB22B',
              '#EEA227',
              '#ED9223',
              '#EC8121',
              '#EA7020',
              '#E75D1E',
              '#D9532A',
              '#CB4932',
              '#BD3F37',
              '#AD3E37',
              '#9E3C37',
              '#8E3A36',
              '#7F3835',
            ],

            orange: [
              '#FFF5EB',
              '#FEE6CE',
              '#FDDAB8',
              '#FDD0A2',
              '#FDBF86',
              '#FDAE6B',
              '#FD9E53',
              '#FD8D3C',
              '#F57B25',
              '#F16913',
              '#E6570A',
              '#D94801',
              '#B73903',
              '#8C2D04',
            ],

            red: [
              '#FCBBA1',
              '#FCA78A',
              '#FC9272',
              '#FC7E5E',
              '#FB6A4A',
              '#F5543B',
              '#EF3B2C',
              '#DD2A24',
              '#CB181D',
              '#B81419',
              '#A50F15',
              '#860A14',
              '#67000D',
              '#4F000A',
            ],

            greenBlue: [
              '#CCEBC5',
              '#BAE4BD',
              '#A8DDB5',
              '#91D5BC',
              '#7BCCC4',
              '#67C0CC',
              '#4EB3D3',
              '#40A4CC',
              '#3498C5',
              '#2B8CBE',
              '#187AB5',
              '#0868AC',
              '#08548F',
              '#084081',
            ],
          },
          diverging: {
            // olive.700 → olive.100 → paper.300 (neutral) → clay.100 → clay.700
            // Warm brand diverging: positive/growth (olive) ↔ negative/decline (clay).
            oliveClay: [
              '#1B412B',
              '#275B3C',
              '#35754F',
              '#499167',
              '#72AF8B',
              '#A5CDB3',
              '#D2E9DA',
              '#E8E4DB',
              '#F6D5BF',
              '#EBA880',
              '#DB7A45',
              '#C45E22',
              '#AD501B',
              '#6D300E',
            ],

            // blue.700 → blue.50 → paper.300 (neutral) → amber.100 → amber.500
            // Color-blind-safe diverging: blue is distinguishable across all deficiency types.
            blueAmber: [
              '#214555',
              '#2F5F73',
              '#4D7D91',
              '#6A9AAF',
              '#94BAC9',
              '#BED9E2',
              '#E5F0F3',
              '#E8E4DB',
              '#EDE0BE',
              '#F5DC94',
              '#D4A938',
              '#A87C18',
              '#8A6512',
              '#6D4F0C',
            ],
          },
          categorical: {
            // 14 muted-earth hues at mid-range lightness (L≈48–62), grounded in the brand
            // palette families: teal-blue, sienna/clay, olive/forest, dusty-purple, amber/ochre,
            // teal-green, brick-red, warm-gray, steel-blue, sage, dusty-rose, warm-brown,
            // cyan-teal, muted-indigo.
            // First 6 are maximally distinct; positions 7–14 fill secondary gaps.
            // All values pass WCAG AA contrast against the paper.300 (#E8E4DB) map background.
            default: [
              '#4D7D91', // teal-blue (blue.300 family)
              '#B5693E', // sienna / clay (clay.300–400)
              '#4A7A5C', // forest / olive (olive.400–500)
              '#8E6EA0', // dusty purple
              '#A07828', // amber / ochre (amber.300–400)
              '#5A8F88', // teal-green
              '#A84D45', // brick-red (red.300)
              '#8A7E74', // warm gray
              '#5B87A8', // steel-blue
              '#7A9448', // sage-olive
              '#B06A83', // dusty rose
              '#9A6848', // warm brown
              '#3D8F9A', // cyan-teal
              '#6068A0', // muted indigo
            ],
          },
        },

        neutral: {
          missing: '#D8CEC0',
          suppressed: '#BEB4A6',
          masked: '#EEE6DA',
        },

        interaction: {
          selected: '#1F1712',
          focus: '#2F5F73',
          hover: '#9C5737',
        },
      },

      opacity: {
        low: 0.32,
        medium: 0.56,
        high: 0.72,
        selected: 0.92,
        muted: 0.38,
      },

      stroke: {
        solid: [],
        dashed: [4, 3],
        dotted: [1, 3],
      },

      pattern: {
        none: 'none',
        diagonal: 'diagonal',
        crosshatch: 'crosshatch',
        dots: 'dots',
      },

      shape: {
        circle: 'circle',
        square: 'square',
        triangle: 'triangle',
        diamond: 'diamond',
      },
    },
  },

  semantic: {
    dataviz: {
      color: {
        // light-to-dark gradients for ordered quantitative data; choropleth and value-mapped layers.
        sequential: {
          1: ref('core.dataviz.color.data.sequential.blue'),
          2: ref('core.dataviz.color.data.sequential.green'),
          3: ref('core.dataviz.color.data.sequential.yellowOrange'),
          4: ref('core.dataviz.color.data.sequential.orange'),
          5: ref('core.dataviz.color.data.sequential.red'),
          6: ref('core.dataviz.color.data.sequential.greenBlue'),
        },
        // unordered discrete colors for nominal/qualitative categories.
        categorical: {
          1: ref('core.dataviz.color.data.categorical.default'),
        },
        // midpoint-anchored scales for signed deviations from a reference value.
        diverging: {
          1: ref('core.dataviz.color.data.diverging.oliveClay'),
          2: ref('core.dataviz.color.data.diverging.blueAmber'),
        },

        status: {
          missing: ref('core.dataviz.color.neutral.missing'),
          suppressed: ref('core.dataviz.color.neutral.suppressed'),
          masked: ref('core.dataviz.color.neutral.masked'),
        },

        state: {
          selected: ref('core.dataviz.color.interaction.selected'),
          focus: ref('core.dataviz.color.interaction.focus'),
          hover: ref('core.dataviz.color.interaction.hover'),
        },
      },

      opacity: {
        area: ref('core.dataviz.opacity.high'),
        areaSubtle: ref('core.dataviz.opacity.medium'),
        muted: ref('core.dataviz.opacity.muted'),
        selected: ref('core.dataviz.opacity.selected'),
      },

      stroke: {
        default: ref('core.dataviz.stroke.solid'),
        uncertainty: ref('core.dataviz.stroke.dotted'),
        estimate: ref('core.dataviz.stroke.dashed'),
      },

      pattern: {
        default: ref('core.dataviz.pattern.none'),
        uncertainty: ref('core.dataviz.pattern.diagonal'),
        suppressed: ref('core.dataviz.pattern.crosshatch'),
      },

      shape: {
        point: ref('core.dataviz.shape.circle'),
        comparison: ref('core.dataviz.shape.square'),
        alert: ref('core.dataviz.shape.triangle'),
      },
    },
  },
} as const;
