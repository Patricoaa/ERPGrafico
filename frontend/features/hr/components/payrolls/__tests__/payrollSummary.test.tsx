import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import type { Payroll, PayrollAllocation, PayrollItem } from "@/types/hr"
import { payrollAdvances, payrollLines } from "../../../entity-view/payrollItem.entity"
import { livePayrollTotals, payrollTotals, usePayrollSections } from "../payrollSummary"

const item = (id: number, category: string, name: string, amount: string): PayrollItem => ({
    id, payroll: 9, concept: id, description: "", amount, is_previred: false,
    concept_detail: { id, name, category, category_display: category } as PayrollItem["concept_detail"],
})

const allocation = (over: Partial<PayrollAllocation>): PayrollAllocation => ({
    id: 1, movement: 1, movement_display_id: "MOV-1", movement_date: "2026-09-30", movement_status: "POSTED", kind: "ADVANCE",
    kind_display: "Anticipo", installment: null, installment_number: null, amount: "40000", principal_part: "40000",
    interest_part: "0", payroll: 9, ...over,
})

const payroll = (over: Partial<Payroll> = {}) => ({
    id: 9, display_id: "LIQ-9", status: "POSTED", employee: 5, employee_name: "Ana", period_label: "Septiembre 2026",
    agreed_days: 30, absent_days: 0, worked_days: 30, base_salary: "600000",
    total_haberes: "650000", total_descuentos: "150000", net_salary: "500000", balance: "100000",
    items: [
        item(3, "DESCUENTO_LEGAL_TRABAJADOR", "AFP", "150000"),
        item(1, "HABER_IMPONIBLE", "Sueldo base", "600000"),
        item(4, "DESCUENTO_LEGAL_EMPLEADOR", "Seguro de cesantía empleador", "14400"),
        item(2, "HABER_NO_IMPONIBLE", "Movilización", "50000"),
    ],
    allocations: [
        allocation({ id: 1, movement_display_id: "MOV-1" }),
        allocation({ id: 2, movement_display_id: "MOV-2", kind: "PAYMENT", kind_display: "Pago de remuneración" }),
        allocation({ id: 3, movement_display_id: "MOV-3", movement_status: "CANCELLED" }),
    ],
    ...over,
}) as unknown as Payroll

function Harness({ p }: { p: Payroll }) {
    const sections = usePayrollSections(p)
    return <>{sections.map((s, i) => <section key={s.title ?? i} aria-label={s.title}>{s.content}</section>)}</>
}

describe("payrollTotals", () => {
    it("derives paid from the backend balance", () => {
        expect(payrollTotals(payroll())).toMatchObject({ net: 500000, pending: 100000, paid: 400000 })
    })

    it("treats a missing balance as nothing paid and never goes negative", () => {
        expect(payrollTotals(payroll({ balance: undefined }))).toMatchObject({ pending: 500000, paid: 0 })
        expect(payrollTotals(payroll({ balance: "-10" }))).toMatchObject({ pending: 0, paid: 500000 })
    })
})

describe("livePayrollTotals", () => {
    it("recomputes from the edited tables with the backend rule and keeps salary payments already made", () => {
        // Guardado: líquido 500.000, saldo 100.000 → pagado 400.000, de los cuales 40.000 son el anticipo MOV-1.
        const p = payroll()
        const lines = payrollLines(p)
        const values = lines.map(l => ({ key: l.key, values: { amount: l.key === "item-1" ? 700000 : l.amount } }))
        const totals = livePayrollTotals(p, lines, values, [{ key: "alloc-1", values: { amount: 50000 } }])
        expect(totals).toEqual({ haberes: 750000, descuentos: 150000, net: 600000, paid: 410000, pending: 190000 })
    })
})

describe("payroll rows", () => {
    it("lists haberes before descuentos and leaves employer contributions out", () => {
        expect(payrollLines(payroll()).map(l => l.conceptName)).toEqual(["Sueldo base", "Movilización", "AFP"])
    })

    it("keeps only live advances and loans (salary payments live in Pagos)", () => {
        expect(payrollAdvances(payroll()).map(a => a.displayId)).toEqual(["MOV-1"])
    })
})

describe("usePayrollSections (read only)", () => {
    it("shows haberes and descuentos in one table, the advances and the final totals box", () => {
        render(<Harness p={payroll()} />)
        const lines = screen.getByRole("region", { name: "Haberes y descuentos" })
        expect(within(lines).getByText("Sueldo base")).toBeInTheDocument()
        expect(within(lines).getByText("AFP")).toBeInTheDocument()
        expect(screen.queryByText("Seguro de cesantía empleador")).not.toBeInTheDocument()
        const advances = screen.getByRole("region", { name: "Anticipos y préstamos" })
        expect(within(advances).getByText("MOV-1")).toBeInTheDocument()
        expect(within(advances).getByText("Saldo por pagar")).toBeInTheDocument()
        expect(screen.getByRole("group", { name: "Resumen de la liquidación" })).toHaveTextContent("Ana")
    })
})
