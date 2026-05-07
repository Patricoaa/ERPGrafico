import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import boundaries from "eslint-plugin-boundaries";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),

  // FSD boundary enforcement (eslint-plugin-boundaries v6)
  {
    plugins: { boundaries },
    settings: {
      "boundaries/elements": [
        { type: "app",              pattern: "app/**/*" },
        { type: "feature-barrel",  pattern: "features/*/index.ts" },
        { type: "feature-internal",pattern: "features/*/**/*" },
        { type: "shared",          pattern: "components/shared/**/*" },
        { type: "ui",              pattern: "components/ui/**/*" },
        { type: "hooks",           pattern: "hooks/**/*" },
        { type: "lib",             pattern: "lib/**/*" },
      ],
      "boundaries/ignore": ["**/*.test.*", "**/*.spec.*"],
    },
    rules: {
      "boundaries/dependencies": ["error", {
        default: "allow",
        rules: [
          // app/ must not import feature internals — use barrel
          {
            from: ["app"],
            disallow: ["feature-internal"],
            message: "app/ must import from features/[name]/index.ts barrel, not internals.",
          },
          // ui base stays generic — no app-specific imports
          {
            from: ["ui"],
            disallow: ["feature-internal", "feature-barrel", "app"],
            message: "components/ui/ is Shadcn base — no app-specific imports.",
          },
          // shared components cannot touch lib/api
          {
            from: ["shared"],
            disallow: ["lib"],
            message: "Shared components must not import @/lib/api. Wrap in a hook.",
          },
        ],
      }],
    },
  },

  // Type safety
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },

  // Belt-and-suspenders: block lib/api in components/ (catches cross-feature leaks too)
  {
    files: ["components/**/*.ts", "components/**/*.tsx"],
    rules: {
      "no-restricted-imports": ["warn", {
        paths: [{
          name: "@/lib/api",
          message: "Components must not import @/lib/api directly. Extract to a feature hook.",
        }],
      }],
    },
  },

  // Cross-feature internal import guard via no-restricted-imports
  // boundaries/dependencies can't do per-feature captures in v6 without complex setup.
  // This blocks features/A from importing features/B internals (components, hooks, api, types).

  // Barrel import enforcement for shared components
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "@typescript-eslint/no-restricted-imports": ["warn", {
        patterns: [
          {
            group: ["@/components/shared/*", "!@/components/shared"],
            message: "Import from the barrel (@/components/shared), not internal files.",
          }
        ]
      }]
    }
  },

  {
    files: ["features/**/*.ts", "features/**/*.tsx"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          {
            group: ["@/features/*/components/*", "@/features/*/components/**"],
            message: "Cross-feature: import from barrel (features/[name]/index.ts), not internals.",
          },
          {
            group: ["@/features/*/hooks/*", "@/features/*/hooks/**"],
            message: "Cross-feature: import from barrel (features/[name]/index.ts), not internals.",
          },
          {
            group: ["@/features/*/api/*", "@/features/*/api/**"],
            message: "Cross-feature: import from barrel (features/[name]/index.ts), not internals.",
          },
          {
            group: ["@/features/*/types/*", "@/features/*/types/**"],
            message: "Cross-feature: import from barrel (features/[name]/index.ts), not internals.",
          },
        ],
      }],
    },
  },

  // Block direct @/components/ui/skeleton imports outside of components/shared (where it's implemented)
  // Excludes **/skeletons/** — those files ARE skeleton implementations and may use the primitive.
  {
    files: ["features/**/*.ts", "features/**/*.tsx", "app/**/*.ts", "app/**/*.tsx"],
    ignores: ["features/**/skeletons/**"],
    rules: {
      "no-restricted-imports": ["error", {
        paths: [{
          name: "@/components/ui/skeleton",
          message: "Import skeleton components from @/components/shared barrel, not @/components/ui/skeleton directly.",
        }],
      }],
    },
  },

  // UI component data fetching and formatting restrictions
  {
    files: ["components/**/*.tsx", "features/*/components/**/*.tsx"],
    rules: {
      "no-restricted-imports": ["error", {
        paths: [{
          name: "@tanstack/react-query",
          importNames: ["useQuery", "useMutation", "useSuspenseQuery"],
          message: "React Query hooks must only be used within feature hooks (features/*/hooks/). Do not import them directly in components."
        }]
      }],
      "no-restricted-syntax": ["warn", 
        {
          selector: "CallExpression[callee.property.name='toLocaleString']",
          message: "Do not use .toLocaleString() for currency or quantities. Use <MoneyDisplay> or <QuantityDisplay> instead to ensure consistent UI across the app."
        },
        {
          selector: "JSXElement > JSXOpeningElement[name.name='button']",
          message: "Do not use native <button> elements. Use Shadcn <Button> or the <ActionButtons> primitives (SubmitButton, CancelButton, etc.) from @/components/shared instead."
        },
        {
          selector: "JSXElement[openingElement.name.name='Button'] JSXElement[openingElement.name.name='Loader2']",
          message: "Violación de Diseño Industrial: No inyecte Loader2 manualmente en Button. Utilice <SubmitButton loading={...}> o <ActionSlideButton loading={...}>."
        }
      ]
    }
  }
]);

export default eslintConfig;
