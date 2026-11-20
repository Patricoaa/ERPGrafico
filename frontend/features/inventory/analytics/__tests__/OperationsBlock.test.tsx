import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Operations, Rotation, SubscriptionsSummary } from "../operations.types"

const state = vi.hoisted(() => ({
    data: null as unknown,
    isLoading: false,
    isError: false,
    useOps: vi.fn(),
}))

vi.mock("../../hooks/useProductOperations", () => ({
    useProductOperations: (id: number, params: unknown) => {
        state.useOps(id, params)
        return { data: state.data, isLoading: state.isLoading, isError: state.isError }
    },
}))
vi.mock("@/components/shared", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/components/shared")>()),
    AnalyticsChart: (props: { data: Array<Record<string, unknown>> }) => (
        <div data-testid="rotation-chart" data-rows={props.data.length} />
    ),
}))

import { OperationsBlock } from "../OperationsBlock"

const ROTATION: Rotation = {
    stock_now: 40, stock_value: 4000, in_qty: 100, out_qty: 60, avg_stock: 50, turnover: 1.2, days_of_inventory: 304,
    coverage_days: 55, last_out_date: "2026-11-01", last_in_date: "2026-10-01", idle: false, idle_days: 90,
    series: [{ month: "2026-10", out: 10, stock_end: 50 }, { month: "2026-11", out: 20, stock_end: 40 }],
}
const SUBS: SubscriptionsSummary = {
    annualized_total: 1200, monthly_equivalent_total: 100, count: 1, due_90d_total: 100, first_to_last_pct: 20,
    items: [{
        id: 1, supplier: "Hosting SpA", status: "ACTIVE", amount: 100, frequency: "MONTHLY", annualized: 1200,
        next_payment_date: "2026-12-15", days_to_payment: 10,
    }],
    payments: [
        { date: "2026-01-05", supplier: "Hosting SpA", unit_cost: 100, quantity: 1, change_pct: null },
        { date: "2026-02-05", supplier: "Hosting SpA", unit_cost: 120, quantity: 1, change_pct: 20 },
    ],
}
const FULL: Operations = { rotation: ROTATION, subscriptions: SUBS }

beforeEach(() => {
    vi.clearAllMocks()
    state.data = FULL
    state.isLoading = false
    state.isError = false
})

describe("OperationsBlock", () => {
    it("shows the rotation cards, the chart and the coverage in days", () => {
        render(<OperationsBlock productId={7} period="12m" />)
        expect(screen.getByText("Rotación")).toBeInTheDocument()
        expect(screen.getByText("Cobertura")).toBeInTheDocument()
        expect(screen.getByText("55 días")).toBeInTheDocument()
        expect(screen.getByTestId("rotation-chart")).toHaveAttribute("data-rows", "2")
        expect(screen.queryByText(/Stock inmóvil: hay/)).not.toBeInTheDocument()
    })

    it("shows dashes for null turnover and coverage", () => {
        state.data = { rotation: { ...ROTATION, turnover: null, days_of_inventory: null, coverage_days: null }, subscriptions: null }
        render(<OperationsBlock productId={7} period="12m" />)
        expect(screen.queryByText("55 días")).not.toBeInTheDocument()
        expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(3)
    })

    it("warns about idle stock", () => {
        state.data = { rotation: { ...ROTATION, idle: true }, subscriptions: null }
        render(<OperationsBlock productId={7} period="12m" />)
        expect(screen.getByText(/Stock inmóvil: hay/)).toBeInTheDocument()
    })

    it("shows the subscription totals, the table and the payments variation", () => {
        render(<OperationsBlock productId={7} period="12m" />)
        expect(screen.getByText("Costo anualizado")).toBeInTheDocument()
        expect(screen.getByText("Próximos 90 días")).toBeInTheDocument()
        expect(screen.getAllByText("Hosting SpA").length).toBeGreaterThan(0)
        expect(screen.getByText(/Variación primer a último pago/)).toBeInTheDocument()
    })

    it("hides sections that are null", () => {
        state.data = { rotation: null, subscriptions: SUBS }
        render(<OperationsBlock productId={7} period="12m" />)
        expect(screen.queryByText("Rotación")).not.toBeInTheDocument()
        expect(screen.getByText("Costo anualizado")).toBeInTheDocument()
        state.data = { rotation: ROTATION, subscriptions: null }
        render(<OperationsBlock productId={7} period="12m" />)
        expect(screen.getAllByText("Rotación").length).toBe(1)
    })

    it("explains when there is nothing to analyze", () => {
        state.data = { rotation: null, subscriptions: null }
        render(<OperationsBlock productId={7} period="12m" />)
        expect(screen.getByText("Este producto no tiene datos de operación que analizar")).toBeInTheDocument()
    })

    it("shows loading and error states", () => {
        state.isLoading = true
        state.data = null
        const { unmount } = render(<OperationsBlock productId={7} period="12m" />)
        expect(screen.getByLabelText("Cargando análisis del producto")).toBeInTheDocument()
        unmount()
        state.isLoading = false
        state.isError = true
        render(<OperationsBlock productId={7} period="12m" />)
        expect(screen.getByRole("alert")).toBeInTheDocument()
    })

    it("derives date_from from the period and omits it for the history", () => {
        const dateFrom = () => (state.useOps.mock.calls.at(-1) as [number, { date_from?: string }])[1].date_from
        const { rerender } = render(<OperationsBlock productId={7} period="3m" />)
        expect(dateFrom()).toBeDefined()
        rerender(<OperationsBlock productId={7} period="all" />)
        expect(dateFrom()).toBeUndefined()
    })

    it("no longer renders its own range selector", () => {
        render(<OperationsBlock productId={7} period="12m" />)
        expect(screen.queryByRole("radio", { name: "24 m" })).not.toBeInTheDocument()
    })

    it("refetches with the chosen idle threshold", () => {
        render(<OperationsBlock productId={7} period="12m" />)
        fireEvent.click(screen.getByRole("radio", { name: "30 d" }))
        const last = state.useOps.mock.calls.at(-1) as [number, { date_from: string; idle_days: number }]
        expect(last[0]).toBe(7)
        expect(last[1].idle_days).toBe(30)
        expect(state.useOps.mock.calls[0][1]).not.toEqual(last[1])
    })
})
