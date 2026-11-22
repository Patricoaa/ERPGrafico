import { describe, expect, it } from "vitest"
import { composeOverview, type OverviewSources } from "../composeOverview"
import type { ProductCosts } from "../costs.types"
import type { ProductPricing } from "../pricing.types"
import type { ProductProcurement } from "../procurement.types"
import type { ProductProductionAnalysis } from "../productionAnalysis.types"
import type { ProductSales } from "../sales.types"
import type { ProductStockAnalysis } from "../stockAnalysis.types"
import type { ProductSubscriptionAnalysis } from "../subscriptionAnalysis.types"

const sales: ProductSales = {
    kpis: { units: 120, net_revenue: 50000, customers: 4, return_units: 0, return_rate_pct: 0, last_sale_date: "2026-11-01", days_since_last_sale: 19, margin_pct: null, avg_discount_pct: 0, previous: { units: 100, net_revenue: 40000, customers: 3, margin_pct: null, avg_discount_pct: 0 } },
    series: { points: [], previous_points: [] }, customers: { total: 4, top3_share_pct: 50, top: [] }, channels: [], variants: [], uoms: [],
}
const pricing: ProductPricing = {
    has_cost: true,
    today: { list_price_net: 1000, list_price_gross: 1190, cost: 400, list_margin_pct: 60 },
    kpis: { margin_pct: 55, net_revenue: 50000, units: 120, avg_price: 950, avg_discount_pct: 5, foregone_revenue: 0, previous: null },
    series: { points: [], by_rule: [] }, list_price_changes: { baseline: 1000, changes: [] }, rule_windows: [], effects: [],
}
const costs: ProductCosts = {
    mode: "purchased",
    today: { weighted_cost: 400, bom_cost: null, last_purchase: null, stock_qty: 10, stock_value: 4000 },
    kpis: { cost_change_pct: 12, replacement_gap_pct: null },
    series: [], purchases: { min: null, max: null, avg: null, count: 0, items: [] }, bom: null, work_orders: [],
}
const procurement: ProductProcurement = {
    coverage: { stock_now: 30, daily_out: 3, coverage_days: 10 },
    kpis: { units: 60, spend: 24000, orders: 2, suppliers: 1, last_purchase_date: null, days_since_last_purchase: null, returned_units: 0, previous: null },
    series: { points: [], previous_points: [] }, suppliers: [], preferred_supplier: null, pending: [],
}
const inventory: ProductStockAnalysis = {
    today: { on_hand: 30, value: 12000, reserved: 5, available: 25 },
    rotation: { in_qty: 0, out_qty: 0, avg_stock: 0, turnover: null, days_of_inventory: null, last_in_date: null, last_out_date: null, idle: false, idle_days: 90 },
    series: [], flows: { outflows: [], inflows: [] }, adjustments: [], loss_pct: null, warehouses: [], variants: [],
}
const production: ProductProductionAnalysis = {
    made: null,
    input: { kpis: { consumed: 80, orders: 4, previous: null }, series: { points: [], previous_points: [] }, by_product: [], used_in: { increase_pct: 10, parents: [] } },
}
const subscription: ProductSubscriptionAnalysis = {
    today: { annualized_total: 14400, monthly_equivalent: 1200, active_count: 2, due_90d_total: 3600 },
    kpis: { paid: 0, payments: 0, previous: null }, series: { points: [], previous_points: [] }, subscriptions: [], payments: [],
}
const all: OverviewSources = { sales, pricing, costs, procurement, inventory, production, subscription }
const caps = { has_variants: false }
const card = (sources: OverviewSources, tab: string) => composeOverview(sources, caps).cards.find((c) => c.tab === tab)

describe("composeOverview cards", () => {
    it("builds one card per source in the rail order", () => {
        expect(composeOverview(all, caps).cards.map((c) => c.tab)).toEqual([
            "sales", "pricing", "costs", "procurement", "inventory", "production", "subscription",
        ])
    })

    it("uses units sold with the change against the previous period for sales", () => {
        expect(card(all, "sales")).toMatchObject({ label: "Unidades vendidas", value: 120, kind: "number", delta: { current: 120, previous: 100 } })
    })

    it("uses realized margin, or realized price without cost, for pricing", () => {
        expect(card(all, "pricing")).toMatchObject({ label: "Margen realizado", value: 55, kind: "percent" })
        expect(card({ pricing: { ...pricing, has_cost: false } }, "pricing")).toMatchObject({ label: "Precio realizado", value: 950, kind: "money" })
    })

    it("uses the costs hero figure", () => {
        expect(card(all, "costs")).toMatchObject({ label: "Costo ponderado", value: 400, kind: "money" })
    })

    it("uses coverage days with stock and spend without it for procurement", () => {
        expect(card(all, "procurement")).toMatchObject({ label: "Cobertura", value: 10, kind: "days" })
        expect(card({ procurement: { ...procurement, coverage: null } }, "procurement")).toMatchObject({ label: "Gasto del periodo", value: 24000, kind: "money" })
    })

    it("uses on hand for inventory, consumption for an input and the annualized cost for a subscription", () => {
        expect(card(all, "inventory")).toMatchObject({ label: "Existencia", value: 30 })
        expect(card(all, "production")).toMatchObject({ label: "Consumo en OT", value: 80 })
        expect(card(all, "subscription")).toMatchObject({ label: "Costo anualizado", value: 14400, kind: "money" })
    })

    it("uses units produced for a manufactured product", () => {
        const made = { kpis: { orders: 3, units: 30, rectified: 0, rectification_rate: 0, previous: null }, series: { points: [], previous_points: [] }, materials: [], orders: [] }
        expect(card({ production: { made, input: null } }, "production")).toMatchObject({ label: "Unidades producidas", value: 30 })
    })

    it("skips sources without data", () => {
        expect(composeOverview({ sales, pricing: null }, caps).cards.map((c) => c.tab)).toEqual(["sales"])
    })
})

describe("composeOverview findings", () => {
    it("groups each tab's findings in the rail order and skips tabs without findings", () => {
        const groups = composeOverview(all, caps).groups
        expect(groups.map((g) => g.tab)).toEqual(["costs", "procurement"])
        expect(groups[0].findings.map((f) => f.id)).toContain("cost_rising")
        expect(groups[1].findings.map((f) => f.id)).toContain("low_coverage")
    })

    it("returns no groups without findings", () => {
        expect(composeOverview({ sales }, caps).groups).toEqual([])
    })
})
