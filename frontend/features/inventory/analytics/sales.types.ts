/** Contract of `GET /inventory/products/{id}/sales/`. */
import type { SalesImpactGranularity } from "./salesImpact.types"

export interface SalesParams {
    granularity: SalesImpactGranularity
    date_from?: string
    date_to?: string
}

export interface SalesPeriodTotals {
    units: number
    net_revenue: number
    customers: number
    margin_pct: number | null
    avg_discount_pct: number
}

export interface SalesKpis extends SalesPeriodTotals {
    return_units: number
    return_rate_pct: number
    /** Over the whole history, not only the range. `null` when the product never sold. */
    last_sale_date: string | null
    days_since_last_sale: number | null
    /** Equal-length period before `date_from`; `null` without `date_from`. */
    previous: SalesPeriodTotals | null
}

export interface SalesPoint {
    period: string
    units: number
    net_revenue: number
}

export interface SalesShareRow {
    key: string
    label: string
    units: number
    net_revenue: number
    share_pct: number
}

export interface SalesCustomerRow {
    id: number
    name: string
    units: number
    net_revenue: number
    share_pct: number
}

export interface ProductSales {
    kpis: SalesKpis
    /** `previous_points` carry the labels of the current periods they overlay. */
    series: { points: SalesPoint[]; previous_points: SalesPoint[] }
    customers: { total: number; top3_share_pct: number; top: SalesCustomerRow[] }
    channels: SalesShareRow[]
    variants: SalesShareRow[]
    uoms: SalesShareRow[]
}
