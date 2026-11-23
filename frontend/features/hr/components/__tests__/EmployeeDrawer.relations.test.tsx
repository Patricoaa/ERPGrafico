import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Employee } from "@/types/hr"
import { EmployeeDrawer } from "../EmployeeDrawer"

const m = vi.hoisted(() => ({ relationsCalls: [] as unknown[][] }))

vi.mock("@/features/documents", async (importOriginal) => ({
    ...await importOriginal<typeof import("@/features/documents")>(),
    DocumentRelationsTab: ({ label, id }: { label: string; id: number }) => <div data-testid="relations-tab">{label}#{id}</div>,
    useDocumentRelations: (...args: unknown[]) => (m.relationsCalls.push(args), { data: { relations: [1, 2, 3] } }),
}))
vi.mock("@/features/comments", () => ({ EntitySidebar: () => null }))
vi.mock("@/features/_shared", () => ({
    useDrawerIdentity: () => ({ title: "Empleado", subtitle: "", icon: null, headerActions: null }),
    useDrawerMode: ({ initialData }: { initialData: unknown }) => ({ mode: initialData ? "view" : "create", isView: !!initialData }),
    usePrintableDrawer: () => ({ printRef: { current: null }, handlePrint: vi.fn() }),
    PrintableLayout: () => null,
}))
vi.mock("../../hooks/useEmployees", () => ({
    useEmployeeFormDeps: () => ({ employeeFormDeps: { afps: [], concepts: [] }, isLoading: false, isError: false }),
}))
vi.mock("../../hooks/useEmployeeMutations", () => ({
    useEmployeeMutations: () => ({ saveEmployee: vi.fn(), isSaving: false }),
}))
vi.mock("@/hooks/useServerDate", () => ({ useServerDate: () => ({ dateString: "2026-11-23" }) }))
vi.mock("@/components/selectors/AdvancedContactSelector", () => ({ AdvancedContactSelector: () => null }))

const employee = {
    id: 5, code: "1", display_id: "EMP-1", contact: 1, contact_detail: { name: "Ana Pérez" },
    position: "", department: "", start_date: null, end_date: null, is_active: true,
    contract_type: "INDEFINIDO", base_salary: "500000", afp: null, salud_type: "FONASA",
    isapre_amount_uf: "0", jornada_type: "ORDINARIA_22", jornada_hours: "44", trabajo_pesado: false,
    trabajo_agricola: false, gratificacion: true, dias_pactados: 30, asignacion_familiar: "D",
    cargas_familiares: 0, concept_amounts: [],
} as unknown as Employee

beforeEach(() => { m.relationsCalls = [] })

describe("EmployeeDrawer — pestaña Relaciones", () => {
    it("shows a Relaciones tab with the relations count and renders the tab for hr.employee", async () => {
        render(<EmployeeDrawer open onOpenChange={vi.fn()} employee={employee} onSaved={vi.fn()} />)
        const tab = screen.getByRole("tab", { name: /Relaciones/ })
        expect(tab).toHaveTextContent("3")
        await userEvent.click(tab)
        expect(screen.getByTestId("relations-tab")).toHaveTextContent("hr.employee#5")
    })

    it("asks for the same recent window the tab uses (one shared request)", () => {
        render(<EmployeeDrawer open onOpenChange={vi.fn()} employee={employee} onSaved={vi.fn()} />)
        expect(m.relationsCalls).toContainEqual(["hr.employee", 5, { window: "recent" }])
    })

    it("has no Relaciones tab when creating a new employee", () => {
        render(<EmployeeDrawer open onOpenChange={vi.fn()} employee={null} onSaved={vi.fn()} />)
        expect(screen.queryByRole("tab", { name: /Relaciones/ })).not.toBeInTheDocument()
        expect(m.relationsCalls.every(([, id]) => id === null)).toBe(true)
    })
})
