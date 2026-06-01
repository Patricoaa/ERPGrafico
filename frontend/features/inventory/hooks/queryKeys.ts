/**
 * Centralized query key constants for the Inventory domain.
 *
 * Two layers coexist during migration:
 *
 * 1. **Hierarchical factories** (`PRODUCTS_KEYS`, etc.) — new style. Use these
 *    in hooks added or refactored as part of the FSD data-layer cleanup
 *    (docs/50-audit/fsd-data-layer-refactor-plan.md). Invalidating
 *    `PRODUCTS_KEYS.lists()` covers all list queries; `PRODUCTS_KEYS.details()`
 *    covers all detail queries; `PRODUCTS_KEYS.detail(id)` covers one.
 *
 * 2. **Flat constants** (`PRODUCTS_QUERY_KEY`, etc.) — legacy. Kept so that
 *    `production/useBOMs`, `inventory/usePricingRules`, and other consumers
 *    don't break during incremental migration. New code should NOT use these.
 *    They alias `<KEYS>.all` so invalidating either form hits the same root.
 */
import type { ProductFilters } from '../types'

// ─── Hierarchical factories ───────────────────────────────────────────────────

export const PRODUCTS_KEYS = {
    all: ['products'] as const,
    lists: () => [...PRODUCTS_KEYS.all, 'list'] as const,
    list: (filters?: ProductFilters) => [...PRODUCTS_KEYS.lists(), { filters }] as const,
    details: () => [...PRODUCTS_KEYS.all, 'detail'] as const,
    detail: (id: number) => [...PRODUCTS_KEYS.details(), id] as const,
}

// ─── Legacy flat constants (deprecated — kept for backward compat) ────────────

/** @deprecated Use `PRODUCTS_KEYS.*` factory instead. */
export const PRODUCTS_QUERY_KEY = PRODUCTS_KEYS.all
export const BOMS_QUERY_KEY = ['boms'] as const
export const VARIANTS_QUERY_KEY = ['product-variants'] as const
export const STOCK_MOVES_QUERY_KEY = ['inventory', 'stockMoves'] as const
export const PRICING_RULES_QUERY_KEY = ['pricingRules'] as const
export const CATEGORIES_QUERY_KEY = ['inventoryCategories'] as const
export const ATTRIBUTES_QUERY_KEY = ['inventoryAttributes'] as const
export const WAREHOUSES_QUERY_KEY = ['warehouses'] as const
export const UOMS_QUERY_KEY = ['uoms'] as const
