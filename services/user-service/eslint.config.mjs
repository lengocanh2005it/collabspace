// @ts-check
import { createTypeCheckedEslintConfig } from '@collabspace/eslint-config';

export default createTypeCheckedEslintConfig({
  tsconfigRootDir: import.meta.dirname,
  specRules: {},
  rules: {
    '@typescript-eslint/no-unsafe-member-access': 'warn',
    '@typescript-eslint/no-unsafe-assignment': 'warn',
    '@typescript-eslint/no-unsafe-return': 'warn',
    '@typescript-eslint/no-unsafe-call': 'warn',
    '@typescript-eslint/unbound-method': 'off',
    '@typescript-eslint/require-await': 'off',
    '@typescript-eslint/no-base-to-string': 'off',
    '@typescript-eslint/prefer-as-const': 'warn',
    '@typescript-eslint/no-require-imports': 'off',
  },
});
