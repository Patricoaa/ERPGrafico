import { describe, it } from "vitest"
import { RuleTester, type Rule } from "eslint"
import tsParser from "@typescript-eslint/parser"
import rule from "../../eslint-rules/fsd-no-cross-feature-internals.mjs"

/**
 * Contract test for FSD Invariant #3:
 * "No cross-feature internal imports — import from feature barrel index.ts only."
 *
 * Issue #176: ESLint previously clobbered no-restricted-imports on .tsx files
 * due to flat-config override by the TanStack rule block.
 *
 * This test guarantees:
 * 1. The custom rule correctly rejects cross-feature internal imports in .tsx files.
 * 2. Same-feature internal imports are allowed.
 * 3. Barrel imports across features are allowed.
 * 4. TypeScript type-only imports across features are subject to the same guard.
 */
RuleTester.describe = describe
RuleTester.it = it

const tester = new RuleTester({
    languageOptions: {
        parser: tsParser,
        ecmaVersion: "latest",
        sourceType: "module",
        parserOptions: { ecmaFeatures: { jsx: true } },
    },
})

tester.run("fsd/no-cross-feature-internals (Issue #176)", rule as unknown as Rule.RuleModule, {
    valid: [
        // 1. Cross-feature import from barrel is allowed
        {
            code: 'import { useOrders } from "@/features/orders";',
            filename: "/repo/frontend/features/sales/components/SaleOrder.tsx",
        },
        // 2. Cross-feature import with explicit index is allowed
        {
            code: 'import { useOrders } from "@/features/orders/index";',
            filename: "/repo/frontend/features/sales/components/SaleOrder.tsx",
        },
        // 3. Self-feature internal import is allowed
        {
            code: 'import { useSalesHook } from "@/features/sales/hooks/useSalesHook";',
            filename: "/repo/frontend/features/sales/components/SaleOrder.tsx",
        },
        // 4. Non-feature imports are ignored
        {
            code: 'import { Button } from "@/components/ui/button";',
            filename: "/repo/frontend/features/sales/components/SaleOrder.tsx",
        },
        // 5. Cross-feature type import from barrel is allowed
        {
            code: 'import type { OrderLine } from "@/features/orders";',
            filename: "/repo/frontend/features/sales/components/SaleOrder.tsx",
        },
    ],
    invalid: [
        // Issue #176 reproduction: TSX file importing another feature's internal hook
        {
            code: 'import { useUoMs } from "@/features/inventory/hooks/useUoMs";',
            filename: "/repo/frontend/features/sales/components/SaleOrder.tsx",
            errors: [
                {
                    messageId: "crossFeature",
                    data: {
                        target: "inventory",
                        source: "@/features/inventory/hooks/useUoMs",
                    },
                },
            ],
        },
        // Cross-feature internal entity-view import in TSX
        {
            code: 'import { orderLineEntity } from "@/features/orders/entity-view/orderLine.entity";',
            filename: "/repo/frontend/features/sales/entity-view/SaleOrder.stories.tsx",
            errors: [
                {
                    messageId: "crossFeature",
                    data: {
                        target: "orders",
                        source: "@/features/orders/entity-view/orderLine.entity",
                    },
                },
            ],
        },
        // app/ importing feature internal types in TSX
        {
            code: 'import type { WorkOrder } from "@/features/production/types";',
            filename: "/repo/frontend/app/(dashboard)/production/orders/page.tsx",
            errors: [
                {
                    messageId: "crossFeature",
                    data: {
                        target: "production",
                        source: "@/features/production/types",
                    },
                },
            ],
        },
        // Cross-feature internal api import
        {
            code: 'import { financeApi } from "@/features/finance/api/financeApi";',
            filename: "/repo/frontend/features/treasury/components/PaymentFormDrawer.tsx",
            errors: [
                {
                    messageId: "crossFeature",
                    data: {
                        target: "finance",
                        source: "@/features/finance/api/financeApi",
                    },
                },
            ],
        },
    ],
})
