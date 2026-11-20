export interface OperationsParams {
    date_from?: string
    date_to?: string
    idle_days?: number
}

export interface RotationSeriesPoint {
    month: string
    out: number
    stock_end: number
}

export interface Rotation {
    stock_now: number
    stock_value: number
    in_qty: number
    out_qty: number
    avg_stock: number
    turnover: number | null
    days_of_inventory: number | null
    coverage_days: number | null
    last_out_date: string | null
    last_in_date: string | null
    idle: boolean
    idle_days: number
    series: RotationSeriesPoint[]
}

export type SubscriptionFrequency = "WEEKLY" | "MONTHLY" | "QUARTERLY" | "SEMIANNUAL" | "ANNUAL"
export type SubscriptionStatus = "ACTIVE" | "PAUSED" | "CANCELLED" | "EXPIRED"

export interface SubscriptionItem {
    id: number
    supplier: string
    status: SubscriptionStatus
    amount: number
    frequency: SubscriptionFrequency
    annualized: number
    next_payment_date: string | null
    days_to_payment: number | null
}

export interface SubscriptionPayment {
    date: string
    supplier: string | null
    unit_cost: number
    quantity: number
    change_pct: number | null
}

export interface SubscriptionsSummary {
    annualized_total: number
    monthly_equivalent_total: number
    count: number
    due_90d_total: number
    items: SubscriptionItem[]
    payments: SubscriptionPayment[]
    first_to_last_pct: number | null
}

export interface Operations {
    rotation: Rotation | null
    subscriptions: SubscriptionsSummary | null
}
