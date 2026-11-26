import { describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { FinancialStatementTable } from "../FinancialStatementTable"
import type { DrillDownTarget, ReportNode } from "../../types"

const data: ReportNode[] = [
    {
        id: "liabilities",
        code: "",
        name: "Pasivos",
        balance: 1200,
        comp_balance: 1000,
        varianceDirection: "lower-is-better",
        children: [{ id: 21, code: "2.1", name: "Proveedores", balance: 1200, comp_balance: 1000 }],
    },
    { id: "result", code: "", name: "Utilidad del ejercicio", balance: 500, comp_balance: 400, isTotalRow: true },
]

const rowOf = (text: string) => screen.getByText(text).closest("tr") as HTMLElement

describe("FinancialStatementTable (ReportTable on entity-view)", () => {
    it("tones sections and totals, and opens the ledger of account rows only", async () => {
        const onDrillDown = vi.fn<(t: DrillDownTarget) => void>()
        render(<FinancialStatementTable data={data} periodLabel="2026" onDrillDown={onDrillDown} />)

        expect(rowOf("Pasivos")).toHaveAttribute("data-tone", "section")
        expect(rowOf("Utilidad del ejercicio")).toHaveAttribute("data-tone", "total")
        expect(screen.getByRole("columnheader", { name: "2026" })).toBeInTheDocument()

        await userEvent.click(rowOf("Pasivos"))
        await userEvent.click(rowOf("Utilidad del ejercicio"))
        expect(onDrillDown).not.toHaveBeenCalled()

        await userEvent.click(rowOf("Proveedores"))
        expect(onDrillDown).toHaveBeenCalledWith({ accountId: 21, accountName: "Proveedores", accountCode: "2.1" })
    })

    it("adds the comparison period and colors the variance by the section's direction", () => {
        render(<FinancialStatementTable data={data} periodLabel="2026" compPeriodLabel="2025" showComparison />)

        expect(screen.getByRole("columnheader", { name: "2025" })).toBeInTheDocument()
        expect(screen.getByRole("columnheader", { name: "Var." })).toBeInTheDocument()
        // Liabilities went up: bad news for a lower-is-better section, inherited by its accounts.
        const account = within(rowOf("Proveedores"))
        expect(account.getByText("20.0%")).toBeInTheDocument()
        expect(account.getByText("20.0%").previousElementSibling).toHaveClass("text-destructive")
    })
})
