// @ts-check
import { createTypeCheckedEslintConfig } from "@collabspace/eslint-config";

export default createTypeCheckedEslintConfig({
  tsconfigRootDir: import.meta.dirname,
  parserOptions: {
    project: ["./tsconfig.eslint.json"],
    tsconfigRootDir: import.meta.dirname,
  },
  rules: {
    "@typescript-eslint/no-unsafe-enum-comparison": "off",
    "@typescript-eslint/require-await": "off",
  },
});
