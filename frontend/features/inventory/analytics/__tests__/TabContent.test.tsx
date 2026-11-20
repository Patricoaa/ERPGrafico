import { render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { ProductCapabilities } from "../productAnalyticsRegistry"

vi.mock("../OverviewBlock", () => ({ OverviewBlock: () => <div data-marker="block-overview" /> }))
vi.mock("../CostsBlock", () => ({ CostsBlock: () => <div data-marker="block-costs" /> }))
vi.mock("../ProcurementBlock", () => ({ ProcurementBlock: () => <div data-marker="block-procurement" /> }))
vi.mock("../SalesBlock", () => ({ SalesBlock: () => <div data-marker="block-sales" /> }))
vi.mock("../PricingBlock", () => ({ PricingBlock: () => <div data-marker="block-pricing" /> }))
vi.mock("../ProductionBlock", () => ({ ProductionBlock: () => <div data-marker="block-production" /> }))
vi.mock("../StockBlock", () => ({ StockBlock: () => <div data-marker="block-stock" /> }))
vi.mock("../SubscriptionBlock", () => ({ SubscriptionBlock: () => <div data-marker="block-subscription" /> }))

import { TabContent } from "../TabContent"
import type { ProductAnalyticsTabId } from "../productAnalyticsRegistry"

const BASE: ProductCapabilities = {
    sells: false, buys: false, tracks_stock: false, manufactures: false, express: false,
    recurring: false, used_in_production: false, has_variants: false, segment: "STORABLE",
}

function markers(tab: ProductAnalyticsTabId, overrides: Partial<ProductCapabilities> = {}) {
    const { container } = render(
        <TabContent
            tab={tab} productId={7} period="12m" capabilities={{ ...BASE, ...overrides }}
            onSelectTab={() => {}}
        />,
    )
    return Array.from(container.querySelectorAll("[data-marker]")).map((e) => e.getAttribute("data-marker"))
}

describe("TabContent", () => {
    it("overview renders the overview block", () => {
        expect(markers("overview")).toEqual(["block-overview"])
    })

    it("sales renders only its own block, with no legacy content", () => {
        expect(markers("sales", { sells: true })).toEqual(["block-sales"])
    })

    it("pricing renders only its own block, with no legacy content", () => {
        expect(markers("pricing", { sells: true })).toEqual(["block-pricing"])
    })

    it("costs renders only its own block, with no legacy content nor make-vs-buy", () => {
        expect(markers("costs", { buys: true })).toEqual(["block-costs"])
        expect(markers("costs", { manufactures: true })).toEqual(["block-costs"])
    })

    it("procurement renders only its own block, with no legacy content", () => {
        expect(markers("procurement", { buys: true })).toEqual(["block-procurement"])
    })

    it("inventory renders only its own block, with no legacy content", () => {
        expect(markers("inventory", { tracks_stock: true })).toEqual(["block-stock"])
    })

    it("production renders only its own block, with no legacy content", () => {
        expect(markers("production", { used_in_production: true })).toEqual(["block-production"])
        expect(markers("production", { manufactures: true })).toEqual(["block-production"])
    })

    it("a manufactured component used in production shows its analysis only in production", () => {
        const caps = { manufactures: true, used_in_production: true }
        expect(markers("costs", caps)).toEqual(["block-costs"])
        expect(markers("production", caps)).toEqual(["block-production"])
    })

    it("subscription renders only its own block", () => {
        expect(markers("subscription", { recurring: true })).toEqual(["block-subscription"])
    })
})

describe("TabContent without legacy content", () => {
    it("never mounts the legacy insights panel", () => {
        const tabs: ProductAnalyticsTabId[] = ["overview", "sales", "pricing", "costs", "procurement", "inventory", "production", "subscription"]
        const all = { sells: true, buys: true, tracks_stock: true, manufactures: true, recurring: true, used_in_production: true }
        for (const tab of tabs) expect(markers(tab, all).some((m) => m?.startsWith("legacy-"))).toBe(false)
    })
})
