import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import type { Payroll, PayrollAllocation } from "@/types/hr"
import { PayrollCard } from "../PayrollCard"

const allocation = (over: Partial<PayrollAllocation>): PayrollAllocation => ({
    id: 1, movement: 1, movement_display_id: "MOV-1", movement_date: "2026-09-30", movement_status: "POSTED", kind: "PAYMENT",
    kind_display: "Pago de remuneración", installment: null, installment_number: null, amount: "400000", principal_part: "400000",
    interest_part: "0", payroll: 9, ...over,
})

const payroll = (allocations: PayrollAllocation[]) => ({
    id: 9, display_id: "LIQ-9", status: "POSTED", net_salary: "500000", items: [], payments: [], allocations,
    period_label: "Septiembre 2026", employee_name: "Ana",
}) as unknown as Payroll

describe("PayrollCard — historial de pagos", () => {
    it("lists salary payments from movements and does not show a pending balance when paid in full", () => {
        render(<PayrollCard payroll={payroll([allocation({ amount: "500000" })])} isPosted />)
        expect(screen.getByText("Pago de remuneración")).toBeInTheDocument()
        expect(screen.queryByText(/Saldo Pendiente de Pago/)).not.toBeInTheDocument()
    })

    it("ignores cancelled movements", () => {
        render(<PayrollCard payroll={payroll([allocation({ movement_status: "CANCELLED" })])} isPosted />)
        expect(screen.queryByText("Pago de remuneración")).not.toBeInTheDocument()
    })
})
