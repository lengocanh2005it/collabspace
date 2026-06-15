import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const DEFAULT_IGNORES = ['dist/**', 'eslint.config.mjs', 'src/generated/**'];

const BASE_RULES = {
  '@typescript-eslint/no-explicit-any': 'off',
  '@typescript-eslint/no-floating-promises': 'warn',
  '@typescript-eslint/no-unsafe-argument': 'warn',
  '@typescript-eslint/restrict-template-expressions': 'off',
};

const DEFAULT_SPEC_RULES = {
  '@typescript-eslint/no-unsafe-assignment': 'off',
  '@typescript-eslint/no-unsafe-argument': 'off',
  '@typescript-eslint/no-unsafe-call': 'off',
  '@typescript-eslint/no-unsafe-member-access': 'off',
  '@typescript-eslint/no-unsafe-return': 'off',
  '@typescript-eslint/require-await': 'off',
  '@typescript-eslint/unbound-method': 'off',
};

/**
 * @param {{
 *   tsconfigRootDir: string;
 *   parserOptions?: import('typescript-eslint').ParserOptions;
 *   rules?: Record<string, unknown>;
 *   specRules?: Record<string, unknown> | false;
 *   ignores?: string[];
 * }} options
 */
export function createTypeCheckedEslintConfig({
  tsconfigRootDir,
  parserOptions,
  rules = {},
  specRules,
  ignores = [],
}) {
  const resolvedParserOptions = parserOptions ?? {
    projectService: true,
    tsconfigRootDir,
  };

  /** @type {import('typescript-eslint').ConfigArray} */
  const configs = [
    {
      ignores: [...DEFAULT_IGNORES, ...ignores],
    },
    eslint.configs.recommended,
    ...tseslint.configs.recommendedTypeChecked,
    {
      languageOptions: {
        globals: {
          ...globals.node,
          ...globals.jest,
        },
        sourceType: 'commonjs',
        parserOptions: resolvedParserOptions,
      },
    },
    {
      rules: {
        ...BASE_RULES,
        ...rules,
      },
    },
  ];

  if (specRules !== false) {
    configs.push({
      files: ['**/*.spec.ts', '**/*.e2e-spec.ts'],
      rules: {
        ...DEFAULT_SPEC_RULES,
        ...(specRules ?? {}),
      },
    });
  }

  return tseslint.config(...configs);
}
