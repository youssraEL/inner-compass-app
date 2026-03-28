const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  ...expoConfig,
  {
    rules: {
      // Downgrade unused-vars to warning (common in active RN dev)
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      // Allow console in RN (Metro strips in production)
      'no-console': 'off',
    },
  },
  {
    // Ignore generated / config files
    ignores: [
      'node_modules/**',
      '.expo/**',
      'dist/**',
      'babel.config.js',
      'metro.config.js',
    ],
  },
]);
