import { fireEvent, render, screen } from "@testing-library/react"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import type { ProductStockAnalysis } from "../stockAnalysis.types"

type LineSeries = { id: string; data: Array<{ x: string; y: number }> }

const state = vi.hoisted(() => ({
    data: null as unknown,
    isLoading: false,
    isError: false,
    useStock: vi.fn(),
    lines: [] as Array<{ data: LineSeries[] }>,
    bars: [] as Array<{ keys: string[]; data: Array<Record<string, unknown>> }>,
}))

vi.mock("../../hooks/useProductStockAnalysis", () => ({
    useProductStockAnalysis: (id: number, params: unknown) => {
        state.useStock(id, params)
        return { data: state.data, isLoading: state.isLoading, isError: state.isError }
    },
}))
vi.mock("@/components/shared", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/components/shared")>()),
    LineChart: (props: { data: LineSeries[] }) => {
        state.lines.push(props)
        return <div data-testid="line-chart" />
    },
    BarChart: (props: { keys: string[]; data: Array<Record<string, unknown>> }) => {
        state.bars.push(props)
        return <div data-testid="bar-chart" />
    },
}))

import { StockBlock } from "../StockBlock"

function stock(over: Partial<ProductStockAnalysis> = {}): ProductStockAnalysis {
    return {
        today: { on_hand: 120, value: 6000, reserved: 20, available: 100 },
        rotation: {
            in_qty: 200, out_qty: 80, avg_stock: 100, turnover: 0.8, days_of_inventory: 456,
            last_in_date: "2026-10-01", last_out_date: "2026-11-10", idle: false, idle_days: 90,
        },
        series: [
            { period: "2026-10", stock_end: 140, in_qty: 100, out_qty: 40 },
            { period: "2026-11", stock_end: 120, in_qty: 20, out_qty: 40 },
        ],
        flows: {
            outflows: [{ key: "sale", label: "Ventas", qty: 70 }, { key: "production", label: "Producción", qty: 10 }],
            inflows: [{ key: "purchase", label: "Compras", qty: 200 }],
        },
        adjustments: [{ key: "loss", label: "Merma", qty: 3, value: 150 }],
        loss_pct: 3.75,
        warehouses: [
            { id: 1, name: "Bodega Central", on_hand: 100, last_move_date: "2026-11-10", idle: false },
            { id: 2, name: "Bodega Norte", on_hand: 20, last_move_date: "2026-03-01", idle: true },
        ],
        variants: [],
        ...over,
    }
}

beforeAll(() => {
    globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} }
})
beforeEach(() => {
    state.data = stock()
    state.isLoading = false
    state.isError = false
    state.lines = []
    state.bars = []
    state.useStock.mockClear()
})

describe("StockBlock", () => {
    it("shows on hand, value, reserved and available", () => {
        render(<StockBlock productId={7} period="12m" />)
        for (const label of ["Existencia", "Valor", "Comprometido", "Disponible"]) {
            expect(screen.getByText(label)).toBeInTheDocument()
        }
    })

    it("shows rotation and days of inventory", () => {
        render(<StockBlock productId={7} period="12m" />)
        expect(screen.getByText("Rotación")).toBeInTheDocument()
        expect(screen.getByText("Días de inventario")).toBeInTheDocument()
    })

    it("asks again with the idle threshold chosen in the view zone", () => {
        render(<StockBlock productId={7} period="12m" />)
        expect(state.useStock.mock.calls.at(-1)?.[1]).toMatchObject({ idle_days: 90 })
        fireEvent.click(screen.getByRole("radio", { name: "30 d" }))
        expect(state.useStock.mock.calls.at(-1)?.[1]).toMatchObject({ idle_days: 30 })
    })

    it("draws the closing stock line and the in/out bars", () => {
        render(<StockBlock productId={7} period="12m" />)
        expect(state.lines.at(-1)?.data[0].data.map((p) => p.y)).toEqual([140, 120])
        expect(state.bars.at(-1)?.keys).toEqual(["Entradas", "Salidas"])
    })

    it("shows flows, adjustments and warehouses", () => {
        render(<StockBlock productId={7} period="12m" />)
        expect(screen.getByRole("region", { name: "Flujos" })).toBeInTheDocument()
        expect(screen.getByRole("region", { name: "Ajustes" })).toBeInTheDocument()
        expect(screen.getByText("Merma")).toBeInTheDocument()
        expect(screen.getByRole("region", { name: "Bodegas" })).toBeInTheDocument()
        expect(screen.getByText("Inmóvil")).toBeInTheDocument()
    })

    it("hides warehouses with a single one and shows variants when present", () => {
        state.data = stock({
            warehouses: [{ id: 1, name: "Bodega Central", on_hand: 120, last_move_date: "2026-11-10", idle: false }],
            variants: [{ id: 3, name: "Resma A4", on_hand: 120, reserved: 20, available: 100 }],
        })
        render(<StockBlock productId={7} period="12m" />)
        expect(screen.queryByRole("region", { name: "Bodegas" })).not.toBeInTheDocument()
        expect(screen.getByRole("region", { name: "Variantes" })).toBeInTheDocument()
        expect(screen.getByText("Resma A4")).toBeInTheDocument()
    })

    it("lists the findings", () => {
        render(<StockBlock productId={7} period="12m" />)
        const list = screen.getByRole("list", { name: "Hallazgos" })
        expect(list).toHaveTextContent(/merma/i)
        expect(list).toHaveTextContent(/Bodega Norte/)
    })

    it("keeps today's figures and says there were no movements", () => {
        state.data = stock({
            series: [{ period: "2026-11", stock_end: 120, in_qty: 0, out_qty: 0 }],
            flows: { outflows: [], inflows: [] }, adjustments: [], loss_pct: null,
            warehouses: [{ id: 1, name: "Bodega Central", on_hand: 120, last_move_date: null, idle: true }],
        })
        render(<StockBlock productId={7} period="12m" />)
        expect(screen.getByText("Existencia")).toBeInTheDocument()
        expect(screen.getByText("Sin movimientos en el periodo")).toBeInTheDocument()
        expect(screen.queryByTestId("line-chart")).not.toBeInTheDocument()
    })

    it("shows the skeleton while loading", () => {
        state.data = null
        state.isLoading = true
        render(<StockBlock productId={7} period="12m" />)
        expect(screen.getByLabelText("Cargando análisis del producto")).toBeInTheDocument()
    })

    it("asks the endpoint with the period's granularity and no date_from for the history", () => {
        const { rerender } = render(<StockBlock productId={7} period="3m" />)
        const last = () => state.useStock.mock.calls.at(-1)?.[1] as { granularity: string; date_from?: string }
        expect(last().granularity).toBe("week")
        rerender(<StockBlock productId={7} period="all" />)
        expect(last()).toEqual({ granularity: "year", date_from: undefined, idle_days: 90 })
    })

    it("has no stock movements table", () => {
        render(<StockBlock productId={7} period="12m" />)
        expect(screen.queryByText(/Movimientos de stock/i)).not.toBeInTheDocument()
    })
})
