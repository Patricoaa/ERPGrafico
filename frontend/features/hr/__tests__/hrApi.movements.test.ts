import { describe, it, expect, vi, beforeEach } from "vitest"

const { getMock, postMock } = vi.hoisted(() => ({ getMock: vi.fn(), postMock: vi.fn() }))
vi.mock("@/lib/api", () => ({ default: { get: getMock, post: postMock } }))

import {
    getEmployeeMovements, previewLoanSchedule, allocateMovement, deallocateMovement, annulEmployeeMovement,
    getEmployeeMovementHistory,
} from "../api/hrApi"
import { employeeMovementFormSchema } from "../schemas/employeeMovement.schema"

describe("employee movements api", () => {
    beforeEach(() => { getMock.mockReset(); postMock.mockReset() })

    it("getEmployeeMovements calls the endpoint with the filters", async () => {
        getMock.mockResolvedValue({ data: { results: [{ id: 1 }] } })
        const rows = await getEmployeeMovements({ kind: "LOAN", employee: "5" })
        expect(getMock).toHaveBeenCalledWith("/hr/employee-movements/", { params: { kind: "LOAN", employee: "5" } })
        expect(rows).toEqual([{ id: 1 }])
    })

    it("previewLoanSchedule sends the expected body", async () => {
        postMock.mockResolvedValue({ data: [] })
        const body = { amount: 600000, rate: "0.01", rate_period: "MONTHLY" as const, installments: 6, first_year: 2026, first_month: 10 }
        await previewLoanSchedule(body)
        expect(postMock).toHaveBeenCalledWith("/hr/employee-movements/preview-schedule/", body)
    })

    it("allocate / deallocate / annul hit the movement actions", async () => {
        postMock.mockResolvedValue({ data: {} })
        await allocateMovement(3, { payroll: 9, amount: "1000" })
        await deallocateMovement(3, 7)
        await annulEmployeeMovement(3, "error")
        expect(postMock).toHaveBeenNthCalledWith(1, "/hr/employee-movements/3/allocate/", { payroll: 9, amount: "1000" })
        expect(postMock).toHaveBeenNthCalledWith(2, "/hr/employee-movements/3/deallocate/", { allocation: 7 })
        expect(postMock).toHaveBeenNthCalledWith(3, "/hr/employee-movements/3/annul/", { reason: "error" })
    })

    it("history reads the employee movements endpoint", async () => {
        getMock.mockResolvedValue({ data: { results: [] } })
        await getEmployeeMovementHistory(4)
        expect(getMock).toHaveBeenCalledWith("/hr/employees/4/movements/")
    })

    it("history handles plain array responses from endpoints with OptionalPaginationMixin", async () => {
        getMock.mockResolvedValue({ data: [{ id: 10, kind: "ADVANCE" }] })
        const res = await getEmployeeMovementHistory(4)
        expect(res).toEqual([{ id: 10, kind: "ADVANCE" }])
    })
})

describe("employeeMovementFormSchema", () => {
    const base = { employee: "1", date: "2026-09-01", amount: "600000" }

    it("accepts an advance without loan fields", () => {
        expect(employeeMovementFormSchema.safeParse({ ...base, kind: "ADVANCE" }).success).toBe(true)
    })

    it("rejects a loan without rate and installments", () => {
        const result = employeeMovementFormSchema.safeParse({ ...base, kind: "LOAN" })
        expect(result.success).toBe(false)
    })

    it("accepts a complete loan", () => {
        const result = employeeMovementFormSchema.safeParse({
            ...base, kind: "LOAN", rate: "1", rate_period: "MONTHLY", installments_count: "6",
            first_installment_year: "2026", first_installment_month: "10",
        })
        expect(result.success).toBe(true)
    })
})
