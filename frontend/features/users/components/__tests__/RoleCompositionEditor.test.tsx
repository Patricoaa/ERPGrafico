import { render, screen, fireEvent, waitFor, act } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import React from "react"
import type { AppGroup } from "@/types/entities"
import type { RbacBundle, Composition } from "../../api/rbacApi"

// ---- mocks ----

const mockCan = vi.fn((_p: string) => true)
vi.mock("@/contexts/AuthContext", () => ({
    useAuth: () => ({ can: mockCan }),
}))

const mockUseBundles = vi.fn()
const mockUseComposition = vi.fn()
const mockMutate = vi.fn()
const mockUseSaveComposition = vi.fn(() => ({
    mutate: mockMutate,
    isPending: false,
}))

vi.mock("../../hooks/useRbac", () => ({
    useBundles: () => mockUseBundles(),
    useComposition: (_id: number) => mockUseComposition(),
    useSaveComposition: () => mockUseSaveComposition(),
}))

// lazy import after mocks
import { RoleCompositionEditor } from "../RoleCompositionEditor"

const BUNDLES: RbacBundle[] = [
    { key: "sales.read", label: "Ver Ventas", description: "", sensitive: false, permissions: ["sales.view_dashboard_sales"] },
    { key: "sales.operate", label: "Operar Ventas", description: "", sensitive: false, permissions: ["sales.view_dashboard_sales", "sales.add_order"] },
    { key: "sales.manage", label: "Gestionar Ventas", description: "", sensitive: false, permissions: ["sales.view_dashboard_sales", "sales.add_order", "sales.delete_order"] },
    { key: "hr.payroll", label: "Nómina", description: "", sensitive: true, permissions: ["hr.run_payroll"] },
]

const COMPOSITION: Composition = {
    bundles: ["sales.read"],
    extra_permissions: [],
    excluded_permissions: [],
    effective_permissions: ["sales.view_dashboard_sales"],
}

const ROLE: AppGroup = { id: 1, name: "Vendedor", kind: "ROLE", is_system: false }
const SYSTEM_ROLE: AppGroup = { id: 2, name: "Admin Sistema", kind: "ROLE", is_system: true }

beforeEach(() => {
    mockCan.mockReset()
    mockCan.mockImplementation((_p: string) => true)
    mockUseBundles.mockReturnValue({ data: BUNDLES, isLoading: false })
    mockUseComposition.mockReturnValue({ data: COMPOSITION, isLoading: false })
    mockMutate.mockReset()
})

describe("RoleCompositionEditor", () => {
    it("renders bundle matrix with correct module rows", () => {
        render(<RoleCompositionEditor group={ROLE} />)
        expect(screen.getByText("Ver Ventas")).toBeTruthy()
        expect(screen.getByText("Operar Ventas")).toBeTruthy()
        expect(screen.getByText("Gestionar Ventas")).toBeTruthy()
    })

    it("separates sensitive bundles into their own section", () => {
        render(<RoleCompositionEditor group={ROLE} />)
        expect(screen.getByText("Nómina")).toBeTruthy()
        // sensitive bundles are in a different section
        const sensitiveSection = screen.getByTestId("sensitive-section")
        expect(sensitiveSection.textContent).toContain("Nómina")
    })

    it("checking operate auto-checks read for same module", async () => {
        render(<RoleCompositionEditor group={ROLE} />)
        const operateCheckbox = screen.getByTestId("bundle-checkbox-sales.operate")
        fireEvent.click(operateCheckbox)
        // read should now be checked
        const readCheckbox = screen.getByTestId("bundle-checkbox-sales.read") as HTMLInputElement
        await waitFor(() => expect(readCheckbox.checked).toBe(true))
    })

    it("shows system-role banner and disables all controls when is_system", () => {
        render(<RoleCompositionEditor group={SYSTEM_ROLE} />)
        expect(screen.getByTestId("system-role-banner")).toBeTruthy()
        const checkboxes = screen.getAllByRole("checkbox") as HTMLInputElement[]
        checkboxes.forEach(cb => expect(cb.disabled).toBe(true))
    })

    it("renders read-only when readOnly=true", () => {
        render(<RoleCompositionEditor group={ROLE} readOnly />)
        expect(screen.queryByRole("button", { name: /guardar/i })).toBeNull()
        const checkboxes = screen.getAllByRole("checkbox") as HTMLInputElement[]
        checkboxes.forEach(cb => expect(cb.disabled).toBe(true))
    })

    it("disabled checkboxes for bundles actor cannot grant", () => {
        mockCan.mockImplementation((p: string) => !p.includes("delete"))
        render(<RoleCompositionEditor group={ROLE} />)
        const manageCheckbox = screen.getByTestId("bundle-checkbox-sales.manage") as HTMLInputElement
        expect(manageCheckbox.disabled).toBe(true)
    })

    it("calls useSaveComposition on submit with correct payload", async () => {
        render(<RoleCompositionEditor group={ROLE} />)
        const saveBtn = screen.getByRole("button", { name: /guardar/i })
        await act(async () => { fireEvent.click(saveBtn) })
        await waitFor(() => {
            expect(mockMutate).toHaveBeenCalledWith(
                expect.objectContaining({ groupId: 1 }),
                expect.anything()
            )
        })
    })
})
