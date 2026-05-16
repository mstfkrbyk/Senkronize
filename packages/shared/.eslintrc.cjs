module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint/eslint-plugin'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  env: { node: true },
  ignorePatterns: ['dist'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
  },
};
