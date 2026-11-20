/** Contract of `GET /inventory/products/{id}/costs/`. */
import type { SalesImpactGranularity } from "./salesImpact.types"

export type CostsMode =
    | "purchased"
    | "manufactured_stock"
    | "manufactured_on_demand"
    | "manufactured_no_bom"
    | "stock_only"

export interface CostsParams {
    granularity: SalesImpactGranularity
    date_from?: string
    date_to?: string
}

export interface CostsToday {
    weighted_cost: number
    /** Active BOM per produced unit with today's component costs; `null` without BOM. */
    bom_cost: number | null
    last_purchase: { date: string; unit_cost: number; supplier: string | null } | null
    /** Only for products that track stock. */
    stock_qty: number | null
    stock_value: number | null
}

export interface CostsKpis {
    /** Hero cost at the end vs at the start of the range; `null` without `date_from`. */
    cost_change_pct: number | null
    /** Replacement cost (last purchase or BOM today) vs weighted cost; `null` when it does not apply. */
    replacement_gap_pct: number | null
}

export interface CostsPoint {
    period: string
    weighted_cost: number | null
    /** Current recipe valued with each component's cost at the end of the period (theoretical). */
    bom_cost: number | null
    purchase_avg: number | null
    real_avg: number | null
}

export interface CostsBomLine {
    component_id: number
    name: string
    qty_per_unit: number
    unit_cost: number
    cost: number
    share_pct: number
    change_pct: number | null
    is_outsourced: boolean
}

export interface CostsWorkOrder {
    id: number
    number: string
    date: string
    units: number
    unit_real_cost: number
    unit_bom_cost: number | null
    deviation_pct: number | null
}

export interface ProductCosts {
    mode: CostsMode
    today: CostsToday
    kpis: CostsKpis
    series: CostsPoint[]
    purchases: { min: number | null; max: number | null; avg: number | null; count: number }
    bom: { lines: CostsBomLine[]; drivers: Array<{ component_id: number; name: string; delta: number }> } | null
    work_orders: CostsWorkOrder[]
}
