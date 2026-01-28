module.exports = {
  plugins: ['prettier-plugin-organize-imports', 'prettier-plugin-tailwindcss'],
  singleQuote: true,
  trailingComma: 'es5',
  overrides: [
    {
      files: 'pnpm-lock.yaml',
      options: {
        rangeEnd: 0, // default: Infinity
      },
    },
    {
      files: 'gen-docs/pnpm-lock.yaml',
      options: {
        rangeEnd: 0, // default: Infinity
      },
    },
    {
      files: 'charts/**',
      options: {
        rangeEnd: 0, // default: Infinity
      },
    },
    {
      files: 'cypress/config/settings.cypress.json',
      options: {
        rangeEnd: 0,
      },
    },
    {
      files: 'public/offline.html',
      options: {
        rangeEnd: 0,
      },
    },
  ],
};
