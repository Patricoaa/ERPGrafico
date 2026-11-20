import { describe, it, expect } from "vitest"

import {
    SEGMENT_LABELS,
    overviewKpiIds,
    visibleTabIds,
    type ProductCapabilities,
    type ProductSegment,
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
    it("hides sales tabs and shows purchasing/stock/production for an input-only product", () => {
        const tabs = visibleTabIds(caps({ segment: "INPUT", buys: true, tracks_stock: true, used_in_production: true }))
        expect(tabs).toEqual(["overview", "purchases", "cost", "kardex", "production", "suppliers"])
    })

    it("shows sales tabs for a sellable product and no stock tab without stock", () => {
        const tabs = visibleTabIds(caps({ sells: true }))
        expect(tabs).toEqual(["overview", "sales", "price", "customers"])
    })

    it("express manufacturable has production and cost but no stock tab", () => {
        const tabs = visibleTabIds(caps({ segment: "MANUFACTURABLE_EXPRESS", sells: true, manufactures: true, express: true }))
        expect(tabs).toContain("production")
        expect(tabs).toContain("cost")
        expect(tabs).not.toContain("kardex")
    })

    it("stocked manufacturable has the stock tab", () => {
        const tabs = visibleTabIds(caps({ segment: "MANUFACTURABLE_STOCKED", sells: true, manufactures: true, tracks_stock: true }))
        expect(tabs).toContain("kardex")
    })

    it("service sold without purchasing only shows overview, sales, price and customers", () => {
        expect(visibleTabIds(caps({ segment: "SERVICE", sells: true }))).toEqual(["overview", "sales", "price", "customers"])
    })

    it("subscription bought without selling shows purchasing tabs only", () => {
        expect(visibleTabIds(caps({ segment: "SUBSCRIPTION", buys: true, recurring: true }))).toEqual([
            "overview", "purchases", "cost", "suppliers",
        ])
    })

    it("returns every tab when capabilities are missing", () => {
        const all = ["overview", "sales", "purchases", "price", "cost", "kardex", "production", "customers", "suppliers"]
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

describe("SEGMENT_LABELS", () => {
    it("covers every segment with a non-empty label", () => {
        const segments: ProductSegment[] = [
            "MANUFACTURABLE_EXPRESS", "MANUFACTURABLE_STOCKED", "MANUFACTURABLE_ON_DEMAND",
            "SERVICE", "SUBSCRIPTION", "INPUT", "STORABLE", "CONSUMABLE",
        ]
        for (const segment of segments) expect(SEGMENT_LABELS[segment]).toBeTruthy()
    })
})
