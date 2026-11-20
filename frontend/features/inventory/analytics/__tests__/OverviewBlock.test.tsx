import { fireEvent, render, screen } from "@testing-library/react"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import type { ProductCapabilities } from "../productAnalyticsRegistry"

type HookState = { data: unknown; isLoading: boolean; isError: boolean }
const state = vi.hoisted(() => ({
    hooks: {} as Record<string, HookState>,
    calls: {} as Record<string, Array<[number | null | undefined, unknown]>>,
}))

function mockHook(name: string) {
    return (id: number | null | undefined, params: unknown) => {
        ;(state.calls[name] ??= []).push([id, params])
        return state.hooks[name] ?? { data: null, isLoading: false, isError: false }
    }
}
vi.mock("../../hooks/useProductSales", () => ({ useProductSales: mockHook("sales") }))
vi.mock("../../hooks/useProductPricing", () => ({ useProductPricing: mockHook("pricing") }))
vi.mock("../../hooks/useProductCosts", () => ({ useProductCosts: mockHook("costs") }))
vi.mock("../../hooks/useProductProcurement", () => ({ useProductProcurement: mockHook("procurement") }))
vi.mock("../../hooks/useProductStockAnalysis", () => ({ useProductStockAnalysis: mockHook("inventory") }))
vi.mock("../../hooks/useProductProductionAnalysis", () => ({ useProductProductionAnalysis: mockHook("production") }))
vi.mock("../../hooks/useProductSubscriptionAnalysis", () => ({ useProductSubscriptionAnalysis: mockHook("subscription") }))

import { OverviewBlock } from "../OverviewBlock"

const caps = (over: Partial<ProductCapabilities> = {}): ProductCapabilities => ({
    sells: true, buys: true, tracks_stock: false, manufactures: false, express: false, recurring: false,
    used_in_production: false, has_variants: false, segment: "STORABLE", ...over,
})
const sales = {
    kpis: { units: 120, net_revenue: 50000, customers: 4, return_units: 0, return_rate_pct: 0, last_sale_date: null, days_since_last_sale: null, previous: null },
    series: { points: [], previous_points: [] }, customers: { total: 4, top3_share_pct: 50, top: [] }, channels: [], variants: [], uoms: [],
}
const costs = {
    mode: "purchased",
    today: { weighted_cost: 400, bom_cost: null, last_purchase: null, stock_qty: null, stock_value: null },
    kpis: { cost_change_pct: 12, replacement_gap_pct: null },
    series: [], purchases: { min: null, max: null, avg: null, count: 0 }, bom: null, work_orders: [],
}

beforeAll(() => {
    globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} }
})
beforeEach(() => {
    state.hooks = {}
    state.calls = {}
})

const render_ = (onSelectTab = vi.fn(), capabilities = caps()) =>
    render(<OverviewBlock productId={7} period="12m" capabilities={capabilities} onSelectTab={onSelectTab} />)

describe("OverviewBlock", () => {
    it("queries only the visible tabs", () => {
        render_()
        expect(state.calls.sales.at(-1)?.[0]).toBe(7)
        expect(state.calls.costs.at(-1)?.[0]).toBe(7)
        expect(state.calls.inventory.at(-1)?.[0]).toBeNull()
        expect(state.calls.production.at(-1)?.[0]).toBeNull()
        expect(state.calls.subscription.at(-1)?.[0]).toBeNull()
    })

    it("passes the period's granularity and date_from to every source", () => {
        render_()
        expect(state.calls.sales.at(-1)?.[1]).toMatchObject({ granularity: "month" })
        expect((state.calls.sales.at(-1)?.[1] as { date_from?: string }).date_from).toBeDefined()
        expect(state.calls.inventory.at(-1)?.[1]).toMatchObject({ idle_days: 90 })
        expect(state.calls.production.at(-1)?.[1]).toMatchObject({ increase_pct: 10 })
    })

    it("shows one card per source with data", () => {
        state.hooks.sales = { data: sales, isLoading: false, isError: false }
        state.hooks.costs = { data: costs, isLoading: false, isError: false }
        render_()
        expect(screen.getByText("Unidades vendidas")).toBeInTheDocument()
        expect(screen.getByText("Costo ponderado")).toBeInTheDocument()
    })

    it("shows a loading card and an error card without hiding the others", () => {
        state.hooks.sales = { data: sales, isLoading: false, isError: false }
        state.hooks.pricing = { data: null, isLoading: true, isError: false }
        state.hooks.costs = { data: null, isLoading: false, isError: true }
        render_()
        expect(screen.getByText("Unidades vendidas")).toBeInTheDocument()
        expect(screen.getByLabelText("Cargando Precio y margen")).toBeInTheDocument()
        expect(screen.getByText("No se pudo cargar Costos")).toBeInTheDocument()
    })

    it("groups findings by tab and opens the tab from its button", () => {
        state.hooks.costs = { data: costs, isLoading: false, isError: false }
        const onSelectTab = vi.fn()
        render_(onSelectTab)
        const group = screen.getByRole("region", { name: "Hallazgos de Costos" })
        expect(group).toHaveTextContent(/subió 12[,.]0 %/)
        fireEvent.click(screen.getAllByRole("button", { name: "Ver en Costos" })[0])
        expect(onSelectTab).toHaveBeenCalledWith("costs")
    })

    it("says there are no findings", () => {
        state.hooks.sales = { data: sales, isLoading: false, isError: false }
        render_()
        expect(screen.getByText("Sin hallazgos en el periodo")).toBeInTheDocument()
    })
})
