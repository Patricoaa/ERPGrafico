import { render, screen } from "@testing-library/react"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import type { ProductSubscriptionAnalysis } from "../subscriptionAnalysis.types"

type LineSeries = { id: string; data: Array<{ x: string; y: number }> }

const state = vi.hoisted(() => ({
    data: null as unknown,
    isLoading: false,
    isError: false,
    useSubs: vi.fn(),
    lines: [] as Array<{ data: LineSeries[] }>,
}))

vi.mock("../../hooks/useProductSubscriptionAnalysis", () => ({
    useProductSubscriptionAnalysis: (id: number, params: unknown) => {
        state.useSubs(id, params)
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

import { SubscriptionBlock } from "../SubscriptionBlock"

function subs(over: Partial<ProductSubscriptionAnalysis> = {}): ProductSubscriptionAnalysis {
    return {
        today: { annualized_total: 14400, monthly_equivalent: 1200, active_count: 2, due_90d_total: 3600 },
        kpis: { paid: 2400, payments: 2, previous: { paid: 2000, payments: 2 } },
        series: {
            points: [{ period: "2026-10", paid: 1200 }, { period: "2026-11", paid: 1200 }],
            previous_points: [{ period: "2026-10", paid: 1000 }],
        },
        subscriptions: [{
            id: 1, supplier: "Nube Hosting", status: "ACTIVE", amount: 1000, frequency: "MONTHLY", annualized: 12000,
            next_payment_date: "2026-12-15", days_to_payment: 25, end_date: null, days_to_end: null,
            last_payment: { date: "2026-11-15", amount: 1200 }, change_pct: 20, differs_from_amount: true,
        }],
        payments: [{ date: "2026-11-15", supplier: "Nube Hosting", amount: 1200, change_pct: 20 }],
        ...over,
    }
}

beforeAll(() => {
    globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} }
})
beforeEach(() => {
    state.data = subs()
    state.isLoading = false
    state.isError = false
    state.lines = []
    state.useSubs.mockClear()
})

describe("SubscriptionBlock", () => {
    it("shows the annualized cost, monthly equivalent, active count and next 90 days", () => {
        render(<SubscriptionBlock productId={7} period="12m" />)
        for (const label of ["Costo anualizado", "Equivalente mensual", "Activas", "Próximos 90 días"]) {
            expect(screen.getByText(label)).toBeInTheDocument()
        }
    })

    it("shows payments of the period with their change and chart", () => {
        render(<SubscriptionBlock productId={7} period="12m" />)
        expect(screen.getByText("Pagado en el periodo")).toBeInTheDocument()
        expect(screen.getAllByText(/20[,.]0\s?%/).length).toBeGreaterThan(0)
        expect(state.lines.at(-1)?.data.map((s) => s.id)).toEqual(["Pagado", "Período anterior"])
    })

    it("lists subscriptions with status, frequency and last payment", () => {
        render(<SubscriptionBlock productId={7} period="12m" />)
        expect(screen.getByRole("region", { name: "Suscripciones" })).toBeInTheDocument()
        expect(screen.getByText("Activa")).toBeInTheDocument()
        expect(screen.getByText("Mensual")).toBeInTheDocument()
    })

    it("lists the payments of the period", () => {
        render(<SubscriptionBlock productId={7} period="12m" />)
        expect(screen.getByRole("region", { name: "Pagos" })).toBeInTheDocument()
    })

    it("lists the findings", () => {
        render(<SubscriptionBlock productId={7} period="12m" />)
        const list = screen.getByRole("list", { name: "Hallazgos" })
        expect(list).toHaveTextContent(/Nube Hosting \(\+20[,.]0 %\)/)
        expect(list).toHaveTextContent(/monto configurado/)
    })

    it("keeps today and subscriptions without payments in the period", () => {
        state.data = subs({ kpis: { paid: 0, payments: 0, previous: null }, series: { points: [], previous_points: [] }, payments: [] })
        render(<SubscriptionBlock productId={7} period="12m" />)
        expect(screen.getByText("Sin pagos en el periodo")).toBeInTheDocument()
        expect(screen.getByText("Costo anualizado")).toBeInTheDocument()
        expect(screen.getByRole("region", { name: "Suscripciones" })).toBeInTheDocument()
        expect(screen.queryByTestId("line-chart")).not.toBeInTheDocument()
    })

    it("shows the skeleton while loading", () => {
        state.data = null
        state.isLoading = true
        render(<SubscriptionBlock productId={7} period="12m" />)
        expect(screen.getByLabelText("Cargando análisis del producto")).toBeInTheDocument()
    })

    it("asks the endpoint with the period's granularity and no date_from for the history", () => {
        const { rerender } = render(<SubscriptionBlock productId={7} period="3m" />)
        const last = () => state.useSubs.mock.calls.at(-1)?.[1] as { granularity: string; date_from?: string }
        expect(last().granularity).toBe("week")
        rerender(<SubscriptionBlock productId={7} period="all" />)
        expect(last()).toEqual({ granularity: "year", date_from: undefined })
    })
})
