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

export type ProductAnalyticsTabId =
    | "overview"
    | "sales"
    | "purchases"
    | "price"
    | "cost"
    | "kardex"
    | "production"
    | "customers"
    | "suppliers"

export type OverviewKpiId = "units_sold" | "valuation" | "stock" | "units_purchased" | "production_usage"

export const SEGMENT_LABELS: Record<ProductSegment, string> = {
    MANUFACTURABLE_EXPRESS: "Fabricable express",
    MANUFACTURABLE_STOCKED: "Fabricable con stock",
    MANUFACTURABLE_ON_DEMAND: "Fabricable bajo pedido",
    SERVICE: "Servicio",
    SUBSCRIPTION: "Suscripción",
    INPUT: "Insumo",
    STORABLE: "Almacenable",
    CONSUMABLE: "Consumible",
}

const TAB_ORDER: ProductAnalyticsTabId[] = [
    "overview", "sales", "purchases", "price", "cost", "kardex", "production", "customers", "suppliers",
]

const TAB_RULES: Record<ProductAnalyticsTabId, (c: ProductCapabilities) => boolean> = {
    overview: () => true,
    sales: (c) => c.sells,
    price: (c) => c.sells,
    customers: (c) => c.sells,
    purchases: (c) => c.buys,
    suppliers: (c) => c.buys,
    cost: (c) => c.buys || c.manufactures || c.tracks_stock,
    kardex: (c) => c.tracks_stock,
    production: (c) => c.manufactures || c.used_in_production,
}

/** Tabs que aplican al producto, en orden fijo. Sin capacidades (respuesta antigua) → todos. */
export function visibleTabIds(capabilities: ProductCapabilities | null | undefined): ProductAnalyticsTabId[] {
    if (!capabilities) return [...TAB_ORDER]
    return TAB_ORDER.filter((id) => TAB_RULES[id](capabilities))
}

/** KPIs del Resumen que aplican al producto. Sin capacidades → los tres originales. */
export function overviewKpiIds(capabilities: ProductCapabilities | null | undefined): OverviewKpiId[] {
    if (!capabilities) return ["units_sold", "valuation", "stock"]
    const ids: OverviewKpiId[] = []
    if (capabilities.sells) ids.push("units_sold")
    if (capabilities.buys && !capabilities.sells) ids.push("units_purchased")
    if (capabilities.tracks_stock) ids.push("valuation", "stock")
    if (capabilities.used_in_production) ids.push("production_usage")
    return ids
}
