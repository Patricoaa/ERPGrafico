import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { EmployeeMovement } from "@/types/hr"
import { EmployeeMovementDrawer } from "../EmployeeMovementDrawer"

const m = vi.hoisted(() => ({ relationsCalls: [] as unknown[][], create: vi.fn(), preview: vi.fn() }))

vi.mock("@/features/documents", async (importOriginal) => ({
    ...await importOriginal<typeof import("@/features/documents")>(),
    DocumentRelationsTab: ({ label, id }: { label: string; id: number }) => <div data-testid="relations-tab">{label}#{id}</div>,
    useDocumentRelations: (...args: unknown[]) => (m.relationsCalls.push(args), { data: { relations: [1, 2, 3] } }),
}))
vi.mock("@/features/comments", () => ({ EntitySidebar: () => null }))
vi.mock("@/features/_shared", () => ({
    useDrawerIdentity: () => ({ title: "x", subtitle: "", icon: null, headerActions: null }),
    usePrintableDrawer: () => ({ printRef: { current: null }, handlePrint: vi.fn() }),
    PrintableLayout: () => null,
}))
vi.mock("@/features/hr/hooks/useEmployees", () => ({ useEmployees: () => ({ employees: [] }) }))
vi.mock("../../hooks/useEmployeeMovementMutations", () => ({
    useEmployeeMovementMutations: () => ({ createMovement: m.create, isSaving: false, previewSchedule: m.preview, isPreviewing: false }),
}))
vi.mock("@/hooks/useServerDate", () => ({ useServerDate: () => ({ dateString: "2026-11-23" }) }))
vi.mock("@/components/shared", async (importOriginal) => ({
    ...await importOriginal<typeof import("@/components/shared")>(),
    PeriodValidationDateInput: () => null,
    LabeledSelect: ({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) => (
        <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
            <option value="" />
            {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
    ),
}))

/** LabeledInput es un fieldset con legend: el campo se ubica por el grupo con ese nombre. */
const numberField = (name: RegExp) => within(screen.getByRole("group", { name })).getByRole("textbox")

const posted = {
    id: 9, display_id: "MOV-9", employee: 5, employee_name: "Ana Pérez", kind: "ADVANCE", amount: "50000", date: "2026-09-10",
    notes: "", status: "POSTED", is_editable: false, installments: [], allocations: [],
} as unknown as EmployeeMovement

const employees = [{ id: 5, display_id: "EMP-5", is_active: true, contact_detail: { name: "Ana Pérez" } } as never]

beforeEach(() => { m.relationsCalls = []; m.create.mockReset(); m.preview.mockReset() })

describe("EmployeeMovementDrawer", () => {
    it("creates an advance with kind ADVANCE", async () => {
        const onSaved = vi.fn()
        render(<EmployeeMovementDrawer open onOpenChange={vi.fn()} movement={null} employees={employees} onSaved={onSaved} />)
        await userEvent.selectOptions(screen.getByLabelText("Empleado"), "5")
        await userEvent.type(numberField(/Monto/), "50000")
        await userEvent.click(screen.getByRole("button", { name: /Registrar/ }))
        await waitFor(() => expect(onSaved).toHaveBeenCalled())
        expect(onSaved.mock.calls[0][0]).toMatchObject({ kind: "ADVANCE", employee: 5, amount: "50000" })
    })

    it("shows loan fields and the schedule preview when the type is Préstamo", async () => {
        m.preview.mockResolvedValue([{ number: 1, year: 2026, month: 12, principal: 97529, interest: 6000, amount: 103529 }])
        render(<EmployeeMovementDrawer open onOpenChange={vi.fn()} movement={null} employees={employees} onSaved={vi.fn()} />)
        expect(screen.queryByRole("group", { name: /Tasa/ })).not.toBeInTheDocument()
        await userEvent.selectOptions(screen.getByLabelText("Tipo"), "LOAN")
        expect(numberField(/Tasa/)).toBeInTheDocument()
        await userEvent.type(numberField(/Monto/), "600000")
        await userEvent.type(numberField(/Tasa/), "1")
        await userEvent.click(screen.getByRole("button", { name: /Calcular cuotas/ }))
        await waitFor(() => expect(m.preview).toHaveBeenCalledWith(expect.objectContaining({ amount: 600000, rate: "0.01", rate_period: "MONTHLY" })))
        expect(await screen.findByText(/103\.529/)).toBeInTheDocument()
    })

    it("keeps Relaciones usable and the form read-only for a posted movement", async () => {
        render(<EmployeeMovementDrawer open onOpenChange={vi.fn()} movement={posted} employees={employees} onSaved={vi.fn()} />)
        expect(m.relationsCalls).toContainEqual(["hr.employeemovement", 9, { window: "recent" }])
        expect(numberField(/Monto/)).toBeDisabled()
        const tab = screen.getByRole("tab", { name: /Relaciones/ })
        expect(tab).toHaveTextContent("3")
        await userEvent.click(tab)
        expect(screen.getByTestId("relations-tab")).toHaveTextContent("hr.employeemovement#9")
    })
})
