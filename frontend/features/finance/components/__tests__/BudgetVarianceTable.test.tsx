import { describe, expect, it } from "vitest"
import { render, screen, within } from "@testing-library/react"
import { BudgetVarianceTable } from "../BudgetVarianceTable"
import type { BudgetVarianceNode } from "../../types"

const node = (over: Partial<BudgetVarianceNode>): BudgetVarianceNode => ({
    id: 1, code: "4", name: "Ingresos", type: "INCOME",
    month_actual: 0, month_budget: 0, month_variance: 0, month_percentage: 0,
    ytd_actual: 0, ytd_budget: 0, ytd_variance: 0, ytd_percentage: 0,
    is_unbudgeted: false, children: [], ...over,
})
const DATA = [
    node({
        id: 5, code: "5", name: "Gastos", type: "EXPENSE", month_actual: 1200, month_budget: 1000, month_variance: 200, month_percentage: 20,
        children: [
            node({ id: 51, code: "5.1", name: "Arriendo", type: "EXPENSE", month_actual: 1200, month_budget: 1000, month_variance: 200, month_percentage: 20 }),
            node({ id: 52, code: "5.2", name: "Fletes", type: "EXPENSE", month_actual: 80, is_unbudgeted: true }),
        ],
    }),
]
const rowOf = (text: string) => screen.getByText(text).closest("tr") as HTMLElement

describe("BudgetVarianceTable on entity-view", () => {
    it("heads branches with section rows, marks unbudgeted accounts and colors expense overruns as bad", () => {
        render(<BudgetVarianceTable data={DATA} />)
        expect(rowOf("Gastos")).toHaveAttribute("data-tone", "section")
        expect(rowOf("Fletes")).toHaveAttribute("data-tone", "attention")
        expect(within(rowOf("Fletes")).getByText("Sin presupuesto")).toBeInTheDocument()

        const rent = within(rowOf("Arriendo"))
        expect(rent.getByText("20.0%")).toBeInTheDocument()
        expect(rent.getByText("20.0%").previousElementSibling).toHaveClass("text-destructive")
    })
})
