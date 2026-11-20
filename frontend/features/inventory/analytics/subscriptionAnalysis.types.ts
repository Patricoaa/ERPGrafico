/** Contract of `GET /inventory/products/{id}/subscription-analysis/`. */
import type { SalesImpactGranularity } from "./salesImpact.types"
import type { SubscriptionFrequency, SubscriptionStatus } from "./operations.types"

export interface SubscriptionAnalysisParams {
    granularity: SalesImpactGranularity
    date_from?: string
    date_to?: string
}

export interface SubscriptionToday {
    annualized_total: number
    monthly_equivalent: number
    active_count: number
    /** Active subscriptions with a payment in the next 90 days (measured from today). */
    due_90d_total: number
}

export interface SubscriptionPoint {
    period: string
    paid: number
}

export interface SubscriptionRow {
    id: number
    supplier: string
    status: SubscriptionStatus
    amount: number
    frequency: SubscriptionFrequency
    annualized: number
    next_payment_date: string | null
    days_to_payment: number | null
    end_date: string | null
    days_to_end: number | null
    /** Last payment to this supplier over the whole history. */
    last_payment: { date: string; amount: number } | null
    /** Last payment against the previous one of the same supplier. */
    change_pct: number | null
    /** Last payment differs from the configured amount by more than 1 %. */
    differs_from_amount: boolean
}

export interface SubscriptionPayment {
    date: string
    supplier: string | null
    amount: number
    change_pct: number | null
}

export interface ProductSubscriptionAnalysis {
    today: SubscriptionToday
    kpis: { paid: number; payments: number; previous: { paid: number; payments: number } | null }
    series: { points: SubscriptionPoint[]; previous_points: SubscriptionPoint[] }
    subscriptions: SubscriptionRow[]
    payments: SubscriptionPayment[]
}
