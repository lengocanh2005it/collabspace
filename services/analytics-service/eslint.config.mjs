// @ts-check
import { createTypeCheckedEslintConfig } from '@collabspace/eslint-config';

export default createTypeCheckedEslintConfig({
  tsconfigRootDir: import.meta.dirname,
  parserOptions: {
    project: ['./tsconfig.eslint.json'],
    tsconfigRootDir: import.meta.dirname,
  },
  specRules: {},
  rules: {
    '@typescript-eslint/unbound-method': 'off',
    '@typescript-eslint/require-await': 'off',
    '@typescript-eslint/no-base-to-string': 'off',
    '@typescript-eslint/no-require-imports': 'off',
  },
});
