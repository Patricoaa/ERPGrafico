import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { BudgetVarianceView } from "../BudgetVarianceView"
import type { Budget } from "../../hooks/useBudgets"
import type { BudgetVarianceNode } from "../../types"

const m = vi.hoisted(() => ({
    budgets: [] as Budget[],
    data: [] as BudgetVarianceNode[],
    paramValues: {} as Record<string, string>,
    applyMany: vi.fn(),
    clearAll: vi.fn(),
    useBudgetVariance: vi.fn(),
    tableProps: {} as Record<string, unknown>,
}))

vi.mock("@/components/entity-view", () => ({
    useCollectionQuery: () => ({
        search: { paramValues: m.paramValues, applyMany: m.applyMany, clearAll: m.clearAll },
    }),
}))

vi.mock("@/components/shared", () => ({
    PageHeader: ({ title, description }: { title: string; description: string }) => (
        <header><h1>{title}</h1><p>{description}</p></header>
    ),
}))

vi.mock("@/hooks/useServerDate", () => ({
    useServerDate: () => ({ month: 7, year: 2026 }),
}))

vi.mock("../../entity-view/budgetVariance.entity", () => ({ budgetVarianceEntity: {} }))

vi.mock("../../hooks/useBudgets", () => ({
    useAllBudgets: () => ({ budgets: m.budgets }),
    useBudgetVariance: m.useBudgetVariance,
}))

vi.mock("../BudgetVarianceTable", () => ({
    BudgetVarianceTable: (props: Record<string, unknown>) => {
        m.tableProps = props
        return <div data-testid="variance-table" />
    },
}))

const budget = (id: number): Budget => ({
    id, name: `Presupuesto ${id}`, start_date: "2026-01-01", end_date: "2026-12-31",
})

describe("BudgetVarianceView con barra canónica (ADR-0158)", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        m.budgets = []
        m.data = []
        m.paramValues = {}
        m.useBudgetVariance.mockReturnValue({ data: m.data, isLoading: false })
    })

    it("toma presupuesto, mes y año de la URL para pedir la variación", () => {
        m.budgets = [budget(604), budget(605)]
        m.paramValues = { budget: "604", month: "3", year: "2025" }
        render(<BudgetVarianceView />)

        expect(m.useBudgetVariance).toHaveBeenCalledWith(604, { month: "3", year: "2025" })
        expect(m.tableProps.exportFilters).toEqual({ budget: 604, month: "3", year: "2025" })
        expect(m.applyMany).not.toHaveBeenCalled()
    })

    it("usa la fecha del servidor como periodo por defecto", () => {
        m.budgets = [budget(604)]
        m.paramValues = { budget: "604" }
        render(<BudgetVarianceView />)

        expect(m.useBudgetVariance).toHaveBeenCalledWith(604, { month: "7", year: "2026" })
    })

    it("no vuelve al primer presupuesto tras Restablecer sin budget en la URL", () => {
        m.budgets = [budget(604)]
        render(<BudgetVarianceView />)

        expect(m.useBudgetVariance).toHaveBeenCalledWith(null, expect.objectContaining({ month: "7", year: "2026" }))
        expect(m.tableProps.exportFilters).toEqual({ budget: 0, month: "7", year: "2026" })
    })

    it("selecciona el primer presupuesto una sola vez escribiendo la URL, nunca en el render", () => {
        const error = vi.spyOn(console, "error").mockImplementation(() => {})
        m.budgets = [budget(604)]
        const { rerender } = render(<BudgetVarianceView />)
        rerender(<BudgetVarianceView />)

        expect(m.applyMany).toHaveBeenCalledTimes(1)
        expect(m.applyMany).toHaveBeenCalledWith({ budget: "604" })
        expect(error).not.toHaveBeenCalled()
        error.mockRestore()
    })

    it("no pide la variación si aún no hay presupuestos", () => {
        render(<BudgetVarianceView />)

        expect(m.useBudgetVariance).toHaveBeenCalledWith(null, expect.objectContaining({ year: "2026" }))
        expect(screen.getByTestId("variance-table")).toBeInTheDocument()
    })
})
