// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";

import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import boundaries from "eslint-plugin-boundaries";
import fsdNoApiInComponent from "./eslint-rules/fsd-no-api-in-component.mjs";
import paginationNoEnvelopeDiscard from "./eslint-rules/pagination-no-envelope-discard.mjs";
import paginationDatatableNeedsRowcount from "./eslint-rules/pagination-datatable-needs-rowcount.mjs";
import noRawTailwindColors from "./eslint-rules/no-raw-tailwind-colors.mjs";
import formsMustUseHook from "./eslint-rules/forms-must-use-hook.mjs";
import componentNamingSuffix from "./eslint-rules/component-naming-suffix.mjs";
import statusMustUseStatusbadge from "./eslint-rules/status-must-use-statusbadge.mjs";

const eslintConfig = defineConfig([...nextVitals, ...nextTs, globalIgnores([
  ".next/**",
  "out/**",
  "build/**",
  "next-env.d.ts",
]), // FSD boundary enforcement (eslint-plugin-boundaries v6)
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
          from: { type: "app" },
          disallow: [{ to: { type: "feature-internal" } }],
          message: "app/ must import from features/[name]/index.ts barrel, not internals.",
        },
        // ui base stays generic — no app-specific imports
        {
          from: { type: "ui" },
          disallow: [
            { to: { type: "feature-internal" } },
            { to: { type: "feature-barrel" } },
            { to: { type: "app" } },
          ],
          message: "components/ui/ is Shadcn base — no app-specific imports.",
        },
        // shared components cannot touch lib/api — allow pure utils
        {
          from: { type: "shared" },
          disallow: [{ to: { type: "lib" } }],
          message: "Shared components must not import @/lib/api. Wrap in a hook.",
        },
        {
          from: { type: "shared" },
          allow: [{ to: { type: "lib", path: ["**/lib/utils/**", "**/lib/money.ts", "**/lib/errors.ts", "**/lib/form-widths.ts"] } }],
        },
      ],
    }],
  },
}, // Type safety — includes both syntax-only and type-aware rules
// The `languageOptions.parserOptions.projectService` enables type-aware
// linting for the no-unsafe-* rules. See https://typescript-eslint.io/getting-started/typed-linting
{
  files: ["**/*.ts", "**/*.tsx"],
  languageOptions: {
    parserOptions: {
      projectService: {
        allowDefaultProject: [".storybook/*.ts"],
      },
    },
  },
  rules: {
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unsafe-assignment": "warn",
    "@typescript-eslint/no-unsafe-call": "warn",
    "@typescript-eslint/no-unsafe-member-access": "warn",
    "@typescript-eslint/no-unsafe-return": "warn",
    "@typescript-eslint/no-non-null-assertion": "warn",
    "@typescript-eslint/consistent-type-imports": ["warn", {
      "prefer": "type-imports",
      "fixStyle": "inline-type-imports",
      "disallowTypeAnnotations": true,
    }],
  },
}, // Test exceptions — override rules that would be too strict in test files
{
  files: ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts", "**/*.spec.tsx"],
  rules: {
    "@typescript-eslint/no-non-null-assertion": "off",
    "@typescript-eslint/consistent-type-imports": "off",
    "@typescript-eslint/no-explicit-any": "off",
  },
}, // Belt-and-suspenders: block lib/api in components/ (catches cross-feature leaks too)
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
}, // Cross-feature internal import guard via no-restricted-imports
// boundaries/dependencies can't do per-feature captures in v6 without complex setup.
// This blocks features/A from importing features/B internals (components, hooks, api, types).

// Barrel import enforcement for shared components
{
  files: ["**/*.ts", "**/*.tsx"],
  rules: {
    "@typescript-eslint/no-restricted-imports": ["error", {
      patterns: [
        {
          group: ["@/components/shared/*", "!@/components/shared"],
          message: "Import from the barrel (@/components/shared), not internal files.",
        }
      ]
    }]
  }
}, {
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
}, // Block direct @/components/ui/skeleton imports outside of components/shared (where it's implemented)
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
}, // FSD invariant #5 — components must not import @/lib/api directly.
// Lives in a custom rule (not no-restricted-imports) because flat-config does
// not merge no-restricted-imports across blocks: layering a second block here
// would clobber the tanstack restriction below. Severity is `warn` during the
// FSD data-layer migration (docs/50-audit/fsddata/fsd-data-layer-refactor-plan.md);
// bump to `error` when the global violation count reaches 0.
{
  files: ["features/*/components/**/*.ts", "features/*/components/**/*.tsx"],
  plugins: {
    fsd: { rules: { "no-api-in-component": fsdNoApiInComponent } },
  },
  rules: {
    "fsd/no-api-in-component": "warn",
  },
},
// Pagination contract — see docs/20-contracts/pagination-contract.md
// 1. no-envelope-discard: bans `data.results || data` in api/ and hooks/.
//    Promoted from `warn` to `error` on 2026-05-23 after the global
//    violation count reached 0 (all 33 + 5 sites migrated). Any new
//    instance is a regression and blocks the build.
{
  files: ["features/*/api/**/*.ts", "features/*/hooks/**/*.ts"],
  plugins: {
    pagination: { rules: { "no-envelope-discard": paginationNoEnvelopeDiscard } },
  },
  rules: {
    "pagination/no-envelope-discard": "error",
  },
},
// 2. datatable-needs-rowcount: any <DataTable manualPagination /> without
//    rowCount produces a wrong "Mostrando X a Y de Z" footer. This is a
//    visible bug, so `error` from day one (no migration warmup).
{
  files: ["features/**/*.tsx", "components/**/*.tsx", "app/**/*.tsx"],
  plugins: {
    pagination: { rules: { "datatable-needs-rowcount": paginationDatatableNeedsRowcount } },
  },
  rules: {
    "pagination/datatable-needs-rowcount": "error",
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
      },
      {
        // Row/card action anti-pattern: <Button>...<RegistryIcon/>...</Button>.
        // Matches when a Button has a child JSX whose name matches a ROW_ACTIONS icon (or known drift alias).
        // Legit icon buttons (Bell, X, Plus, ChevronLeft, Settings, etc.) are NOT flagged.
        // Internal renderers (DataCell.Action / IconButton) use a dynamic <Icon> child, so they are not matched.
        selector: "JSXElement[openingElement.name.name='Button']:has(JSXAttribute[name.name='size'][value.value='icon']) > JSXElement[openingElement.name.name=/^(Pencil|Edit|Edit2|Edit3|SquarePen|Trash|Trash2|Eye|FileText|Copy|Archive|ArchiveRestore|Banknote|DollarSign|Wallet|CreditCard|Truck|PackageCheck|Package|Ban|Lock|Unlock|LayoutDashboard|Share2|Printer|Download)$/]",
        message: "Row/card action anti-pattern. Use <DataCell.Action action=\"<key>\" /> (table) or <CardActions.Item action=\"<key>\" /> (card/kanban) from @/components/shared. See docs/20-contracts/component-row-actions.md (ROW_ACTIONS registry)."
      }
    ]
  }
},
// Row/card action lint extended to top-level app/ pages, which may embed inline actions
// directly in route components instead of feature components.
{
  files: ["app/**/*.tsx"],
  rules: {
    "no-restricted-syntax": ["warn",
      {
        selector: "JSXElement[openingElement.name.name='Button']:has(JSXAttribute[name.name='size'][value.value='icon']) > JSXElement[openingElement.name.name=/^(Pencil|Edit|Edit2|Edit3|SquarePen|Trash|Trash2|Eye|FileText|Copy|Archive|ArchiveRestore|Banknote|DollarSign|Wallet|CreditCard|Truck|PackageCheck|Package|Ban|Lock|Unlock|LayoutDashboard|Share2|Printer|Download)$/]",
        message: "Row/card action anti-pattern. Use <DataCell.Action action=\"<key>\" /> or <CardActions.Item action=\"<key>\" /> from @/components/shared. See docs/20-contracts/component-row-actions.md."
      }
    ]
  }
}, // Raw Tailwind color detection — GOVERNANCE.md §3 rule 12
{
  files: ["**/*.tsx", "**/*.ts"],
  plugins: {
    tw: { rules: { "no-raw-color": noRawTailwindColors } },
  },
  rules: {
    // Promoted warn → error on 2026-05-30 (ADR 0029): the regex was repaired and
    // the violation count reached 0. Any new raw color / literal hex-rgb blocks the build.
    "tw/no-raw-color": "error",
  },
}, // Forms must use react-hook-form + zodResolver — GOVERNANCE.md §6 rule 29
{
  files: ["features/**/*.tsx", "features/**/*.ts", "components/**/*.tsx", "components/**/*.ts", "app/**/*.tsx"],
  plugins: {
    forms: { rules: { "must-use-hook": formsMustUseHook } },
  },
  rules: {
    "forms/must-use-hook": "warn",
  },
}, // Component naming suffix — naming-conventions.md §1.1
{
  files: ["features/*/components/**/*.tsx"],
  plugins: {
    naming: { rules: { "component-suffix": componentNamingSuffix } },
  },
  rules: {
    "naming/component-suffix": "warn",
  },
}, // Status must use StatusBadge — GOVERNANCE.md §4 rule 19
{
  files: ["features/**/*.tsx", "components/**/*.tsx", "app/**/*.tsx"],
  plugins: {
    status: { rules: { "must-use-statusbadge": statusMustUseStatusbadge } },
  },
  rules: {
    "status/must-use-statusbadge": "warn",
  },
}, ...storybook.configs["flat/recommended"]]);

export default eslintConfig;
