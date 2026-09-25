import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const NO_DASH_MESSAGE =
  "No em/en dashes in strings or UI text. Rewrite with a period, comma, colon, or parentheses (use a plain hyphen for ranges like 2-8).";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        { selector: "Literal[value=/[–—]/]", message: NO_DASH_MESSAGE },
        { selector: "TemplateElement[value.raw=/[–—]/]", message: NO_DASH_MESSAGE },
        { selector: "JSXText[value=/[–—]/]", message: NO_DASH_MESSAGE },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
