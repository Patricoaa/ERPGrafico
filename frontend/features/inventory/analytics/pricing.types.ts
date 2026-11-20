/** Contract of `GET /inventory/products/{id}/pricing/`. */
import type { SalesImpactGranularity } from "./salesImpact.types"

export interface PricingParams {
    granularity: SalesImpactGranularity
    date_from?: string
    date_to?: string
}

export interface PricingKpisBase {
    /** `null` when the product has no cost base. */
    margin_pct: number | null
    net_revenue: number
    units: number
    avg_price: number
    avg_discount_pct: number
    foregone_revenue: number
}

export interface PricingKpis extends PricingKpisBase {
    /** Same fields for the equal-length period before `date_from`; `null` without `date_from`. */
    previous: PricingKpisBase | null
}

export interface PricingPoint {
    period: string
    units: number
    net_revenue: number
    avg_price: number
    avg_list_price: number
    avg_cost: number
    margin_pct: number | null
}

export interface PricingRulePoint {
    period: string
    /** Rule id as text, `manual` or `list`. */
    key: string
    label: string
    units: number
    avg_price: number
}

export interface PricingListChange {
    date: string
    period: string
    from: number
    to: number
}

export interface PricingSide {
    days: number
    units: number
    units_per_day: number
    revenue_per_day: number
    margin_per_unit: number | null
}

export interface PricingEffect {
    kind: "list_price" | "rule"
    label: string
    date: string
    period: string
    before: PricingSide
    after: PricingSide
    reliable: boolean
}

export interface ProductPricing {
    has_cost: boolean
    today: {
        list_price_net: number
        list_price_gross: number
        cost: number
        list_margin_pct: number | null
    }
    kpis: PricingKpis
    series: { points: PricingPoint[]; by_rule: PricingRulePoint[] }
    list_price_changes: { baseline: number | null; changes: PricingListChange[] }
    rule_windows: Array<{ rule_id: number; name: string; start: string | null; end: string | null }>
    effects: PricingEffect[]
}
