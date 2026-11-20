import { fireEvent, render, screen } from "@testing-library/react"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import type { ProductionPerformance, ProductionPerformanceParams } from "../productionPerformance.types"

const state = vi.hoisted(() => ({
    data: null as unknown,
    isLoading: false,
    isError: false,
    usePerf: vi.fn(),
}))

vi.mock("../../hooks/useProductProductionPerformance", () => ({
    useProductProductionPerformance: (id: number, params: unknown) => {
        state.usePerf(id, params)
        return { data: state.data, isLoading: state.isLoading, isError: state.isError }
    },
}))
vi.mock("@/components/shared", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/components/shared")>()),
    AnalyticsChart: (props: { data: Array<Record<string, unknown>> }) => (
        <div data-testid="stage-chart" data-rows={props.data.length} />
    ),
}))

import { ProductionPerformanceBlock } from "../ProductionPerformanceBlock"

const PERF: ProductionPerformance = {
    kpis: { orders: 2, unit_real_cost: 30, bom_cost: 24, bom_gap_pct: 25, deviation_pct: 10, lead_time_days: 4.5, rectification_rate: 50 },
    orders: [
        { id: 1, number: "OT-0001", date: "2026-03-10", qty: 10, planned_cost: 200, real_cost: 240, deviation: 40, deviation_pct: 20, revenue: 500, margin: 260, estimated: false },
        { id: 2, number: "OT-0002", date: "2026-03-12", qty: 5, planned_cost: 100, real_cost: 100, deviation: 0, deviation_pct: 0, revenue: null, margin: null, estimated: true },
    ],
    materials: [{ component_id: 9, name: "Papel Couché", planned_qty: 10, consumed_qty: 12, planned_cost: 200, real_cost: 240, deviation: 40 }],
    stages: [{ stage: "PRESS", label: "Impresión", avg_days: 2, orders: 2 }],
}

beforeAll(() => {
    globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} }
})
beforeEach(() => {
    vi.clearAllMocks()
    state.data = PERF
    state.isLoading = false
    state.isError = false
})

describe("ProductionPerformanceBlock", () => {
    it("shows the KPIs", () => {
        render(<ProductionPerformanceBlock productId={7} period="12m" />)
        for (const label of ["Costo real por unidad", "Costo BOM actual", "Desviación de insumos", "Lead time", "Rectificación"]) {
            expect(screen.getByText(label)).toBeInTheDocument()
        }
        expect(screen.getByText(/\+25,0 % vs BOM/)).toBeInTheDocument()
    })

    it("lists work orders and materials in their tables", () => {
        render(<ProductionPerformanceBlock productId={7} period="12m" />)
        expect(screen.getByText("OT-0001")).toBeInTheDocument()
        expect(screen.getByText("OT-0002")).toBeInTheDocument()
        expect(screen.getByText("Papel Couché")).toBeInTheDocument()
    })

    it("charts stage durations only when there are stages", () => {
        const { rerender } = render(<ProductionPerformanceBlock productId={7} period="12m" />)
        expect(screen.getByTestId("stage-chart")).toHaveAttribute("data-rows", "1")
        state.data = { ...PERF, stages: [] }
        rerender(<ProductionPerformanceBlock productId={7} period="12m" />)
        expect(screen.queryByTestId("stage-chart")).not.toBeInTheDocument()
    })

    it("warns when some work orders use estimated cost", () => {
        render(<ProductionPerformanceBlock productId={7} period="12m" />)
        expect(screen.getByText(/costo estimado/i)).toBeInTheDocument()
    })

    it("does not warn when no cost is estimated", () => {
        state.data = { ...PERF, orders: [PERF.orders[0]] }
        render(<ProductionPerformanceBlock productId={7} period="12m" />)
        expect(screen.queryByText(/costo estimado/i)).not.toBeInTheDocument()
    })

    it("shows the empty state when there are no finished work orders", () => {
        state.data = { ...PERF, kpis: { ...PERF.kpis, orders: 0 }, orders: [], materials: [], stages: [] }
        render(<ProductionPerformanceBlock productId={7} period="12m" />)
        expect(screen.getByText("Sin OT terminadas en el periodo")).toBeInTheDocument()
    })

    it("shows loading and error states", () => {
        state.data = null
        state.isLoading = true
        const { rerender } = render(<ProductionPerformanceBlock productId={7} period="12m" />)
        expect(screen.getByLabelText("Cargando análisis del producto")).toBeInTheDocument()
        state.isLoading = false
        state.isError = true
        rerender(<ProductionPerformanceBlock productId={7} period="12m" />)
        expect(screen.getByRole("alert")).toBeInTheDocument()
    })

    it("derives date_from from the period and omits it for the history", () => {
        const dateFrom = () => (state.usePerf.mock.calls.at(-1)?.[1] as ProductionPerformanceParams).date_from
        const { rerender } = render(<ProductionPerformanceBlock productId={7} period="3m" />)
        expect(dateFrom()).toBeDefined()
        rerender(<ProductionPerformanceBlock productId={7} period="all" />)
        expect(dateFrom()).toBeUndefined()
    })

    it("no longer renders its own range selector", () => {
        render(<ProductionPerformanceBlock productId={7} period="12m" />)
        expect(screen.queryByRole("radio", { name: "24 m" })).not.toBeInTheDocument()
    })

    it("shows a dash instead of 0 days when there is no lead time (express products)", () => {
        state.data = { ...PERF, kpis: { ...PERF.kpis, lead_time_days: null } }
        render(<ProductionPerformanceBlock productId={7} period="12m" />)
        expect(screen.getByText("Lead time")).toBeInTheDocument()
        expect(screen.queryByText(/días/)).not.toBeInTheDocument()
    })
})
