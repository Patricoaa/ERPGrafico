import { describe, expect, it, vi } from "vitest"
import type { StructuredAction } from "@/components/shared"
import type { TaxPeriod } from "@/features/tax"
import { closureActionList, type ClosureActionsCtx } from "../../components/closures/closureActions"
import { buildClosureTree, type ClosureMonthRow } from "../closureTree"
import type { AccountingPeriod } from "../../types"

const acct = (month: number, status: "OPEN" | "CLOSED", taxClosed = false): AccountingPeriod => ({
    id: 100 + month, year: 2026, month, month_display: "", status, status_display: status === "CLOSED" ? "Cerrado" : "Abierto",
    closed_at: null, closed_by: null, closed_by_name: null, tax_period_id: taxClosed ? 200 + month : null, tax_period_status: taxClosed ? "CLOSED" : null,
})
const tax = (month: number, status: "OPEN" | "CLOSED", summary?: TaxPeriod["declaration_summary"]): TaxPeriod => ({ id: 200 + month, year: 2026, month, status, declaration_summary: summary })
const summary = (vat: number, paid: boolean): TaxPeriod["declaration_summary"] => ({ id: 9, vat_to_pay: vat, total_paid: paid ? vat : 0, is_fully_paid: paid })

const ctx: ClosureActionsCtx = {
    onCloseYear: vi.fn(), onReopenYear: vi.fn(), onCreatePeriod: vi.fn(), onClosePeriod: vi.fn(), onReopenPeriod: vi.fn(),
    onOpenDeclaration: vi.fn(), onPayF29: vi.fn(), onCloseTaxPeriod: vi.fn(), onReopenTaxPeriod: vi.fn(),
    isPeriodActionLoading: false, isTaxActionLoading: false, isFiscalYearLoading: false,
}

const month = (a?: AccountingPeriod, t?: TaxPeriod): ClosureMonthRow => ({ kind: "month", id: "m", year: 2026, month: 3, monthName: "Marzo", acct: a, tax: t })
const visible = (actions: StructuredAction[]): string[] =>
    actions.flatMap((a) => ("separator" in a || a.visible === false ? [] : [a.label ?? a.action]))

describe("buildClosureTree", () => {
    it("gives every fiscal year its 12 months, matching periods by month", () => {
        const [year] = buildClosureTree([{ year: 2026, periods: [acct(3, "OPEN")], taxPeriods: [tax(3, "OPEN")] }])
        expect(year.children).toHaveLength(12)
        expect(year.children[2]).toMatchObject({ month: 3, monthName: "Marzo", acct: { id: 103 }, tax: { id: 203 } })
        expect(year.children[0].acct).toBeUndefined()
    })
})

describe("closure actions keep the rules of the former month card", () => {
    it("month without an accounting period: open it; declaring F29 is offered but disabled", () => {
        const actions = closureActionList(month(), ctx)
        expect(visible(actions)).toEqual(["Abrir periodo contable", "Declarar F29 (abre el periodo contable primero)"])
        expect(actions.find((a) => !("separator" in a) && a.label?.startsWith("Declarar F29"))).toMatchObject({ disabled: true })
    })

    it("open period, F29 declared and unpaid: close period, pay F29", () => {
        expect(visible(closureActionList(month(acct(3, "OPEN"), tax(3, "OPEN", summary(5000, false))), ctx))).toEqual(["Cerrar periodo contable", "Pagar F29"])
    })

    it("F29 declared and paid: it can be closed", () => {
        expect(visible(closureActionList(month(acct(3, "OPEN"), tax(3, "OPEN", summary(5000, true))), ctx))).toEqual(["Cerrar periodo contable", "Cerrar F29"])
    })

    it("closed F29 freezes the accounting period: only the disabled reason is shown", () => {
        const actions = closureActionList(month(acct(3, "CLOSED", true), tax(3, "CLOSED")), ctx)
        expect(visible(actions)).toEqual(["Reabrir periodo contable (bloqueado por cierre F29)"])
        expect(actions.find((a) => !("separator" in a) && a.visible !== false)).toMatchObject({ disabled: true })
    })

    it("closed F29 with the accounting period still open: reopen F29", () => {
        expect(visible(closureActionList(month(acct(3, "OPEN"), tax(3, "CLOSED")), ctx))).toEqual(["Cerrar periodo contable", "Reabrir F29"])
    })

    it("a fiscal year can be closed only when every accounting and F29 period is closed", () => {
        const [open] = buildClosureTree([{ year: 2026, periods: [acct(1, "CLOSED")], taxPeriods: [tax(1, "OPEN")] }])
        const [ready] = buildClosureTree([{ year: 2026, periods: [acct(1, "CLOSED")], taxPeriods: [tax(1, "CLOSED")] }])
        expect(closureActionList(open, ctx)[0]).toMatchObject({ disabled: true })
        expect(closureActionList(ready, ctx)[0]).toMatchObject({ label: "Cerrar ejercicio", disabled: false })
    })
})
