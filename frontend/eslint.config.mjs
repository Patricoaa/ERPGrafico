import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // Sprint 1: Type safety & architecture rules
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      // Warn on explicit `any` to gradually improve type safety (T1-T10)
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  // Prevent UI components from importing the API layer directly (A1)
  {
    files: [
      "components/**/*.ts",
      "components/**/*.tsx",
    ],
    rules: {
      "no-restricted-imports": [
        "warn",
        {
          paths: [
            {
              name: "@/lib/api",
              message:
                "Components should not import @/lib/api directly. Extract API calls to a hook in the corresponding feature module.",
            },
          ],
          patterns: [
            {
              group: ["@/lib/api"],
              message:
                "Components should not import @/lib/api directly. Extract API calls to a hook in the corresponding feature module.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
