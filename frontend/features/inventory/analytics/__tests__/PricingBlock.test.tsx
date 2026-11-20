import { render, screen, within } from "@testing-library/react"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import type { PricingEffect, ProductPricing } from "../pricing.types"

const state = vi.hoisted(() => ({
    data: null as unknown,
    isLoading: false,
    isError: false,
    usePricing: vi.fn(),
    lineProps: [] as Array<{ markers?: Array<{ value: string }>; data: Array<{ id: string }> }>,
}))

vi.mock("../../hooks/useProductPricing", () => ({
    useProductPricing: (id: number, params: unknown) => {
        state.usePricing(id, params)
        return { data: state.data, isLoading: state.isLoading, isError: state.isError }
    },
}))
vi.mock("../SalesImpactBlock", () => ({
    SalesImpactBlock: ({ defaultGroupBy }: { defaultGroupBy?: string }) => <div>desglose-{defaultGroupBy}</div>,
}))
vi.mock("@/components/shared", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/components/shared")>()),
    LineChart: (props: { markers?: Array<{ value: string }>; data: Array<{ id: string }> }) => {
        state.lineProps.push(props)
        return <div data-testid="line-chart" />
    },
    BarChart: () => <div data-testid="bar-chart" />,
}))

import { PricingBlock } from "../PricingBlock"

const effect = (over: Partial<PricingEffect> = {}): PricingEffect => ({
    kind: "list_price", label: "Precio de lista 1000 → 1200", date: "2026-03-01", period: "2026-03", reliable: true,
    before: { days: 28, units: 10, units_per_day: 0.36, revenue_per_day: 357, margin_per_unit: 600 },
    after: { days: 28, units: 20, units_per_day: 0.71, revenue_per_day: 857, margin_per_unit: 800 },
    ...over,
})

function pricing(over: Partial<ProductPricing> = {}): ProductPricing {
    return {
        has_cost: true,
        today: { list_price_net: 1000, list_price_gross: 1190, cost: 400, list_margin_pct: 60 },
        kpis: {
            margin_pct: 58, net_revenue: 100000, units: 100, avg_price: 1000, avg_discount_pct: 4, foregone_revenue: 0,
            previous: { margin_pct: 50, net_revenue: 80000, units: 80, avg_price: 1000, avg_discount_pct: 4, foregone_revenue: 0 },
        },
        series: {
            points: [
                { period: "2026-02", units: 10, net_revenue: 10000, avg_price: 1000, avg_list_price: 1000, avg_cost: 400, margin_pct: 60 },
                { period: "2026-03", units: 20, net_revenue: 20000, avg_price: 1000, avg_list_price: 1200, avg_cost: 400, margin_pct: 60 },
            ],
            by_rule: [{ period: "2026-03", key: "7", label: "Mayorista", units: 5, avg_price: 900 }],
        },
        list_price_changes: { baseline: 1000, changes: [{ date: "2026-03-01", period: "2026-03", from: 1000, to: 1200 }] },
        rule_windows: [],
        effects: [effect()],
        ...over,
    }
}

beforeAll(() => {
    globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} }
})
beforeEach(() => {
    state.data = pricing()
    state.isLoading = false
    state.isError = false
    state.lineProps = []
    state.usePricing.mockClear()
})

const caps = { has_variants: false }

describe("PricingBlock", () => {
    it("shows realized margin as the hero metric when there is a cost base", () => {
        render(<PricingBlock productId={7} period="12m" capabilities={caps} />)
        expect(screen.getByText("Margen realizado")).toBeInTheDocument()
        expect(screen.queryByText("Precio realizado")).not.toBeInTheDocument()
        expect(screen.getByText("Margen de lista")).toBeInTheDocument()
    })

    it("shows realized price as the hero without a cost base and no margin metrics", () => {
        state.data = pricing({ has_cost: false, today: { list_price_net: 1000, list_price_gross: 1190, cost: 0, list_margin_pct: null } })
        render(<PricingBlock productId={7} period="12m" capabilities={caps} />)
        expect(screen.getByText("Precio realizado")).toBeInTheDocument()
        expect(screen.queryByText("Margen realizado")).not.toBeInTheDocument()
        expect(screen.queryByText("Margen de lista")).not.toBeInTheDocument()
    })

    it("lists the findings returned by the composition", () => {
        state.data = pricing({ kpis: { ...pricing().kpis, foregone_revenue: 10000 } })
        render(<PricingBlock productId={7} period="12m" capabilities={caps} />)
        expect(screen.getByRole("list", { name: "Hallazgos" })).toBeInTheDocument()
        expect(screen.getByText(/ingreso no percibido/i)).toBeInTheDocument()
    })

    it("lists the before/after effects and marks unreliable ones", () => {
        state.data = pricing({ effects: [effect(), effect({ label: "Regla Promo (inicio)", kind: "rule", reliable: false })] })
        render(<PricingBlock productId={7} period="12m" capabilities={caps} />)
        expect(screen.getByText("Precio de lista 1000 → 1200")).toBeInTheDocument()
        expect(screen.getByText("Regla Promo (inicio)")).toBeInTheDocument()
        expect(screen.getAllByText("Pocos datos")).toHaveLength(1)
    })

    it("shows the empty state with today's figures when there are no sales", () => {
        state.data = pricing({ series: { points: [], by_rule: [] }, effects: [] })
        render(<PricingBlock productId={7} period="12m" capabilities={caps} />)
        expect(screen.getByText("Sin ventas en el periodo")).toBeInTheDocument()
        expect(screen.getByText("Margen de lista")).toBeInTheDocument()
        expect(screen.queryByTestId("line-chart")).not.toBeInTheDocument()
    })

    it("shows the skeleton while loading", () => {
        state.data = null
        state.isLoading = true
        render(<PricingBlock productId={7} period="12m" capabilities={caps} />)
        expect(screen.getByLabelText("Cargando análisis del producto")).toBeInTheDocument()
    })

    it("draws only the markers whose period is in the series", () => {
        state.data = pricing({
            effects: [effect(), effect({ period: "2025-01", date: "2025-01-05", label: "Fuera de la serie" })],
        })
        render(<PricingBlock productId={7} period="12m" capabilities={caps} />)
        const markers = state.lineProps.at(-1)?.markers ?? []
        expect(markers.map((m) => m.value)).toEqual(["2026-03"])
    })

    it("draws list, realized and per-rule price lines", () => {
        render(<PricingBlock productId={7} period="12m" capabilities={caps} />)
        expect(state.lineProps.at(-1)?.data.map((s) => s.id)).toEqual(["Precio de lista", "Precio realizado", "Mayorista"])
    })

    it("groups the breakdown by variant for products with variants", () => {
        render(<PricingBlock productId={7} period="12m" capabilities={{ has_variants: true }} />)
        expect(screen.getByText("desglose-variant")).toBeInTheDocument()
    })

    it("asks the endpoint with the period's granularity and date_from, none for the history", () => {
        const { rerender } = render(<PricingBlock productId={7} period="3m" capabilities={caps} />)
        const last = () => state.usePricing.mock.calls.at(-1)?.[1] as { granularity: string; date_from?: string }
        expect(last().granularity).toBe("week")
        expect(last().date_from).toBeDefined()
        rerender(<PricingBlock productId={7} period="all" capabilities={caps} />)
        expect(last()).toEqual({ granularity: "year", date_from: undefined })
    })

    it("keeps the correlation disclaimer", () => {
        render(<PricingBlock productId={7} period="12m" capabilities={caps} />)
        expect(screen.getByText(/asociación, no causalidad/)).toBeInTheDocument()
        within(document.body)
    })
})
