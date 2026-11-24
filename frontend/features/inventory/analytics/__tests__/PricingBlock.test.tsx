import { render, screen, within } from "@testing-library/react"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import type { PricingRuleWindow, ProductPricing } from "../pricing.types"

const state = vi.hoisted(() => ({
    data: null as unknown,
    isLoading: false,
    isError: false,
    usePricing: vi.fn(),
}))

vi.mock("@/hooks/useVatRate", () => ({ useVatRate: () => ({ rate: 19, multiplier: 1.19, isLoading: false }) }))
vi.mock("../../hooks/useProductPricing", () => ({
    useProductPricing: (id: number, params: unknown) => {
        state.usePricing(id, params)
        return { data: state.data, isLoading: state.isLoading, isError: state.isError }
    },
}))

vi.mock("@/components/shared", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/components/shared")>()),
    DualAxisChart: (props: { series: Array<{ id: string; label: string }> }) => (
        <div data-testid="dual-axis-chart">
            {props.series.map((s) => (
                <span key={s.id}>{s.label}</span>
            ))}
        </div>
    ),
}))

import { PricingBlock } from "../PricingBlock"

const sampleRule: PricingRuleWindow = {
    rule_id: 12,
    name: "Descuento Mayorista",
    start: "2026-01-01",
    end: "2026-12-31",
    rule_type: "DISCOUNT_PERCENTAGE",
    fixed_price: 0,
    fixed_price_gross: 0,
    discount_percentage: 15,
    condition: "Mayor o Igual (>=) 10",
}

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
                { period: "2026-02", units: 10, net_revenue: 10000, avg_price: 1000, avg_list_price: 1000, avg_list_price_gross: 1190, avg_cost: 400, margin_pct: 60 },
                { period: "2026-03", units: 20, net_revenue: 20000, avg_price: 1000, avg_list_price: 1200, avg_list_price_gross: 1428, avg_cost: 400, margin_pct: 60 },
            ],
            by_rule: [
                { period: "2026-03", key: "list", label: "Precio de lista", units: 15, avg_price: 1200, avg_price_gross: 1428, net_revenue: 18000 },
                { period: "2026-03", key: "12", label: "Descuento Mayorista", units: 5, avg_price: 1020, avg_price_gross: 1214, net_revenue: 5100 },
            ],
        },
        list_price_changes: { baseline: 1000, changes: [{ date: "2026-03-01", period: "2026-03", from: 1000, to: 1200 }] },
        rule_windows: [sampleRule],
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
    state.usePricing.mockClear()
})

const caps = { has_variants: false }

describe("PricingBlock", () => {
    it("shows current gross price and active rule KPIs with progress visual without unit cost", () => {
        render(<PricingBlock productId={7} period="12m" capabilities={caps} />)
        expect(screen.getByText("Precio actual (c/IVA)")).toBeInTheDocument()
        expect(screen.getAllByText("Descuento Mayorista").length).toBeGreaterThanOrEqual(1)
        expect(screen.getByText("15.0% dto · Mayor o Igual (>=) 10")).toBeInTheDocument()
        expect(screen.queryByText("Costo unitario")).not.toBeInTheDocument()
    })

    it("does not render Costo unitario KPI even when product has cost base", () => {
        render(<PricingBlock productId={7} period="12m" capabilities={caps} />)
        expect(screen.queryByText("Costo unitario")).not.toBeInTheDocument()
    })

    it("lists findings returned by composition", () => {
        state.data = pricing({ kpis: { ...pricing().kpis, foregone_revenue: 10000 } })
        render(<PricingBlock productId={7} period="12m" capabilities={caps} />)
        expect(screen.getByRole("list", { name: "Hallazgos" })).toBeInTheDocument()
        expect(screen.getByText(/ingreso no percibido/i)).toBeInTheDocument()
    })

    it("renders dual axis chart with price and sales series", () => {
        render(<PricingBlock productId={7} period="12m" capabilities={caps} />)
        expect(screen.getByText("Evolución de precios y ventas asociadas")).toBeInTheDocument()
        expect(screen.getByTestId("dual-axis-chart")).toBeInTheDocument()
        expect(screen.getByText("Precio de lista")).toBeInTheDocument()
        expect(screen.getByText("Ventas Lista")).toBeInTheDocument()
    })

    it("shows empty state when there are no sales in the period", () => {
        state.data = pricing({ series: { points: [], by_rule: [] } })
        render(<PricingBlock productId={7} period="12m" capabilities={caps} />)
        expect(screen.getByText("Sin ventas en el periodo")).toBeInTheDocument()
        expect(screen.queryByTestId("dual-axis-chart")).not.toBeInTheDocument()
    })

    it("does not render historical effects section", () => {
        render(<PricingBlock productId={7} period="12m" capabilities={caps} />)
        expect(screen.queryByText("Efecto histórico de cambios de precio")).not.toBeInTheDocument()
        expect(screen.queryByRole("region", { name: "Antes vs después" })).not.toBeInTheDocument()
    })

    it("shows skeleton while loading", () => {
        state.data = null
        state.isLoading = true
        render(<PricingBlock productId={7} period="12m" capabilities={caps} />)
        expect(screen.getByLabelText("Cargando análisis del producto")).toBeInTheDocument()
    })

    it("asks the endpoint with period granularity and date_from", () => {
        const { rerender } = render(<PricingBlock productId={7} period="3m" capabilities={caps} />)
        const last = () => state.usePricing.mock.calls.at(-1)?.[1] as { granularity: string; date_from?: string }
        expect(last().granularity).toBe("week")
        expect(last().date_from).toBeDefined()
        rerender(<PricingBlock productId={7} period="all" capabilities={caps} />)
        expect(last()).toEqual({ granularity: "year", date_from: undefined })
    })

    it("keeps correlation disclaimer", () => {
        render(<PricingBlock productId={7} period="12m" capabilities={caps} />)
        expect(screen.getByText(/asociación, no causalidad/)).toBeInTheDocument()
        within(document.body)
    })
})
