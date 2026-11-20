import { fireEvent, render, screen } from "@testing-library/react"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import type { ProductionInput, ProductionMade, ProductProductionAnalysis } from "../productionAnalysis.types"

type LineSeries = { id: string; data: Array<{ x: string; y: number }> }

const state = vi.hoisted(() => ({
    data: null as unknown,
    isLoading: false,
    isError: false,
    useProduction: vi.fn(),
    lines: [] as Array<{ data: LineSeries[]; ariaLabel?: string }>,
}))

vi.mock("../../hooks/useProductProductionAnalysis", () => ({
    useProductProductionAnalysis: (id: number, params: unknown) => {
        state.useProduction(id, params)
        return { data: state.data, isLoading: state.isLoading, isError: state.isError }
    },
}))
vi.mock("@/components/shared", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/components/shared")>()),
    LineChart: (props: { data: LineSeries[]; ariaLabel?: string }) => {
        state.lines.push(props)
        return <div data-testid="line-chart" />
    },
}))

import { ProductionBlock } from "../ProductionBlock"

const MADE: ProductionMade = {
    kpis: { orders: 5, units: 50, rectified: 1, rectification_rate: 20, previous: { orders: 4, units: 40 } },
    series: {
        points: [{ period: "2026-10", orders: 2, units: 20 }, { period: "2026-11", orders: 3, units: 30 }],
        previous_points: [{ period: "2026-10", orders: 2, units: 15 }],
    },
    materials: [{ component_id: 1, name: "Papel couché", planned_qty: 100, consumed_qty: 115, deviation_qty: 15, deviation_pct: 15 }],
    orders: [{ id: 3, number: "OT-0003", date: "2026-11-05", units: 10, rectified: true }],
}
const INPUT: ProductionInput = {
    kpis: { consumed: 80, orders: 4, previous: { consumed: 100, orders: 5 } },
    series: { points: [{ period: "2026-11", consumed: 80 }], previous_points: [] },
    by_product: [{ product_id: 9, name: "Tarjeta de visita", qty: 80, share_pct: 100 }],
    used_in: {
        increase_pct: 10,
        parents: [{
            product_id: 9, name: "Tarjeta de visita", qty_per_unit: 2, component_cost: 20, bom_cost: 100, share_pct: 20,
            delta_cost: 2, delta_pct: 2, price_net: 120, margin_pct: 16, margin_pct_after: 14,
        }],
    },
}
const data = (over: Partial<ProductProductionAnalysis>): ProductProductionAnalysis => ({ made: null, input: null, ...over })

beforeAll(() => {
    globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} }
})
beforeEach(() => {
    state.data = data({ made: MADE })
    state.isLoading = false
    state.isError = false
    state.lines = []
    state.useProduction.mockClear()
})

describe("ProductionBlock", () => {
    it("shows the manufactured role: orders, units with change and rework", () => {
        render(<ProductionBlock productId={7} period="12m" />)
        expect(screen.getByText("Unidades producidas")).toBeInTheDocument()
        expect(screen.getByText(/25[,.]0\s?%/)).toBeInTheDocument()
        expect(screen.getByText("Rectificadas")).toBeInTheDocument()
        expect(state.lines.at(-1)?.data.map((s) => s.id)).toEqual(["Unidades", "Período anterior"])
    })

    it("lists inputs consumed against plan and finished orders", () => {
        render(<ProductionBlock productId={7} period="12m" />)
        expect(screen.getByRole("region", { name: "Insumos" })).toBeInTheDocument()
        expect(screen.getByText("Papel couché")).toBeInTheDocument()
        expect(screen.getByRole("region", { name: "Órdenes terminadas" })).toBeInTheDocument()
        expect(screen.getByText("Rectificada")).toBeInTheDocument()
    })

    it("shows the input role: consumption, by product and products that use it", () => {
        state.data = data({ input: INPUT })
        render(<ProductionBlock productId={7} period="12m" />)
        expect(screen.getByText("Consumo en OT")).toBeInTheDocument()
        expect(screen.getByRole("region", { name: "Por producto" })).toBeInTheDocument()
        expect(screen.getByRole("region", { name: "Productos que lo usan" })).toBeInTheDocument()
        expect(screen.queryByText("Unidades producidas")).not.toBeInTheDocument()
    })

    it("shows both roles, manufactured first", () => {
        state.data = data({ made: MADE, input: INPUT })
        render(<ProductionBlock productId={7} period="12m" />)
        const regions = screen.getAllByRole("region").map((r) => r.getAttribute("aria-label"))
        expect(regions.indexOf("Insumos")).toBeLessThan(regions.indexOf("Por producto"))
    })

    it("offers the price increase control only for the input role and asks again with it", () => {
        const { unmount } = render(<ProductionBlock productId={7} period="12m" />)
        expect(screen.queryByRole("radio", { name: "20 %" })).not.toBeInTheDocument()
        unmount()
        state.data = data({ input: INPUT })
        render(<ProductionBlock productId={7} period="12m" />)
        fireEvent.click(screen.getByRole("radio", { name: "20 %" }))
        expect(state.useProduction.mock.calls.at(-1)?.[1]).toMatchObject({ increase_pct: 20 })
    })

    it("lists the findings", () => {
        render(<ProductionBlock productId={7} period="12m" />)
        const list = screen.getByRole("list", { name: "Hallazgos" })
        expect(list).toHaveTextContent(/rectificó/)
        expect(list).toHaveTextContent(/Papel couché/)
    })

    it("says there was no production in the period", () => {
        state.data = data({
            made: { ...MADE, kpis: { ...MADE.kpis, orders: 0, units: 0, rectified: 0, rectification_rate: 0 },
                series: { points: [], previous_points: [] }, materials: [], orders: [] },
        })
        render(<ProductionBlock productId={7} period="12m" />)
        expect(screen.getByText("Sin producción en el periodo")).toBeInTheDocument()
        expect(screen.queryByTestId("line-chart")).not.toBeInTheDocument()
    })

    it("shows the skeleton while loading", () => {
        state.data = null
        state.isLoading = true
        render(<ProductionBlock productId={7} period="12m" />)
        expect(screen.getByLabelText("Cargando análisis del producto")).toBeInTheDocument()
    })

    it("asks the endpoint with the period's granularity and no date_from for the history", () => {
        const { rerender } = render(<ProductionBlock productId={7} period="3m" />)
        const last = () => state.useProduction.mock.calls.at(-1)?.[1] as { granularity: string; date_from?: string }
        expect(last().granularity).toBe("week")
        rerender(<ProductionBlock productId={7} period="all" />)
        expect(last()).toEqual({ granularity: "year", date_from: undefined, increase_pct: 10 })
    })

    it("shows no times nor costs", () => {
        state.data = data({ made: MADE, input: INPUT })
        render(<ProductionBlock productId={7} period="12m" />)
        expect(screen.queryByText(/lead time|costo real|por etapa/i)).not.toBeInTheDocument()
    })
})
