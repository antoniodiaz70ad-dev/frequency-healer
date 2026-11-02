import js from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default defineConfig([
  {
    files: ["**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  nextPlugin.configs.recommended,
  nextPlugin.configs["core-web-vitals"],
  reactHooks.configs.flat.recommended,
  {
    rules: {
      "no-empty": "off",
      "no-control-regex": "off",
      "no-useless-escape": "off",
      "preserve-caught-error": "off",
    },
  },
  globalIgnores([
    ".next/**",
    ".test-build/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);
