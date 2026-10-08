const js = require('@eslint/js');
const globals = require('globals');
const tseslint = require('typescript-eslint');
const prettierConfig = require('eslint-config-prettier');

module.exports = tseslint.config(
  {
    ignores: ['**/dist/**', '**/coverage/**', '**/node_modules/**', '**/.expo/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      // AGENTS.md: no `any` unless there is a comment saying why.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
    },
  },
  {
    // routing-core stays pure: no React Native, Node, Expo or I/O imports.
    files: ['packages/routing-core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['node:*', 'react-native', 'react-native/*', 'expo', 'expo-*', 'react'],
              message:
                'packages/routing-core must stay pure: no React Native, Node, Expo or I/O imports.',
            },
          ],
          paths: ['fs', 'path', 'os', 'crypto', 'http', 'https', 'child_process'].map((name) => ({
            name,
            message: 'packages/routing-core must stay pure: no Node built-ins.',
          })),
        },
      ],
    },
  },
  {
    // Config and tooling scripts run on Node, outside the TypeScript build.
    files: ['**/*.js', '**/*.cjs', '**/*.mjs'],
    languageOptions: { globals: globals.node },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    files: ['**/*.js', '**/*.cjs'],
    languageOptions: { sourceType: 'commonjs' },
  },
  prettierConfig,
);
