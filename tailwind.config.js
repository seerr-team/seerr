/* eslint-disable @typescript-eslint/no-require-imports */
const defaultTheme = require('tailwindcss/defaultTheme');

const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

const cssVarPalette = (name) =>
  Object.fromEntries(
    shades.map((shade) => [
      shade,
      `rgb(var(--color-${name}-${shade}) / <alpha-value>)`,
    ])
  );

/** @type {import('tailwindcss').Config} */
module.exports = {
  mode: 'jit',
  content: [
    './node_modules/@seerr-team/react-tailwindcss-datepicker/dist/index.esm.js',
    './src/pages/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        gray: cssVarPalette('gray'),
        indigo: cssVarPalette('indigo'),
        purple: cssVarPalette('purple'),
        red: cssVarPalette('red'),
        yellow: cssVarPalette('yellow'),
        green: cssVarPalette('green'),
        blue: cssVarPalette('blue'),
        bg: 'rgb(var(--color-bg) / <alpha-value>)',
        surface: {
          DEFAULT: 'rgb(var(--color-surface) / <alpha-value>)',
          elevated: 'rgb(var(--color-surface-elevated) / <alpha-value>)',
        },
        border: {
          DEFAULT: 'rgb(var(--color-border) / <alpha-value>)',
          subtle: 'rgb(var(--color-border-subtle) / <alpha-value>)',
        },
        primary: {
          DEFAULT: 'rgb(var(--color-primary) / <alpha-value>)',
          hover: 'rgb(var(--color-primary-hover) / <alpha-value>)',
        },
        accent: 'rgb(var(--color-accent) / <alpha-value>)',
        danger: 'rgb(var(--color-danger) / <alpha-value>)',
        warning: 'rgb(var(--color-warning) / <alpha-value>)',
        success: 'rgb(var(--color-success) / <alpha-value>)',
        foreground: {
          DEFAULT: 'rgb(var(--color-text) / <alpha-value>)',
          muted: 'rgb(var(--color-text-muted) / <alpha-value>)',
        },
      },
      transitionProperty: {
        'max-height': 'max-height',
        width: 'width',
      },
      fontFamily: {
        sans: ['Inter Variable', ...defaultTheme.fontFamily.sans],
      },
      typography: (theme) => ({
        DEFAULT: {
          css: {
            color: theme('colors.gray.300 / 1'),
            a: {
              color: theme('colors.indigo.500 / 1'),
              '&:hover': {
                color: theme('colors.indigo.400 / 1'),
              },
            },

            h1: {
              color: theme('colors.gray.300 / 1'),
            },
            h2: {
              color: theme('colors.gray.300 / 1'),
            },
            h3: {
              color: theme('colors.gray.300 / 1'),
            },
            h4: {
              color: theme('colors.gray.300 / 1'),
            },
            h5: {
              color: theme('colors.gray.300 / 1'),
            },
            h6: {
              color: theme('colors.gray.300 / 1'),
            },

            strong: {
              color: theme('colors.gray.400 / 1'),
            },

            code: {
              color: theme('colors.gray.300 / 1'),
            },

            figcaption: {
              color: theme('colors.gray.500 / 1'),
            },
          },
        },
      }),
    },
    aspectRatio: {
      auto: 'auto',
      square: '1 / 1',
      video: '16 / 9',
      1: '1',
      2: '2',
      3: '3',
      4: '4',
      5: '5',
      6: '6',
      7: '7',
      8: '8',
      9: '9',
      10: '10',
      11: '11',
      12: '12',
      13: '13',
      14: '14',
      15: '15',
      16: '16',
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
    require('@tailwindcss/aspect-ratio'),
  ],
};
