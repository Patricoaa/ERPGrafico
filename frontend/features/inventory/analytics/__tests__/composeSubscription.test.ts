import { describe, expect, it } from "vitest"
import { composeSubscription } from "../composeSubscription"
import type { ProductSubscriptionAnalysis, SubscriptionRow } from "../subscriptionAnalysis.types"

const row = (over: Partial<SubscriptionRow> = {}): SubscriptionRow => ({
    id: 1, supplier: "Hosting SA", status: "ACTIVE", amount: 100, frequency: "MONTHLY", annualized: 1200,
    next_payment_date: "2026-12-15", days_to_payment: 25, end_date: null, days_to_end: null,
    last_payment: { date: "2026-11-15", amount: 100 }, change_pct: 0, differs_from_amount: false, ...over,
})
function subs(rows: SubscriptionRow[], payments = 1): ProductSubscriptionAnalysis {
    return {
        today: { annualized_total: 1200, monthly_equivalent: 100, active_count: 1, due_90d_total: 100 },
        kpis: { paid: payments * 100, payments, previous: null },
        series: { points: payments ? [{ period: "2026-11", paid: 100 }] : [], previous_points: [] },
        subscriptions: rows,
        payments: payments ? [{ date: "2026-11-15", supplier: "Hosting SA", amount: 100, change_pct: null }] : [],
    }
}
const ids = (d: ProductSubscriptionAnalysis) => composeSubscription(d).findings.map((f) => f.id)

describe("composeSubscription findings", () => {
    it("flags a price increase of 5% or more, not 4.9%", () => {
        expect(ids(subs([row({ change_pct: 5 })]))).toContain("price_increase")
        expect(ids(subs([row({ change_pct: 4.9 })]))).not.toContain("price_increase")
        expect(ids(subs([row({ change_pct: null })]))).not.toContain("price_increase")
    })

    it("flags a payment that differs from the configured amount", () => {
        expect(ids(subs([row({ differs_from_amount: true })]))).toContain("amount_mismatch")
        expect(ids(subs([row()]))).not.toContain("amount_mismatch")
    })

    it("flags an overdue payment only for active subscriptions", () => {
        expect(ids(subs([row({ days_to_payment: -1 })]))).toContain("overdue")
        expect(ids(subs([row({ days_to_payment: -1, status: "PAUSED" })]))).not.toContain("overdue")
        expect(ids(subs([row({ days_to_payment: 0 })]))).not.toContain("overdue")
    })

    it("flags a subscription ending within 30 days, not 31 nor already ended", () => {
        expect(ids(subs([row({ days_to_end: 30 })]))).toContain("ending_soon")
        expect(ids(subs([row({ days_to_end: 31 })]))).not.toContain("ending_soon")
        expect(ids(subs([row({ days_to_end: -1 })]))).not.toContain("ending_soon")
    })

    it("flags paused subscriptions", () => {
        expect(ids(subs([row({ status: "PAUSED" })]))).toContain("paused")
        expect(ids(subs([row()]))).not.toContain("paused")
    })
})

describe("composeSubscription sections", () => {
    it("lists chart, subscriptions and payments when there is data", () => {
        expect(composeSubscription(subs([row()])).sections).toEqual(["chart", "subscriptions", "payments"])
    })

    it("keeps subscriptions without payments in the period", () => {
        expect(composeSubscription(subs([row()], 0)).sections).toEqual(["subscriptions"])
        expect(composeSubscription(subs([], 0)).sections).toEqual([])
    })
})
