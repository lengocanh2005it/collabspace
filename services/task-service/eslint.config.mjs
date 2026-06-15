// @ts-check
import { createTypeCheckedEslintConfig } from "@collabspace/eslint-config";

export default createTypeCheckedEslintConfig({
  tsconfigRootDir: import.meta.dirname,
  parserOptions: {
    project: ["./tsconfig.eslint.json"],
    tsconfigRootDir: import.meta.dirname,
  },
  rules: {
    "@typescript-eslint/no-unsafe-member-access": "warn",
    "@typescript-eslint/no-unsafe-assignment": "warn",
    "@typescript-eslint/no-unsafe-return": "warn",
    "@typescript-eslint/no-unsafe-call": "warn",
    "@typescript-eslint/no-unsafe-enum-comparison": "off",
    "@typescript-eslint/require-await": "off",
    "@typescript-eslint/no-unused-vars": "warn",
  },
  specRules: {
    "@typescript-eslint/no-unsafe-assignment": "off",
    "@typescript-eslint/require-await": "off",
    "@typescript-eslint/unbound-method": "off",
  },
});
