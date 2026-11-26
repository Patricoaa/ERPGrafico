import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { PayrollDetailView } from "../PayrollDetailView"
import type { EmployeeBasic } from "@/features/hr/hooks/usePayrolls"

const m = vi.hoisted(() => ({
    usePayrollDetail: vi.fn(),
    usePayrollSections: vi.fn(),
    sections: [] as Array<{ title: string; content: ReactNode }>,
}))

vi.mock("@/features/hr/hooks/usePayrolls", () => ({
    usePayrollDetail: m.usePayrollDetail,
}))
vi.mock("../payrollSummary", () => ({
    usePayrollSections: m.usePayrollSections,
}))
vi.mock("@/components/shared", () => ({
    EmptyState: ({ title }: { title: string }) => <div role="status">{title}</div>,
    SkeletonShell: ({ children, isLoading }: { children: ReactNode; isLoading: boolean }) =>
        <div>{isLoading ? "Cargando liquidación" : children}</div>,
    Section: { Header: ({ title }: { title: string }) => <h2>{title}</h2> },
}))

const employee: EmployeeBasic = { id: 5, position: "Desarrollador" }

beforeEach(() => {
    m.usePayrollDetail.mockReset()
    m.usePayrollSections.mockReset()
    m.sections = [{ title: "Haberes y descuentos", content: <p>Sueldo base</p> }]
    m.usePayrollDetail.mockReturnValue({
        payrollDetail: { payroll: { id: 911, display_id: "LIQ-911" } },
        isLoading: false,
        isError: false,
    })
    m.usePayrollSections.mockImplementation(() => m.sections)
})

describe("PayrollDetailView (ADR-0152)", () => {
    it("solo existe la variante employee: pide el preview del empleado y pinta sus secciones", () => {
        render(<PayrollDetailView payrollId={911} viewMode="employee" employee={employee} />)

        expect(m.usePayrollDetail).toHaveBeenCalledWith(911, "employee", employee)
        expect(m.usePayrollDetail.mock.calls.every(([, mode]) => mode === "employee")).toBe(true)
        expect(screen.getByRole("heading", { name: "Haberes y descuentos" })).toBeInTheDocument()
        expect(screen.getByText("Sueldo base")).toBeInTheDocument()
        expect(screen.queryByText(/Editar liquidación|Contabilizar/)).not.toBeInTheDocument()
    })

    it("el tipo de viewMode rechaza la variante admin heredada", () => {
        // @ts-expect-error — tras ADR-0152 la única variante permitida es "employee".
        render(<PayrollDetailView payrollId={911} viewMode="admin" />)

        expect(m.usePayrollDetail).toHaveBeenCalledWith(911, "employee", undefined)
    })

    it("sin liquidación muestra el estado vacío, sin acciones de administración", () => {
        m.usePayrollDetail.mockReturnValue({ payrollDetail: null, isLoading: false, isError: false })

        render(<PayrollDetailView payrollId={911} viewMode="employee" />)

        expect(screen.getByRole("status")).toHaveTextContent("Liquidación no encontrada")
        expect(m.usePayrollSections).toHaveBeenCalledWith(null)
    })
})
