const js = require('@eslint/js');
const pluginN = require('eslint-plugin-n');
const pluginImport = require('eslint-plugin-import');
const eslintConfigPrettier = require('eslint-config-prettier/flat');
const pluginPrettier = require('eslint-plugin-prettier');

module.exports = [
  // Base recommended config
  js.configs.recommended,

  // Node.js specific rules
  {
    name: 'node-config',
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        console: 'readonly',
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        module: 'writable',
        require: 'readonly',
        exports: 'writable',
        Buffer: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
      },
    },
    plugins: {
      n: pluginN,
      import: pluginImport,
      prettier: pluginPrettier,
    },
    rules: {
      // Best practices
      'no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      'no-console': 'off',
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'always'],

      // Node.js rules
      'n/no-missing-import': 'off',
      'n/no-missing-require': 'off',
      'n/no-unpublished-import': 'off',
      'n/no-unpublished-require': 'off',

      // Import rules
      'import/no-unresolved': 'off',
      'import/order': [
        'warn',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'ignore',
        },
      ],

      // Prettier integration
      'prettier/prettier': 'warn',
    },
  },

  // Ignore patterns
  {
    ignores: ['node_modules/**', 'dist/**', 'build/**', 'prisma/migrations/**'],
  },

  // Prettier config last to override conflicting rules
  eslintConfigPrettier,
];
