/** Contract of `GET /inventory/products/{id}/sourcing/` (ADR-0147). */

export interface SourcingParams {
    date_from?: string
    date_to?: string
    increase_pct?: number
}

export interface SourcingMake {
    unit_cost: number
    bom_cost: number
    units_made: number
    orders: number
}

export interface SourcingBuy {
    avg_unit_cost: number
    last_unit_cost: number
    last_date: string | null
    units_bought: number
    receipts: number
}

export interface MakeVsBuy {
    make: SourcingMake
    buy: SourcingBuy
    /** Positive when making is cheaper than buying; null when either side has no data. */
    saving_per_unit: number | null
    saving_total: number | null
    cheaper: "MAKE" | "BUY" | null
}

export interface SourcingParent {
    product_id: number
    name: string
    qty_per_unit: number
    component_cost: number
    bom_cost: number
    share_pct: number | null
    delta_cost: number
    delta_pct: number | null
    price_net: number
    margin_pct: number | null
    margin_pct_after: number | null
}

export interface UsedIn {
    increase_pct: number
    parents: SourcingParent[]
}

export interface Sourcing {
    make_vs_buy: MakeVsBuy | null
    used_in: UsedIn | null
}
