import { fireEvent, render, screen, within } from "@testing-library/react"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import type { SalesImpact, SalesImpactParams } from "../salesImpact.types"

const state = vi.hoisted(() => ({
    data: null as unknown,
    isLoading: false,
    isError: false,
    useImpact: vi.fn(),
}))

vi.mock("../../hooks/useProductSalesImpact", () => ({
    useProductSalesImpact: (id: number, params: unknown) => {
        state.useImpact(id, params)
        return { data: state.data, isLoading: state.isLoading, isError: state.isError }
    },
}))
vi.mock("@/components/shared", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/components/shared")>()),
    AnalyticsChart: (props: { keys: string[]; data: Array<Record<string, unknown>> }) => (
        <div data-testid="chart" data-keys={props.keys.join("|")} data-rows={props.data.length} />
    ),
}))

import { SalesImpactBlock } from "../SalesImpactBlock"
import { RailControlsProvider, ViewControlsSlot } from "../RailControls"

const IMPACT: SalesImpact = {
    series: [
        { period: "2026-03", segments: { "7": 9000, none: 3000 } },
        { period: "2026-04", segments: { "7": 4000 } },
    ],
    segments: [{ key: "7", label: "Mayorista" }, { key: "none", label: "Sin registro" }],
    table: [
        { key: "7", label: "Mayorista", units: 13, net_revenue: 13000, margin: 7800, margin_pct: 60, discount_total: 1000, avg_price: 1000, foregone_revenue: 500 },
        { key: "none", label: "Sin registro", units: 3, net_revenue: 3000, margin: 1800, margin_pct: 60, discount_total: 0, avg_price: 1000, foregone_revenue: 0 },
    ],
    totals: { units: 16, net_revenue: 16000, margin: 9600, margin_pct: 60, discount_total: 1000, foregone_revenue: 500 },
    returns: { units: 2, revenue: 2000 },
    coverage: { revenue_with_provenance_pct: 25, since: "2026-05-01" },
    rule_windows: [{ rule_id: 7, name: "Mayorista", start: "2026-01-01", end: "2026-02-01" }],
}

beforeAll(() => {
    globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} }
})
beforeEach(() => {
    vi.clearAllMocks()
    state.data = IMPACT
    state.isLoading = false
    state.isError = false
})

const lastParams = (): SalesImpactParams => state.useImpact.mock.calls.at(-1)?.[1] as SalesImpactParams

describe("SalesImpactBlock", () => {
    it("charts one stacked key per segment from the series", () => {
        render(<SalesImpactBlock productId={7} period="12m" />)
        const chart = screen.getByTestId("chart")
        expect(chart.dataset.keys).toBe("Mayorista|Sin registro")
        expect(chart.dataset.rows).toBe("2")
    })

    it("refetches with the new group_by when the segmentation changes", () => {
        render(<SalesImpactBlock productId={7} period="12m" />)
        expect(lastParams()).toMatchObject({ group_by: "rule", metric: "net_revenue", granularity: "month" })
        fireEvent.click(screen.getByRole("radio", { name: "Canal" }))
        expect(lastParams().group_by).toBe("channel")
    })

    it("refetches with the new metric when the metric changes", () => {
        render(<SalesImpactBlock productId={7} period="12m" />)
        fireEvent.click(screen.getByRole("radio", { name: "Margen" }))
        expect(lastParams().metric).toBe("margin")
    })

    it("warns when only part of the revenue has a recorded rule", () => {
        render(<SalesImpactBlock productId={7} period="12m" />)
        expect(screen.getByText(/El 25 % del ingreso del periodo tiene regla registrada \(desde 01-05-2026\)/)).toBeInTheDocument()
    })

    it("does not warn when the whole revenue has provenance", () => {
        state.data = { ...IMPACT, coverage: { revenue_with_provenance_pct: 100, since: "2026-01-01" } }
        render(<SalesImpactBlock productId={7} period="12m" />)
        expect(screen.queryByText(/tiene regla registrada/)).not.toBeInTheDocument()
    })

    it("shows the empty state when there are no sales in the period", () => {
        state.data = {
            ...IMPACT, series: [], segments: [], table: [],
            totals: { units: 0, net_revenue: 0, margin: 0, margin_pct: 0, discount_total: 0, foregone_revenue: 0 },
            returns: { units: 0, revenue: 0 },
        }
        render(<SalesImpactBlock productId={7} period="12m" />)
        expect(screen.getByText("Sin ventas en el periodo")).toBeInTheDocument()
        expect(screen.queryByTestId("chart")).not.toBeInTheDocument()
    })

    it("derives date_from from the period and omits it for the history", () => {
        const dateFrom = () => (state.useImpact.mock.calls.at(-1)?.[1] as SalesImpactParams).date_from
        const { rerender } = render(<SalesImpactBlock productId={7} period="3m" />)
        expect(dateFrom()).toBeDefined()
        rerender(<SalesImpactBlock productId={7} period="all" />)
        expect(dateFrom()).toBeUndefined()
    })

    it("no longer renders its own range selector", () => {
        render(<SalesImpactBlock productId={7} period="12m" />)
        expect(screen.queryByRole("radio", { name: "24 m" })).not.toBeInTheDocument()
    })

    it("shows loading and error states", () => {
        state.data = null
        state.isLoading = true
        const { rerender } = render(<SalesImpactBlock productId={7} period="12m" />)
        expect(screen.getByLabelText("Cargando análisis del producto")).toBeInTheDocument()
        state.isLoading = false
        state.isError = true
        rerender(<SalesImpactBlock productId={7} period="12m" />)
        expect(screen.getByRole("alert")).toBeInTheDocument()
    })

    it("shows the returns line separately from the series", () => {
        render(<SalesImpactBlock productId={7} period="12m" />)
        expect(screen.getByText(/Devoluciones: 2 un/)).toBeInTheDocument()
    })

    it("lists the validity window of each price rule and labels the comparison as association", () => {
        render(<SalesImpactBlock productId={7} period="12m" />)
        expect(screen.getByText(/Mayorista · 01-01-2026 → 01-02-2026/)).toBeInTheDocument()
        expect(screen.getByText(/asociación, no causalidad/i)).toBeInTheDocument()
    })

    it("derives the granularity from the period and has no manual granularity control", () => {
        const granularity = () => lastParams().granularity
        const { rerender } = render(<SalesImpactBlock productId={7} period="1m" />)
        expect(granularity()).toBe("day")
        rerender(<SalesImpactBlock productId={7} period="3m" />)
        expect(granularity()).toBe("week")
        rerender(<SalesImpactBlock productId={7} period="12m" />)
        expect(granularity()).toBe("month")
        rerender(<SalesImpactBlock productId={7} period="all" />)
        expect(granularity()).toBe("year")
        expect(screen.queryByRole("radiogroup", { name: "Por" })).not.toBeInTheDocument()
    })

    it("delivers the metric and grouping controls to the rail view zone", () => {
        render(
            <RailControlsProvider>
                <ViewControlsSlot />
                <div data-testid="block"><SalesImpactBlock productId={7} period="12m" /></div>
            </RailControlsProvider>,
        )
        const slot = within(screen.getByRole("group", { name: "Controles de vista" }))
        expect(slot.getByRole("radiogroup", { name: "Métrica" })).toBeInTheDocument()
        expect(slot.getByRole("radiogroup", { name: "Agrupar por" })).toBeInTheDocument()
        expect(within(screen.getByTestId("block")).queryByRole("radiogroup", { name: "Métrica" })).not.toBeInTheDocument()
    })
})
