/** Contract of `GET /inventory/products/{id}/stock-analysis/`. */
import type { SalesImpactGranularity } from "./salesImpact.types"

export type IdleDays = 30 | 90 | 180

export interface StockAnalysisParams {
    granularity: SalesImpactGranularity
    idle_days: IdleDays
    date_from?: string
    date_to?: string
}

export interface StockToday {
    on_hand: number
    /** On hand × weighted cost. */
    value: number
    /** Confirmed undelivered sales, open POS carts and pending work-order materials. */
    reserved: number
    available: number
}

export interface StockRotation {
    in_qty: number
    out_qty: number
    avg_stock: number
    turnover: number | null
    days_of_inventory: number | null
    last_in_date: string | null
    last_out_date: string | null
    idle: boolean
    idle_days: number
}

export interface StockCoverage {
    /** Days the on-hand stock lasts at the last-90-days consumption; `null` without consumption. */
    coverage_days: number | null
    daily_out: number
}

export interface StockPoint {
    period: string
    stock_end: number
    in_qty: number
    out_qty: number
}

export interface StockFlowRow {
    key: "sale" | "production" | "supplier_return" | "purchase" | "customer_return" | "other"
    label: string
    qty: number
}

export interface StockAdjustmentRow {
    key: "loss" | "gain" | "revaluation"
    label: string
    qty: number
    value: number
}

export interface StockWarehouseRow {
    id: number
    name: string
    on_hand: number
    last_move_date: string | null
    idle: boolean
}

export interface StockVariantRow {
    id: number
    name: string
    on_hand: number
    reserved: number
    available: number
}

export interface ProductStockAnalysis {
    today: StockToday
    rotation: StockRotation
    coverage: StockCoverage
    series: StockPoint[]
    flows: { outflows: StockFlowRow[]; inflows: StockFlowRow[] }
    adjustments: StockAdjustmentRow[]
    /** Loss ÷ outflows × 100; `null` without outflows. */
    loss_pct: number | null
    warehouses: StockWarehouseRow[]
    variants: StockVariantRow[]
}
