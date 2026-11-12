import { describe, expect, it, vi } from "vitest"
import type { TaxPeriod } from "../../types"
import { taxDeclarationActionList } from "../taxDeclarationActions"

type Summary = NonNullable<TaxPeriod["declaration_summary"]>
const period = (status: TaxPeriod["status"], summary?: Partial<Summary>): TaxPeriod => ({
    id: 7, year: 2026, month: 10, status,
    declaration_summary: summary ? { id: 9, vat_to_pay: 0, total_paid: 0, is_fully_paid: false, ...summary } : undefined,
})

const labels = (p: TaxPeriod) =>
    taxDeclarationActionList(p, { onOpenF29: vi.fn() }).flatMap((a) => ("separator" in a || a.visible === false ? [] : [a.label]))

describe("taxDeclarationActions", () => {
    it.each([
        ["Declarar F29", period("OPEN")],
        ["Registrar pago F29", period("OPEN", { vat_to_pay: 5000, total_paid: 0, is_fully_paid: false })],
        ["Cerrar F29", period("OPEN", { vat_to_pay: 5000, total_paid: 5000, is_fully_paid: true })],
        ["Ver F29", period("CLOSED", { vat_to_pay: 5000, total_paid: 5000, is_fully_paid: true })],
    ])("exactly one action: %s", (label, p) => {
        expect(labels(p)).toEqual([label])
    })

    it("opens the wizard for the period", () => {
        const onOpenF29 = vi.fn()
        const p = period("OPEN")
        const [action] = taxDeclarationActionList(p, { onOpenF29 })
        if ("separator" in action) throw new Error("unexpected separator")
        action.onClick?.({ stopPropagation: vi.fn() } as never)
        expect(onOpenF29).toHaveBeenCalledWith(p)
    })
})
