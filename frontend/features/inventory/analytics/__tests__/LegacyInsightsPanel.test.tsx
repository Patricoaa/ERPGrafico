import { render, screen } from "@testing-library/react"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import type { ProductCapabilities } from "../productAnalyticsRegistry"

const state = vi.hoisted(() => ({ isLoading: false }))

vi.mock("../../hooks/useProducts", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../../hooks/useProducts")>()),
    useProductInsights: () => ({
        isLoading: state.isLoading,
        insights: state.isLoading ? null : {
            price_history: [], stock_history: [], production_usage: [], production_history: [],
            top_customers: [], top_suppliers: [],
            stock_flow: { totals: { in_qty: 5, in_cost: 50, out_qty: 2, out_cost: 20 }, monthly: [] },
            sales_analysis: { history: [], avg_price: 0, avg_cost: 0, total_sold: 0, total_revenue: 1000, total_cost_basis: 400 },
            purchase_analysis: { history: [], total_purchased: 0, total_cost: 0 },
        },
    }),
    useProduct: (id: number) => ({
        isLoading: false,
        product: { id, uom_name: "un", current_stock: 3, cost_price: 10, sale_price: 100, sale_price_gross: 119 },
    }),
}))
vi.mock("@/features/inventory/hooks/useStockMoves", () => ({
    useStockMoves: () => ({ page: { results: [], count: 0 }, isLoading: false }),
}))

import { LegacyInsightsPanel } from "../LegacyInsightsPanel"

const CAPS: ProductCapabilities = {
    sells: true, buys: true, tracks_stock: true, manufactures: false, express: false,
    recurring: false, used_in_production: false, has_variants: false, segment: "STORABLE",
}

const renderTab = (tab: Parameters<typeof LegacyInsightsPanel>[0]["tab"]) =>
    render(
        <LegacyInsightsPanel
            productId={7} tab={tab} capabilities={CAPS}
            onOpenTransaction={() => {}} onOpenWorkOrder={() => {}}
        />,
    )

beforeAll(() => {
    globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} }
})
beforeEach(() => { state.isLoading = false })

describe("LegacyInsightsPanel", () => {
    it("renders only the content of the requested tab", () => {
        renderTab("sales")
        expect(screen.getByText("Total Ingresos")).toBeInTheDocument()
        expect(screen.queryByText("Costo Actual")).not.toBeInTheDocument()
    })

    it("renders the movements tab with its in/out totals", () => {
        renderTab("kardex")
        expect(screen.getByText("Total Entradas")).toBeInTheDocument()
        expect(screen.getByText("Total Salidas")).toBeInTheDocument()
    })

    it("shows the skeleton while the insights load", () => {
        state.isLoading = true
        renderTab("sales")
        expect(screen.getByLabelText("Cargando análisis del producto")).toBeInTheDocument()
        expect(screen.queryByText("Total Ingresos")).not.toBeInTheDocument()
    })
})
