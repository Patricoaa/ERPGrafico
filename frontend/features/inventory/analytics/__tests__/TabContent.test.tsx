import { render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { ProductCapabilities } from "../productAnalyticsRegistry"

vi.mock("../LegacyInsightsPanel", () => ({
    LegacyInsightsPanel: ({ tab }: { tab: string }) => <div data-marker={`legacy-${tab}`} />,
}))
vi.mock("../PricingBlock", () => ({ PricingBlock: () => <div data-marker="block-pricing" /> }))
vi.mock("../ProductionPerformanceBlock", () => ({ ProductionPerformanceBlock: () => <div data-marker="block-performance" /> }))
vi.mock("../OperationsBlock", () => ({ OperationsBlock: () => <div data-marker="block-operations" /> }))
vi.mock("../SourcingBlock", () => ({
    SourcingBlock: ({ section }: { section?: string }) => <div data-marker={`block-sourcing-${section ?? "all"}`} />,
}))

import { TabContent, tabHasLegacyContent } from "../TabContent"
import type { ProductAnalyticsTabId } from "../productAnalyticsRegistry"

const BASE: ProductCapabilities = {
    sells: false, buys: false, tracks_stock: false, manufactures: false, express: false,
    recurring: false, used_in_production: false, has_variants: false, segment: "STORABLE",
}

function markers(tab: ProductAnalyticsTabId, overrides: Partial<ProductCapabilities> = {}) {
    const { container } = render(
        <TabContent
            tab={tab} productId={7} period="12m" capabilities={{ ...BASE, ...overrides }}
            onOpenTransaction={() => {}} onOpenWorkOrder={() => {}}
        />,
    )
    return Array.from(container.querySelectorAll("[data-marker]")).map((e) => e.getAttribute("data-marker"))
}

describe("TabContent", () => {
    it("overview shows the legacy overview", () => {
        expect(markers("overview")).toEqual(["legacy-overview"])
    })

    it("sales stacks sales and customers", () => {
        expect(markers("sales", { sells: true })).toEqual(["legacy-sales", "legacy-customers"])
    })

    it("pricing renders only its own block, with no legacy content", () => {
        expect(markers("pricing", { sells: true })).toEqual(["block-pricing"])
    })

    it("costs shows the cost history", () => {
        expect(markers("costs", { buys: true })).toEqual(["legacy-cost"])
    })

    it("costs adds make-vs-buy only when the product is manufactured and bought", () => {
        expect(markers("costs", { manufactures: true, buys: true })).toEqual(["legacy-cost", "block-sourcing-make_vs_buy"])
        expect(markers("costs", { manufactures: true })).toEqual(["legacy-cost"])
    })

    it("procurement stacks purchases and suppliers", () => {
        expect(markers("procurement", { buys: true })).toEqual(["legacy-purchases", "legacy-suppliers"])
    })

    it("inventory stacks movements and rotation", () => {
        expect(markers("inventory", { tracks_stock: true })).toEqual(["legacy-kardex", "block-operations"])
    })

    it("production shows consumption, plus performance if manufactured and input usage if used in production", () => {
        expect(markers("production", { used_in_production: true })).toEqual(["legacy-production", "block-sourcing-used_in"])
        expect(markers("production", { manufactures: true })).toEqual(["legacy-production", "block-performance"])
    })

    it("a manufactured, bought component shows make-vs-buy only in costs and input usage only in production", () => {
        const caps = { manufactures: true, buys: true, used_in_production: true }
        const costs = markers("costs", caps)
        const production = markers("production", caps)
        expect(costs).toContain("block-sourcing-make_vs_buy")
        expect(costs).not.toContain("block-sourcing-used_in")
        expect(production).toContain("block-sourcing-used_in")
        expect(production).not.toContain("block-sourcing-make_vs_buy")
    })

    it("subscription shows only the operations block", () => {
        expect(markers("subscription", { recurring: true })).toEqual(["block-operations"])
    })
})

describe("tabHasLegacyContent", () => {
    it("is true for every tab except pricing and subscription", () => {
        const tabs: ProductAnalyticsTabId[] = ["overview", "sales", "costs", "procurement", "inventory", "production"]
        for (const tab of tabs) expect(tabHasLegacyContent(tab)).toBe(true)
        expect(tabHasLegacyContent("pricing")).toBe(false)
        expect(tabHasLegacyContent("subscription")).toBe(false)
    })
})
