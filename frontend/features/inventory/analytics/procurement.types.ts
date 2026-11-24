/** Contract of `GET /inventory/products/{id}/procurement/`. */
import type { SalesImpactGranularity } from "./salesImpact.types"

export interface ProcurementParams {
    granularity: SalesImpactGranularity
    date_from?: string
    date_to?: string
}

export interface ProcurementCoverage {
    stock_now: number
    /** Outflows of the last 90 days ÷ 90. */
    daily_out: number
    /** `null` without outflows or without stock. */
    coverage_days: number | null
}

export interface ProcurementPeriodTotals {
    units: number
    spend: number
    orders: number
}

export interface ProcurementKpis extends ProcurementPeriodTotals {
    suppliers: number
    /** Over the whole history. */
    last_purchase_date: string | null
    days_since_last_purchase: number | null
    returned_units: number
    previous: ProcurementPeriodTotals | null
}

export interface ProcurementPoint {
    period: string
    units: number
    spend: number
}

export interface ProcurementSupplierRow {
    id: number
    name: string
    units: number
    spend: number
    share_pct: number
    avg_unit_cost: number
    receipts: number
    last_date: string
    returned_units: number
    preferred: boolean
}

export interface ProcurementPendingRow {
    order_id: number
    number: string
    supplier: string
    date: string
    ordered: number
    received: number
    pending: number
}

export interface ProductProcurement {
    /** Only for products that track stock. */
    coverage: ProcurementCoverage | null
    kpis: ProcurementKpis
    series: { points: ProcurementPoint[]; previous_points: ProcurementPoint[] }
    suppliers: ProcurementSupplierRow[]
    preferred_supplier: { id: number; name: string } | null
    /** Current state of confirmed orders, not limited to the period. */
    pending: ProcurementPendingRow[]
}
