import { act, renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { EmployeeMovement, Payroll, PayrollConcept, PayrollItem } from "@/types/hr"
import { suggestedAdvanceAmount, usePayrollDraft } from "../usePayrollDraft"

const api = vi.hoisted(() => ({
    createPayrollItem: vi.fn(), updatePayrollItem: vi.fn(), deletePayrollItem: vi.fn(),
    allocateMovement: vi.fn(), deallocateMovement: vi.fn(),
}))
const m = vi.hoisted(() => ({ movements: [] as unknown[] }))

vi.mock("../../api/hrApi", () => api)
vi.mock("../useEmployeeMovements", () => ({
    EMPLOYEE_MOVEMENTS_QUERY_KEY: ["hr", "employee-movements"],
    useEmployeeMovements: () => ({ movements: m.movements, isLoading: false }),
}))
vi.mock("@/features/realtime", () => ({ useRealtime: () => ({ markLocalMutation: vi.fn() }) }))

const item = (id: number, category: string, name: string, amount: string): PayrollItem => ({
    id, payroll: 9, concept: id * 10, description: "", amount, is_previred: false,
    concept_detail: { id: id * 10, name, category, category_display: category } as PayrollItem["concept_detail"],
})

const payroll = {
    id: 9, status: "DRAFT", employee: 5,
    items: [item(1, "HABER_IMPONIBLE", "Sueldo base", "600000"), item(2, "OTRO_DESCUENTO", "Cuota sindical", "5000")],
    allocations: [{
        id: 7, movement: 3, payroll: 9, movement_display_id: "MOV-3", movement_date: "2026-09-01", movement_status: "POSTED",
        kind: "ADVANCE", kind_display: "Anticipo", installment: null, installment_number: null, amount: "40000",
        principal_part: "40000", interest_part: "0",
    }],
} as unknown as Payroll

const loan = {
    id: 4, display_id: "MOV-4", kind: "LOAN", kind_display: "Préstamo", amount: "600000", free_balance: 600000, status: "POSTED",
    installments: [{ id: 1, number: 1, year: 2026, month: 12, principal: 97529, interest: 6000, amount: 103529, status: "PENDING", is_allocated: false }],
} as unknown as EmployeeMovement

const bono = { id: 99, name: "Bono", category: "HABER_NO_IMPONIBLE", category_display: "Haber no imponible", formula_type: "FIXED", default_amount: "20000" } as unknown as PayrollConcept

function wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
}

beforeEach(() => {
    Object.values(api).forEach(fn => fn.mockReset().mockResolvedValue({}))
    m.movements = [{ id: 3, kind: "ADVANCE", free_balance: 60000 }, loan]
})

describe("suggestedAdvanceAmount", () => {
    it("suggests the next pending installment of a loan and the free balance of an advance", () => {
        expect(suggestedAdvanceAmount(loan)).toBe(103529)
        expect(suggestedAdvanceAmount({ kind: "ADVANCE", free_balance: "60000", installments: [] } as unknown as EmployeeMovement)).toBe(60000)
    })
})

describe("usePayrollDraft", () => {
    it("starts clean and applies only the difference on save", async () => {
        const { result } = renderHook(() => usePayrollDraft(payroll), { wrapper })
        await waitFor(() => expect(result.current.lineValues).toHaveLength(2))
        expect(result.current.isDirty).toBe(false)

        act(() => {
            result.current.addConcept(bono)
            result.current.removeLine("item-2")
        })
        act(() => {
            result.current.setLineValues(result.current.lineValues.map(v => v.key === "item-1" ? { ...v, values: { amount: 650000 } } : v))
        })
        act(() => result.current.addAdvance(loan))
        await waitFor(() => expect(result.current.isDirty).toBe(true))
        expect(result.current.pendingMovements).toEqual([])

        await act(async () => { expect(await result.current.save()).toBe(true) })

        expect(api.deletePayrollItem).toHaveBeenCalledWith(9, 2)
        expect(api.updatePayrollItem).toHaveBeenCalledWith(9, 1, { amount: "650000" })
        expect(api.createPayrollItem).toHaveBeenCalledWith(9, { payroll: 9, concept: 99, amount: "20000", description: "" })
        expect(api.allocateMovement).toHaveBeenCalledTimes(1)
        expect(api.allocateMovement).toHaveBeenCalledWith(4, { payroll: 9, amount: "103529" })
        expect(api.deallocateMovement).not.toHaveBeenCalled()
    })

    it("re-allocates an advance whose amount changed and rejects amounts over its balance", async () => {
        const { result } = renderHook(() => usePayrollDraft(payroll), { wrapper })
        await waitFor(() => expect(result.current.advanceValues).toHaveLength(1))
        // Tope = 40.000 ya asignados + 60.000 libres.
        expect(result.current.advances[0].max).toBe(100000)

        act(() => result.current.setAdvanceValues([{ ...result.current.advanceValues[0], values: { amount: 120000 } }]))
        await act(async () => { expect(await result.current.save()).toBe(false) })
        expect(result.current.advanceErrors["alloc-7"]?.amount).toBe("Supera el saldo del movimiento")

        act(() => result.current.setAdvanceValues([{ ...result.current.advanceValues[0], values: { amount: 50000 } }]))
        await act(async () => { expect(await result.current.save()).toBe(true) })
        expect(api.deallocateMovement).toHaveBeenCalledWith(3, 7)
        expect(api.allocateMovement).toHaveBeenCalledWith(3, { payroll: 9, amount: "50000" })
    })
})
