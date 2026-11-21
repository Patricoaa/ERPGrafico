/** Contract of `GET /inventory/products/{id}/sales-impact/` (ADR-0145). */

export type SalesImpactMetric =
    | "units" | "net_revenue" | "margin" | "avg_price" | "discount_total" | "foregone_revenue"
export type SalesImpactGroupBy = "rule" | "channel" | "customer" | "variant" | "uom"
export type SalesImpactGranularity = "day" | "week" | "month" | "year"

export interface SalesImpactParams {
    metric: SalesImpactMetric
    group_by: SalesImpactGroupBy
    granularity: SalesImpactGranularity
    date_from?: string
    date_to?: string
    channel?: string
    customer?: number
    variant?: number
    uom?: number
    rule?: number
}

export interface SalesImpactSegment { key: string; label: string }

export interface SalesImpactTotals {
    units: number
    net_revenue: number
    margin: number
    margin_pct: number
    discount_total: number
    foregone_revenue: number
}

export interface SalesImpactRow extends SalesImpactTotals {
    key: string
    label: string
    avg_price: number
}

export interface SalesImpact {
    series: Array<{ period: string; segments: Record<string, number> }>
    segments: SalesImpactSegment[]
    table: SalesImpactRow[]
    totals: SalesImpactTotals
    returns: { units: number; revenue: number }
    coverage: { revenue_with_provenance_pct: number; since: string | null }
    rule_windows: Array<{ rule_id: number; name: string; start: string | null; end: string | null }>
}
