/**
 * Centralized query key constants for the Inventory domain.
 * Kept in a separate file to avoid circular imports between hooks
 * that need to cross-invalidate each other (e.g. useProducts ↔ useBOMs).
 */

export const PRODUCTS_QUERY_KEY = ['products'] as const
export const BOMS_QUERY_KEY = ['boms'] as const
export const VARIANTS_QUERY_KEY = ['product-variants'] as const
export const STOCK_MOVES_QUERY_KEY = ['inventory', 'stockMoves'] as const
export const PRICING_RULES_QUERY_KEY = ['pricingRules'] as const
export const CATEGORIES_QUERY_KEY = ['inventoryCategories'] as const
export const ATTRIBUTES_QUERY_KEY = ['inventoryAttributes'] as const
export const WAREHOUSES_QUERY_KEY = ['warehouses'] as const
export const UOMS_QUERY_KEY = ['uoms'] as const
