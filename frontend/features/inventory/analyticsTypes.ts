// ── Analytics types for the stock-moves (Kardex) panel ────────
//
// These types model the decision-oriented dimensions of the Kardex
// analytics view, aligned with the 3 tabs of the panel:
//   A. Flujo de movimientos (flow_trend)
//   B. Productos (top_products + category_distribution)
//   C. Bodegas / ubicaciones (location_distribution)
//
// value_trend remains part of the backend response but is no longer
// rendered in the panel.
//
// All monetary/quantity values arrive as strings (Decimal) from the
// backend and are parsed client-side where needed.

export type MoveDirection = "IN" | "OUT" | "TRANSFER" | "ADJUSTMENT" | "OTHER"

// ── A. Flow trend (Tab: Flujo) ─────────────────────────────────

export interface FlowTrendRow {
    period: string
    count: number
    entradas: string
    salidas: string
    ajustes: string
    transferencias: string
}

// ── B. Value trend (returned by the API, not rendered) ─────────

export interface ValueTrendRow {
    period: string
    entrada: string
    salida: string
    ajuste: string
    transferencia: string
    total: string
}

// ── Direction distribution ─────────────────────────────────────

export interface DirectionDistributionRow {
    id: MoveDirection
    label: string
    count: number
    quantity: string
    amount: string
}

// ── B. Products (Tab: Productos) ───────────────────────────────

export interface TopProductRow {
    product_id: number
    product_name: string
    quantity: string
    amount: string
}

export interface CategoryDistributionRow {
    id: string
    value: number
}

// ── C. Locations (Tab: Bodegas) ────────────────────────────────

export interface LocationDistributionRow {
    id: string
    value: number
    in: number
    out: number
}

// ── Summary KPIs ───────────────────────────────────────────────

export interface StockMoveSummaryKpis {
    total_movements: number
    total_in_qty: string
    total_out_qty: string
    total_adjustment_qty: string
    total_value: string
}

// ── Consolidated response from the analytics endpoint ──────────

export interface StockMoveAnalyticsResponse {
    flow_trend: FlowTrendRow[]
    value_trend: ValueTrendRow[]
    direction_distribution: DirectionDistributionRow[]
    top_products: TopProductRow[]
    category_distribution: CategoryDistributionRow[]
    location_distribution: LocationDistributionRow[]
    summary: StockMoveSummaryKpis
}

export interface StockMoveAnalyticsParams {
    months?: number
    granularity?: string
    product_id?: string | number | null
    product_name?: string | null
    source_location_id?: string | number | null
    destination_location_id?: string | number | null
    date_from?: string | null
    date_to?: string | null
}
