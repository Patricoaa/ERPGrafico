import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { EmployeeMovement, PayrollAllocation } from "@/types/hr"
import { PayrollAllocationsSection } from "../PayrollAllocationsSection"

const m = vi.hoisted(() => ({ allocate: vi.fn(), deallocate: vi.fn(), pending: [] as unknown[] }))

vi.mock("../../../hooks/useEmployeeMovementMutations", () => ({
    useEmployeeMovementMutations: () => ({ allocate: m.allocate, deallocate: m.deallocate }),
}))
vi.mock("../../../hooks/useEmployeeMovements", () => ({
    useEmployeeMovements: () => ({ movements: m.pending, isLoading: false, isError: false }),
}))

const allocation: PayrollAllocation = {
    id: 7, movement: 3, payroll: 9, movement_display_id: "MOV-3", movement_date: "2026-09-01", movement_status: "POSTED", kind: "ADVANCE",
    kind_display: "Anticipo", installment: null, installment_number: null, amount: "40000", principal_part: "40000", interest_part: "0",
}

const advance = { id: 3, display_id: "MOV-3", kind: "ADVANCE", kind_display: "Anticipo", amount: "100000", balance: 60000, status: "POSTED", installments: [] } as unknown as EmployeeMovement
const loan = {
    id: 4, display_id: "MOV-4", kind: "LOAN", kind_display: "Préstamo", amount: "600000", balance: 600000, status: "POSTED",
    installments: [{ id: 1, number: 1, year: 2026, month: 12, principal: 97529, interest: 6000, amount: 103529, status: "PENDING" }],
} as unknown as EmployeeMovement

const renderSection = (over: Partial<React.ComponentProps<typeof PayrollAllocationsSection>> = {}) =>
    render(<PayrollAllocationsSection payrollId={9} employeeId={5} isPosted={false} allocations={[allocation]} onChanged={vi.fn()} {...over} />)

beforeEach(() => { m.allocate.mockReset().mockResolvedValue({}); m.deallocate.mockReset().mockResolvedValue({}); m.pending = [advance, loan] })

describe("PayrollAllocationsSection", () => {
    it("lists allocations and removes one in a draft payroll", async () => {
        const onChanged = vi.fn()
        renderSection({ onChanged })
        expect(screen.getByText("MOV-3")).toBeInTheDocument()
        await userEvent.click(screen.getByRole("button", { name: /Quitar/ }))
        await waitFor(() => expect(m.deallocate).toHaveBeenCalledWith({ id: 3, allocationId: 7 }))
        expect(onChanged).toHaveBeenCalled()
    })

    it("assigns a loan with the suggested editable installment", async () => {
        renderSection({ allocations: [] })
        await userEvent.click(screen.getByRole("button", { name: /Asignar/ }))
        const row = screen.getByText("MOV-4").closest("[data-testid='pending-movement']") as HTMLElement
        const input = within(row).getByRole("textbox")
        expect(input).toHaveValue("103529")
        await userEvent.clear(input)
        await userEvent.type(input, "110000")
        await userEvent.click(within(row).getByRole("button", { name: /Asignar/ }))
        await waitFor(() => expect(m.allocate).toHaveBeenCalledWith({ id: 4, payroll: 9, amount: "110000" }))
    })

    it("shows the cap warning without blocking the assignment", () => {
        renderSection({ capWarning: "Los descuentos superan el 15 % de los haberes." })
        expect(screen.getByText(/superan el 15/)).toBeInTheDocument()
        expect(screen.getByRole("button", { name: /Asignar/ })).toBeEnabled()
    })

    it("hides every action once the payroll is posted", () => {
        renderSection({ isPosted: true })
        expect(screen.getByText("MOV-3")).toBeInTheDocument()
        expect(screen.queryByRole("button", { name: /Quitar|Asignar/ })).not.toBeInTheDocument()
    })
})
