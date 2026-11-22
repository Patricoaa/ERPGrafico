import { fireEvent, render, screen } from "@testing-library/react"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import type { ProductProcurement } from "../procurement.types"

type LineSeries = { id: string; data: Array<{ x: string; y: number }> }

const state = vi.hoisted(() => ({
    data: null as unknown,
    isLoading: false,
    isError: false,
    useProcurement: vi.fn(),
    lines: [] as Array<{ data: LineSeries[] }>,
}))

vi.mock("../../hooks/useProductProcurement", () => ({
    useProductProcurement: (id: number, params: unknown) => {
        state.useProcurement(id, params)
        return { data: state.data, isLoading: state.isLoading, isError: state.isError }
    },
}))
vi.mock("@/components/shared", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/components/shared")>()),
    LineChart: (props: { data: LineSeries[] }) => {
        state.lines.push(props)
        return <div data-testid="line-chart" />
    },
}))

import { ProcurementBlock } from "../ProcurementBlock"

function proc(over: Partial<ProductProcurement> = {}): ProductProcurement {
    return {
        coverage: { stock_now: 120, daily_out: 4, coverage_days: 30 },
        kpis: {
            units: 50, spend: 5000, orders: 3, suppliers: 2, last_purchase_date: "2026-11-10",
            days_since_last_purchase: 10, returned_units: 0, previous: { units: 40, spend: 4000, orders: 2 },
        },
        series: {
            points: [{ period: "2026-10", units: 20, spend: 2000 }, { period: "2026-11", units: 30, spend: 3000 }],
            previous_points: [{ period: "2026-10", units: 15, spend: 1500 }],
        },
        suppliers: [
            { id: 1, name: "Papelera Sur", units: 30, spend: 3000, share_pct: 60, avg_unit_cost: 100, receipts: 2, last_date: "2026-11-10", returned_units: 0, preferred: true },
            { id: 2, name: "Distribuidora Norte", units: 20, spend: 2000, share_pct: 40, avg_unit_cost: 100, receipts: 1, last_date: "2026-10-05", returned_units: 0, preferred: false },
        ],
        preferred_supplier: { id: 1, name: "Papelera Sur" },
        pending: [{ order_id: 9, number: "PO-0009", supplier: "Papelera Sur", date: "2026-11-15", ordered: 10, received: 4, pending: 6 }],
        ...over,
    }
}

beforeAll(() => {
    globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} }
})
beforeEach(() => {
    state.data = proc()
    state.isLoading = false
    state.isError = false
    state.lines = []
    state.useProcurement.mockClear()
})

describe("ProcurementBlock", () => {
    it("does not show the coverage metrics (they live in Inventario)", () => {
        render(<ProcurementBlock productId={7} period="12m" />)
        expect(screen.queryByText("Cobertura")).not.toBeInTheDocument()
    })

    it("shows purchased units with their change against the previous period", () => {
        render(<ProcurementBlock productId={7} period="12m" />)
        expect(screen.getByText("Unidades compradas")).toBeInTheDocument()
        expect(screen.getByText(/25[,.]0\s?%/)).toBeInTheDocument()
    })

    it("switches the chart between units and spend with the Métrica control", () => {
        render(<ProcurementBlock productId={7} period="12m" />)
        expect(state.lines.at(-1)?.data[0].data.map((p) => p.y)).toEqual([20, 30])
        fireEvent.click(screen.getByRole("radio", { name: "Gasto" }))
        expect(state.lines.at(-1)?.data[0].data.map((p) => p.y)).toEqual([2000, 3000])
        expect(state.lines.at(-1)?.data.map((s) => s.id)).toEqual(["Gasto", "Período anterior"])
    })

    it("lists suppliers and marks the preferred one", () => {
        render(<ProcurementBlock productId={7} period="12m" />)
        expect(screen.getByRole("region", { name: "Proveedores" })).toBeInTheDocument()
        expect(screen.getByText("Distribuidora Norte")).toBeInTheDocument()
        expect(screen.getByText("Preferido")).toBeInTheDocument()
    })

    it("lists the orders pending to receive", () => {
        render(<ProcurementBlock productId={7} period="12m" />)
        expect(screen.getByRole("region", { name: "Pendiente de recibir" })).toBeInTheDocument()
        expect(screen.getByText("PO-0009")).toBeInTheDocument()
    })

    it("lists the findings", () => {
        state.data = proc({ coverage: { stock_now: 10, daily_out: 1, coverage_days: 10 } })
        render(<ProcurementBlock productId={7} period="12m" />)
        expect(screen.getByRole("list", { name: "Hallazgos" })).toHaveTextContent(/10 días/)
    })

    it("shows the empty state with the last purchase when there are no purchases", () => {
        state.data = proc({
            kpis: { ...proc().kpis, units: 0, spend: 0, orders: 0, suppliers: 0, days_since_last_purchase: 300, previous: null },
            series: { points: [], previous_points: [] }, suppliers: [], pending: [],
        })
        render(<ProcurementBlock productId={7} period="12m" />)
        expect(screen.getByText("Sin compras en el periodo")).toBeInTheDocument()
        expect(screen.getByText(/Última compra hace 300 días/)).toBeInTheDocument()
        expect(screen.queryByTestId("line-chart")).not.toBeInTheDocument()
    })

    it("shows the skeleton while loading", () => {
        state.data = null
        state.isLoading = true
        render(<ProcurementBlock productId={7} period="12m" />)
        expect(screen.getByLabelText("Cargando análisis del producto")).toBeInTheDocument()
    })

    it("asks the endpoint with the period's granularity and no date_from for the history", () => {
        const { rerender } = render(<ProcurementBlock productId={7} period="3m" />)
        const last = () => state.useProcurement.mock.calls.at(-1)?.[1] as { granularity: string; date_from?: string }
        expect(last().granularity).toBe("week")
        rerender(<ProcurementBlock productId={7} period="all" />)
        expect(last()).toEqual({ granularity: "year", date_from: undefined })
    })

    it("shows no lead time nor reorder point", () => {
        render(<ProcurementBlock productId={7} period="12m" />)
        expect(screen.queryByText(/tiempo de entrega|punto de pedido|puntualidad/i)).not.toBeInTheDocument()
    })
})
