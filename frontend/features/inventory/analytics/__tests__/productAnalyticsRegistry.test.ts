import { describe, it, expect } from "vitest"

import {
    overviewKpiIds,
    visibleTabIds,
    type ProductCapabilities,
} from "../productAnalyticsRegistry"

const base: ProductCapabilities = {
    sells: false,
    buys: false,
    tracks_stock: false,
    manufactures: false,
    express: false,
    recurring: false,
    used_in_production: false,
    has_variants: false,
    segment: "STORABLE",
}
const caps = (overrides: Partial<ProductCapabilities>): ProductCapabilities => ({ ...base, ...overrides })

describe("visibleTabIds", () => {
    it("stocked storable that sells and buys", () => {
        expect(visibleTabIds(caps({ sells: true, buys: true, tracks_stock: true }))).toEqual([
            "overview", "sales", "pricing", "costs", "procurement", "inventory",
        ])
    })

    it("stocked storable that only sells", () => {
        expect(visibleTabIds(caps({ sells: true, tracks_stock: true }))).toEqual([
            "overview", "sales", "pricing", "costs", "inventory",
        ])
    })

    it("stocked input that is a BOM component", () => {
        expect(visibleTabIds(caps({ segment: "INPUT", buys: true, tracks_stock: true, used_in_production: true }))).toEqual([
            "overview", "costs", "procurement", "inventory", "production",
        ])
    })

    it("resale storable without stock control", () => {
        expect(visibleTabIds(caps({ sells: true, buys: true }))).toEqual([
            "overview", "sales", "pricing", "costs", "procurement",
        ])
    })

    it("consumable that is only bought", () => {
        expect(visibleTabIds(caps({ segment: "CONSUMABLE", buys: true }))).toEqual(["overview", "costs", "procurement"])
    })

    it("express manufacturable that sells has production but no inventory", () => {
        expect(visibleTabIds(caps({ segment: "MANUFACTURABLE_EXPRESS", sells: true, manufactures: true, express: true }))).toEqual([
            "overview", "sales", "pricing", "costs", "production",
        ])
    })

    it("stocked manufacturable adds inventory before production", () => {
        expect(visibleTabIds(caps({ segment: "MANUFACTURABLE_STOCKED", sells: true, manufactures: true, tracks_stock: true }))).toEqual([
            "overview", "sales", "pricing", "costs", "inventory", "production",
        ])
    })

    it("manufacturable that also buys adds procurement", () => {
        expect(visibleTabIds(caps({ segment: "MANUFACTURABLE_ON_DEMAND", sells: true, buys: true, manufactures: true }))).toEqual([
            "overview", "sales", "pricing", "costs", "procurement", "production",
        ])
    })

    it("service that only sells", () => {
        expect(visibleTabIds(caps({ segment: "SERVICE", sells: true }))).toEqual(["overview", "sales", "pricing"])
    })

    it("service that sells and buys", () => {
        expect(visibleTabIds(caps({ segment: "SERVICE", sells: true, buys: true }))).toEqual([
            "overview", "sales", "pricing", "costs", "procurement",
        ])
    })

    it("subscription that is not sold or bought only has overview and subscription", () => {
        expect(visibleTabIds(caps({ segment: "SUBSCRIPTION", recurring: true }))).toEqual(["overview", "subscription"])
    })

    it("subscription that is bought adds costs and procurement", () => {
        expect(visibleTabIds(caps({ segment: "SUBSCRIPTION", buys: true, recurring: true }))).toEqual([
            "overview", "costs", "procurement", "subscription",
        ])
    })

    it("a product that neither sells, buys nor holds stock only has the overview", () => {
        expect(visibleTabIds(caps({}))).toEqual(["overview"])
    })

    it("returns every tab when capabilities are missing", () => {
        const all = ["overview", "sales", "pricing", "costs", "procurement", "inventory", "production", "subscription"]
        expect(visibleTabIds(undefined)).toEqual(all)
        expect(visibleTabIds(null)).toEqual(all)
    })
})

describe("overviewKpiIds", () => {
    it("sellable stocked product shows units sold, valuation and stock", () => {
        expect(overviewKpiIds(caps({ sells: true, tracks_stock: true }))).toEqual(["units_sold", "valuation", "stock"])
    })

    it("input used in production adds production usage and purchases", () => {
        expect(overviewKpiIds(caps({ buys: true, tracks_stock: true, used_in_production: true }))).toEqual([
            "units_purchased", "valuation", "stock", "production_usage",
        ])
    })

    it("falls back to the original three KPIs when capabilities are missing", () => {
        expect(overviewKpiIds(undefined)).toEqual(["units_sold", "valuation", "stock"])
    })
})

describe("pricing tab", () => {
    it("pricing tab (price and margin) only applies to products that sell, right after sales", () => {
        expect(visibleTabIds(caps({ sells: true }))).toContain("pricing")
        const tabs = visibleTabIds(caps({ sells: true, buys: true, tracks_stock: true }))
        expect(tabs.indexOf("pricing")).toBe(tabs.indexOf("sales") + 1)
        expect(visibleTabIds(caps({ sells: false, buys: true }))).not.toContain("pricing")
    })
})
