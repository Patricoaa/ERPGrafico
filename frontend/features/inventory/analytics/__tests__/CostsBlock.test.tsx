import { render, screen } from "@testing-library/react"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import type { CostsMode, ProductCosts } from "../costs.types"

type LineSeries = { id: string; data: Array<{ x: string; y: number }> }

const state = vi.hoisted(() => ({
    data: null as unknown,
    isLoading: false,
    isError: false,
    useCosts: vi.fn(),
    lines: [] as Array<{ data: LineSeries[] }>,
}))

vi.mock("../../hooks/useProductCosts", () => ({
    useProductCosts: (id: number, params: unknown) => {
        state.useCosts(id, params)
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

import { CostsBlock } from "../CostsBlock"

const point = (period: string, over: Partial<ProductCosts["series"][number]> = {}) => ({
    period, weighted_cost: 100, bom_cost: 110, purchase_avg: 105, real_avg: 120, ...over,
})

function costs(mode: CostsMode, over: Partial<ProductCosts> = {}): ProductCosts {
    return {
        mode,
        today: {
            weighted_cost: 100, bom_cost: 110,
            last_purchase: { date: "2026-06-01", unit_cost: 102, supplier: "Papelera Sur" },
            stock_qty: 10, stock_value: 1000,
        },
        kpis: { cost_change_pct: 12, replacement_gap_pct: 2 },
        series: [point("2026-01"), point("2026-02")],
        purchases: {
            min: 90, max: 110, avg: 100, count: 3,
            items: [{ date: "2026-06-01", number: "REC-0012", supplier: "Papelera Sur", qty: 5, unit_cost: 102, total: 510 }],
        },
        bom: {
            lines: [{ component_id: 1, name: "Papel couché", qty_per_unit: 2, qty_display: 2, uom_singular: "Pliego", uom_plural: "Pliegos", unit_cost: 50, cost: 100, share_pct: 90.9, change_pct: 25, is_outsourced: false }],
            drivers: [{ component_id: 1, name: "Papel couché", delta: 20 }],
        },
        work_orders: [{ id: 5, number: "OT-0005", date: "2026-03-10", units: 10, unit_real_cost: 120, unit_bom_cost: 110, deviation_pct: 9.1 }],
        ...over,
    }
}
const seriesIds = () => state.lines.at(-1)?.data.map((s) => s.id)

beforeAll(() => {
    globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} }
})
beforeEach(() => {
    state.data = costs("purchased", { bom: null, work_orders: [] })
    state.isLoading = false
    state.isError = false
    state.lines = []
    state.useCosts.mockClear()
})

describe("CostsBlock", () => {
    it("shows the weighted cost, last purchase, stock value and a purchases table for a purchased product", () => {
        render(<CostsBlock productId={7} period="12m" />)
        expect(screen.getByText("Costo ponderado")).toBeInTheDocument()
        expect(screen.getByText("Última compra")).toBeInTheDocument()
        expect(screen.getAllByText(/Papelera Sur/).length).toBeGreaterThan(1)
        expect(screen.getByText("Capital inmovilizado")).toBeInTheDocument()
        expect(seriesIds()).toEqual(["Costo ponderado"])
        expect(screen.getByRole("region", { name: "Compras del periodo" })).toBeInTheDocument()
        expect(screen.getByText("REC-0012")).toBeInTheDocument()
    })

    it("shows only the weighted cost for a stocked manufactured product", () => {
        state.data = costs("manufactured_stock", { purchases: { min: null, max: null, avg: null, count: 0, items: [] } })
        render(<CostsBlock productId={7} period="12m" />)
        expect(screen.getByText("Costo de LdM hoy")).toBeInTheDocument()
        expect(screen.queryByText("Receta activa con costos de hoy")).not.toBeInTheDocument()
        expect(screen.queryByText("Capital inmovilizado")).not.toBeInTheDocument()
        expect(seriesIds()).toEqual(["Costo ponderado"])
    })

    it("uses the BOM cost as hero for an on-demand manufactured product", () => {
        state.data = costs("manufactured_on_demand")
        render(<CostsBlock productId={7} period="12m" />)
        expect(screen.getByText("Costo de LdM")).toBeInTheDocument()
        expect(screen.queryByText("Costo ponderado")).not.toBeInTheDocument()
        expect(seriesIds()).toEqual(["LdM teórica"])
    })

    it("shows the LdM composition (not a table) with its change and warns that it uses the current recipe", () => {
        state.data = costs("manufactured_on_demand")
        render(<CostsBlock productId={7} period="12m" />)
        expect(screen.getByRole("region", { name: "Composición de la LdM" })).toBeInTheDocument()
        expect(screen.queryByRole("table", { name: /LdM/ })).not.toBeInTheDocument()
        expect(screen.getAllByText("Papel couché").length).toBeGreaterThan(0)
        expect(screen.getByText(/× 2 Pliegos/)).toBeInTheDocument()
        expect(screen.queryByText(/receta actual/)).not.toBeInTheDocument()
    })

    it("lists the work orders with their prefixed number and unit cost", () => {
        state.data = costs("manufactured_on_demand")
        render(<CostsBlock productId={7} period="12m" />)
        expect(screen.getByRole("region", { name: "Órdenes de trabajo" })).toBeInTheDocument()
        expect(screen.getByText("OT-0005")).toBeInTheDocument()
    })

    it("lists the findings of the composition", () => {
        render(<CostsBlock productId={7} period="12m" />)
        expect(screen.getByRole("list", { name: "Hallazgos" })).toHaveTextContent(/subió 12[,.]0 %/)
    })

    it("keeps only the hero when the period has no cost data", () => {
        state.data = costs("stock_only", {
            series: [point("2026-01", { weighted_cost: null, bom_cost: null, purchase_avg: null, real_avg: null })],
            bom: null, work_orders: [], purchases: { min: null, max: null, avg: null, count: 0, items: [] },
            kpis: { cost_change_pct: null, replacement_gap_pct: null },
        })
        render(<CostsBlock productId={7} period="12m" />)
        expect(screen.getByText("Costo ponderado")).toBeInTheDocument()
        expect(screen.getByText("Sin movimientos de costo en el periodo")).toBeInTheDocument()
        expect(screen.queryByTestId("line-chart")).not.toBeInTheDocument()
    })

    it("shows the skeleton while loading", () => {
        state.data = null
        state.isLoading = true
        render(<CostsBlock productId={7} period="12m" />)
        expect(screen.getByLabelText("Cargando análisis del producto")).toBeInTheDocument()
    })

    it("asks the endpoint with the period's granularity and no date_from for the history", () => {
        const { rerender } = render(<CostsBlock productId={7} period="3m" />)
        const last = () => state.useCosts.mock.calls.at(-1)?.[1] as { granularity: string; date_from?: string }
        expect(last().granularity).toBe("week")
        expect(last().date_from).toBeDefined()
        rerender(<CostsBlock productId={7} period="all" />)
        expect(last()).toEqual({ granularity: "year", date_from: undefined })
    })
})
