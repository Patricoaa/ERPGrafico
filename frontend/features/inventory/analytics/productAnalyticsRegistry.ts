/**
 * Registro de tabs y KPIs del análisis de producto según las capacidades del producto
 * (ADR-0144). Módulo puro: sin React, testeable por separado.
 */

export type ProductSegment =
    | "MANUFACTURABLE_EXPRESS"
    | "MANUFACTURABLE_STOCKED"
    | "MANUFACTURABLE_ON_DEMAND"
    | "SERVICE"
    | "SUBSCRIPTION"
    | "INPUT"
    | "STORABLE"
    | "CONSUMABLE"

export interface ProductCapabilities {
    sells: boolean
    buys: boolean
    tracks_stock: boolean
    manufactures: boolean
    express: boolean
    recurring: boolean
    used_in_production: boolean
    has_variants: boolean
    segment: ProductSegment
}

/** Tabs por decisión (ADR-0150): cada uno absorbe varios tabs anteriores. */
export type ProductAnalyticsTabId =
    | "overview"
    | "sales"
    | "pricing"
    | "costs"
    | "procurement"
    | "inventory"
    | "production"
    | "subscription"

export const TAB_LABELS: Record<ProductAnalyticsTabId, string> = {
    overview: "Resumen",
    sales: "Ventas",
    pricing: "Precio",
    costs: "Costos",
    procurement: "Abastecimiento",
    inventory: "Inventario",
    production: "Producción",
    subscription: "Suscripción",
}

export const TAB_ORDER: ProductAnalyticsTabId[] = [
    "overview", "sales", "pricing", "costs", "procurement", "inventory", "production", "subscription",
]

const TAB_RULES: Record<ProductAnalyticsTabId, (c: ProductCapabilities) => boolean> = {
    overview: () => true,
    sales: (c) => c.sells,
    pricing: (c) => c.sells,
    costs: (c) => c.buys || c.manufactures || c.tracks_stock,
    procurement: (c) => c.buys,
    inventory: (c) => c.tracks_stock,
    production: (c) => c.manufactures || c.used_in_production,
    subscription: (c) => c.recurring,
}

/** Tabs que aplican al producto, en orden fijo. Sin capacidades (respuesta antigua) → todos. */
export function visibleTabIds(capabilities: ProductCapabilities | null | undefined): ProductAnalyticsTabId[] {
    if (!capabilities) return [...TAB_ORDER]
    return TAB_ORDER.filter((id) => TAB_RULES[id](capabilities))
}
