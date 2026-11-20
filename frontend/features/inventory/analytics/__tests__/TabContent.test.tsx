import { render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { ProductCapabilities } from "../productAnalyticsRegistry"

vi.mock("../LegacyInsightsPanel", () => ({
    LegacyInsightsPanel: ({ tab }: { tab: string }) => <div data-marker={`legacy-${tab}`} />,
}))
vi.mock("../CostsBlock", () => ({ CostsBlock: () => <div data-marker="block-costs" /> }))
vi.mock("../SalesBlock", () => ({ SalesBlock: () => <div data-marker="block-sales" /> }))
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

    it("a manufactured component used in production shows input usage only in production", () => {
        const caps = { manufactures: true, used_in_production: true }
        expect(markers("costs", caps)).toEqual(["block-costs"])
        expect(markers("production", caps)).toContain("block-sourcing-used_in")
        expect(markers("production", caps)).not.toContain("block-sourcing-make_vs_buy")
    })
    it("subscription shows only the operations block", () => {
        expect(markers("subscription", { recurring: true })).toEqual(["block-operations"])
    })
})

describe("tabHasLegacyContent", () => {
    it("is true for every tab except the migrated ones", () => {
        const tabs: ProductAnalyticsTabId[] = ["overview", "procurement", "inventory", "production"]
        for (const tab of tabs) expect(tabHasLegacyContent(tab)).toBe(true)
        expect(tabHasLegacyContent("pricing")).toBe(false)
        expect(tabHasLegacyContent("sales")).toBe(false)
        expect(tabHasLegacyContent("costs")).toBe(false)
        expect(tabHasLegacyContent("subscription")).toBe(false)
    })
})
