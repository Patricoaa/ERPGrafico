import { describe, expect, it } from "vitest"
import { composePricing } from "../composePricing"
import type { PricingEffect, PricingPoint, ProductPricing } from "../pricing.types"

const point = (over: Partial<PricingPoint> = {}): PricingPoint => ({
    period: "2026-01", units: 10, net_revenue: 10000, avg_price: 1000, avg_list_price: 1000, avg_cost: 400, margin_pct: 60, ...over,
})
const effect: PricingEffect = {
    kind: "list_price", label: "x", date: "2026-03-01", period: "2026-03", reliable: true,
    before: { days: 28, units: 10, units_per_day: 1, revenue_per_day: 1, margin_per_unit: 1 },
    after: { days: 28, units: 10, units_per_day: 1, revenue_per_day: 1, margin_per_unit: 1 },
}
function data(over: Partial<ProductPricing> = {}): ProductPricing {
    return {
        has_cost: true,
        today: { list_price_net: 1000, list_price_gross: 1190, cost: 400, list_margin_pct: 60 },
        kpis: { margin_pct: 60, net_revenue: 100000, units: 100, avg_price: 1000, avg_discount_pct: 0, foregone_revenue: 0, previous: null },
        series: { points: [point(), point({ period: "2026-02" })], by_rule: [] },
        list_price_changes: { baseline: 1000, changes: [] },
        rule_windows: [],
        effects: [effect],
        ...over,
    }
}
const caps = { has_variants: false }
const ids = (d: ProductPricing) => composePricing(d, caps).findings.map((f) => f.id)

describe("composePricing", () => {
    it("flags a cost rise of 5% or more while the list price did not change", () => {
        const rising = data({ series: { points: [point({ avg_cost: 400 }), point({ period: "2026-02", avg_cost: 424 })], by_rule: [] } })
        expect(ids(rising)).toContain("cost_up_price_flat")
    })

    it("does not flag a cost rise below 5%", () => {
        const mild = data({ series: { points: [point({ avg_cost: 400 }), point({ period: "2026-02", avg_cost: 416 })], by_rule: [] } })
        expect(ids(mild)).not.toContain("cost_up_price_flat")
    })

    it("does not flag the cost rise when the list price changed", () => {
        const changed = data({
            series: { points: [point({ avg_cost: 400 }), point({ period: "2026-02", avg_cost: 460 })], by_rule: [] },
            list_price_changes: { baseline: 1000, changes: [{ date: "2026-02-01", period: "2026-02", from: 1000, to: 1100 }] },
        })
        expect(ids(changed)).not.toContain("cost_up_price_flat")
    })

    it("flags a negative realized margin in any period", () => {
        const negative = data({ series: { points: [point(), point({ period: "2026-02", margin_pct: -3 })], by_rule: [] } })
        expect(ids(negative)).toContain("negative_margin")
    })

    it("flags foregone revenue of 5% or more of net revenue, not 4.9%", () => {
        const high = data({ kpis: { ...data().kpis, net_revenue: 1000, foregone_revenue: 50 } })
        const low = data({ kpis: { ...data().kpis, net_revenue: 1000, foregone_revenue: 49 } })
        expect(ids(high)).toContain("high_foregone")
        expect(ids(low)).not.toContain("high_foregone")
    })

    it("has no margin findings without a cost base", () => {
        const noCost = data({
            has_cost: false,
            series: { points: [point({ margin_pct: null, avg_cost: 0 }), point({ period: "2026-02", margin_pct: null, avg_cost: 0 })], by_rule: [] },
        })
        expect(ids(noCost)).toEqual([])
    })

    it("uses margin as hero with a cost base and price without it", () => {
        expect(composePricing(data(), caps).hero).toBe("margin")
        expect(composePricing(data({ has_cost: false }), caps).hero).toBe("price")
    })

    it("has no sections without sales", () => {
        const empty = data({ series: { points: [], by_rule: [] } })
        expect(composePricing(empty, caps).sections).toEqual([])
    })

    it("omits effects when there are no events", () => {
        expect(composePricing(data({ effects: [] }), caps).sections).toEqual(["charts", "breakdown"])
        expect(composePricing(data(), caps).sections).toEqual(["charts", "effects", "breakdown"])
    })

    it("groups the breakdown by variant for products with variants", () => {
        expect(composePricing(data(), { has_variants: true }).defaultGroupBy).toBe("variant")
        expect(composePricing(data(), caps).defaultGroupBy).toBe("rule")
    })
})
