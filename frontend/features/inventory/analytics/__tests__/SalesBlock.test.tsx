import { fireEvent, render, screen } from "@testing-library/react"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import type { ProductSales } from "../sales.types"

type LineSeries = { id: string; data: Array<{ x: string; y: number }> }

const state = vi.hoisted(() => ({
    data: null as unknown,
    isLoading: false,
    isError: false,
    useSales: vi.fn(),
    lines: [] as Array<{ data: LineSeries[] }>,
}))

vi.mock("../../hooks/useProductSales", () => ({
    useProductSales: (id: number, params: unknown) => {
        state.useSales(id, params)
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

import { SalesBlock } from "../SalesBlock"

const share = (key: string, label: string, units = 5) => ({ key, label, units, net_revenue: units * 1000, share_pct: 50 })

function sales(over: Partial<ProductSales> = {}): ProductSales {
    return {
        kpis: {
            units: 100, net_revenue: 100000, customers: 12, return_units: 4, return_rate_pct: 4,
            margin_pct: null, avg_discount_pct: 0,
            last_sale_date: "2026-11-10", days_since_last_sale: 10,
            previous: { units: 80, net_revenue: 80000, customers: 9, margin_pct: null, avg_discount_pct: 0 },
        },
        series: {
            points: [{ period: "2026-10", units: 40, net_revenue: 40000 }, { period: "2026-11", units: 60, net_revenue: 60000 }],
            previous_points: [{ period: "2026-10", units: 30, net_revenue: 30000 }],
        },
        customers: { total: 12, top3_share_pct: 50, top: [{ id: 1, name: "Cliente Uno", units: 10, net_revenue: 10000, share_pct: 10 }] },
        channels: [share("SYSTEM", "Sistema"), share("POS", "Punto de Venta (POS)")],
        variants: [],
        uoms: [],
        ...over,
    }
}

beforeAll(() => {
    globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} }
})
beforeEach(() => {
    state.data = sales()
    state.isLoading = false
    state.isError = false
    state.lines = []
    state.useSales.mockClear()
})

describe("SalesBlock", () => {
    it("shows units sold as the hero metric with its change against the previous period", () => {
        render(<SalesBlock productId={7} period="12m" />)
        expect(screen.getByText("Unidades vendidas")).toBeInTheDocument()
        expect(screen.getByText(/25[,.]0\s?%/)).toBeInTheDocument()
    })

    it("shows no change without a previous period", () => {
        state.data = sales({ kpis: { ...sales().kpis, previous: null } })
        render(<SalesBlock productId={7} period="all" />)
        expect(screen.queryByText(/25[,.]0\s?%/)).not.toBeInTheDocument()
    })

    it("shows the real number of customers, not the top 10", () => {
        render(<SalesBlock productId={7} period="12m" />)
        expect(screen.getByText("Clientes")).toBeInTheDocument()
        expect(screen.getByText("12")).toBeInTheDocument()
    })

    it("lists the findings of the composition", () => {
        state.data = sales({ kpis: { ...sales().kpis, units: 40 } })
        render(<SalesBlock productId={7} period="12m" />)
        const list = screen.getByRole("list", { name: "Hallazgos" })
        expect(list).toHaveTextContent(/cayeron 50 %/)
    })

    it("switches the main series between units and net revenue with the Métrica control", () => {
        render(<SalesBlock productId={7} period="12m" />)
        expect(state.lines.at(-1)?.data[0].data.map((p) => p.y)).toEqual([40, 60])
        fireEvent.click(screen.getByRole("radio", { name: "Ingreso neto" }))
        expect(state.lines.at(-1)?.data[0].data.map((p) => p.y)).toEqual([40000, 60000])
    })

    it("overlays the previous period as its own series, only when it exists", () => {
        const { unmount } = render(<SalesBlock productId={7} period="12m" />)
        expect(state.lines.at(-1)?.data.map((s) => s.id)).toEqual(["Unidades", "Período anterior"])
        unmount()
        state.lines = []
        state.data = sales({ series: { ...sales().series, previous_points: [] } })
        render(<SalesBlock productId={7} period="all" />)
        expect(state.lines.at(-1)?.data.map((s) => s.id)).toEqual(["Unidades"])
    })

    it("renders only the sections that have data", () => {
        state.data = sales({ channels: [share("SYSTEM", "Sistema")] })
        render(<SalesBlock productId={7} period="12m" />)
        expect(screen.getByRole("region", { name: "Clientes" })).toBeInTheDocument()
        expect(screen.queryByRole("region", { name: "Canales" })).not.toBeInTheDocument()
        expect(screen.queryByRole("region", { name: "Variantes" })).not.toBeInTheDocument()
    })

    it("renders channel and variant rankings when present", () => {
        state.data = sales({ variants: [share("9", "Tarjeta A4")] })
        render(<SalesBlock productId={7} period="12m" />)
        expect(screen.getByRole("region", { name: "Canales" })).toBeInTheDocument()
        expect(screen.getByText("Tarjeta A4")).toBeInTheDocument()
    })

    it("shows the empty state with the last sale and no chart when there are no sales", () => {
        state.data = sales({
            kpis: { ...sales().kpis, units: 0, net_revenue: 0, customers: 0, days_since_last_sale: 200, previous: null },
            series: { points: [], previous_points: [] }, channels: [],
            customers: { total: 0, top3_share_pct: 0, top: [] },
        })
        render(<SalesBlock productId={7} period="12m" />)
        expect(screen.getByText("Sin ventas en el periodo")).toBeInTheDocument()
        expect(screen.getByText(/Última venta hace 200 días/)).toBeInTheDocument()
        expect(screen.queryByTestId("line-chart")).not.toBeInTheDocument()
    })

    it("shows the skeleton while loading", () => {
        state.data = null
        state.isLoading = true
        render(<SalesBlock productId={7} period="12m" />)
        expect(screen.getByLabelText("Cargando análisis del producto")).toBeInTheDocument()
    })

    it("asks the endpoint with the period's granularity and no date_from for the history", () => {
        const { rerender } = render(<SalesBlock productId={7} period="3m" />)
        const last = () => state.useSales.mock.calls.at(-1)?.[1] as { granularity: string; date_from?: string }
        expect(last().granularity).toBe("week")
        expect(last().date_from).toBeDefined()
        rerender(<SalesBlock productId={7} period="all" />)
        expect(last()).toEqual({ granularity: "year", date_from: undefined })
    })

    it("shows no price or cost figures, but shows margin when available", () => {
        state.data = sales({
            kpis: {
                ...sales().kpis,
                margin_pct: 45.5,
                previous: { ...sales().kpis.previous!, margin_pct: 42.0 },
            },
        })
        render(<SalesBlock productId={7} period="12m" />)
        expect(screen.queryByText(/costo|precio de lista/i)).not.toBeInTheDocument()
        expect(screen.getByText("Margen realizado")).toBeInTheDocument()
        expect(screen.getByText(/\+3[,.]5 pts/)).toBeInTheDocument()
    })
})
