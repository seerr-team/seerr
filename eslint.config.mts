import js from '@eslint/js';
import nextPlugin from '@next/eslint-plugin-next';
import prettier from 'eslint-config-prettier';
import formatjs from 'eslint-plugin-formatjs';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import noRelativeImportPaths from 'eslint-plugin-no-relative-import-paths';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig, type Config } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

type Plugin = NonNullable<Config['plugins']>[string];

export default defineConfig(
  // Global ignores
  {
    ignores: ['node_modules/**', '.next/**'],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  jsxA11y.flatConfigs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2015,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.jest,
      },
    },
    settings: {
      react: {
        pragma: 'React',
        version: '18.3',
      },
    },
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooks as Plugin,
      formatjs,
      'no-relative-import-paths': noRelativeImportPaths,
      '@next/next': nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,

      // TypeScript
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-use-before-define': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/array-type': ['error', { default: 'array' }],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports' },
      ],

      // React
      'react/prop-types': 'off',
      'react/self-closing-comp': 'error',

      // jsx-a11y
      'jsx-a11y/no-noninteractive-tabindex': 'off',
      'jsx-a11y/anchor-is-valid': 'off',
      'jsx-a11y/no-onchange': 'off',

      // React Hooks
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // General
      'arrow-parens': 'off',
      'no-console': 'warn',
      'no-unused-vars': 'off',

      // Plugins
      'formatjs/no-offset': 'error',
      'no-relative-import-paths/no-relative-import-paths': [
        'error',
        { allowSameFolder: true },
      ],
    },
  },
  prettier,
  {
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
  }
);
