import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { SalaryAdvance } from "@/types/hr"
import { AdvanceDrawer } from "../AdvanceDrawer"

const m = vi.hoisted(() => ({ relationsCalls: [] as unknown[][] }))

vi.mock("@/features/documents", async (importOriginal) => ({
    ...await importOriginal<typeof import("@/features/documents")>(),
    DocumentRelationsTab: ({ label, id }: { label: string; id: number }) => <div data-testid="relations-tab">{label}#{id}</div>,
    useDocumentRelations: (...args: unknown[]) => (m.relationsCalls.push(args), { data: { relations: [1, 2, 3] } }),
}))
vi.mock("@/features/comments", () => ({ EntitySidebar: () => null }))
vi.mock("@/features/_shared", () => ({
    useDrawerIdentity: () => ({ title: "x", subtitle: "", icon: null, headerActions: null }),
    useDrawerMode: ({ mode, initialData }: { mode?: string; initialData: unknown }) => {
        const resolved = mode ?? (initialData ? "edit" : "create")
        return { mode: resolved, isView: resolved === "view" }
    },
    usePrintableDrawer: () => ({ printRef: { current: null }, handlePrint: vi.fn() }),
    PrintableLayout: () => null,
}))
vi.mock("@/features/hr/hooks/useEmployees", () => ({ useEmployees: () => ({ employees: [] }) }))
vi.mock("../../hooks/useAdvanceMutations", () => ({ useAdvanceMutations: () => ({ saveAdvance: vi.fn(), isSaving: false }) }))
vi.mock("@/hooks/useServerDate", () => ({ useServerDate: () => ({ dateString: "2026-11-23" }) }))
vi.mock("@/components/shared", async (importOriginal) => ({
    ...await importOriginal<typeof import("@/components/shared")>(),
    PeriodValidationDateInput: () => null,
}))

const record = {
    id: 9, employee: 5, employee_name: "Ana Pérez", amount: "50000", date: "2026-09-10",
    notes: "", status: "PAID", is_editable: true,
} as unknown as SalaryAdvance

beforeEach(() => { m.relationsCalls = [] })

describe("AdvanceDrawer — pestaña Relaciones", () => {
    it("shows Datos and Relaciones tabs for an existing record and renders hr.salaryadvance", async () => {
        render(<AdvanceDrawer open onOpenChange={vi.fn()} advance={record} onSaved={vi.fn()} />)
        expect(screen.getByRole("tab", { name: /Datos/ })).toBeInTheDocument()
        const tab = screen.getByRole("tab", { name: /Relaciones/ })
        expect(tab).toHaveTextContent("3")
        expect(m.relationsCalls).toContainEqual(["hr.salaryadvance", 9, { window: "recent" }])
        await userEvent.click(tab)
        expect(screen.getByTestId("relations-tab")).toHaveTextContent("hr.salaryadvance#9")
    })

    it("keeps Relaciones usable while the form is read-only (view mode)", async () => {
        render(<AdvanceDrawer open onOpenChange={vi.fn()} advance={record} mode="view" onSaved={vi.fn()} />)
        const tab = screen.getByRole("tab", { name: /Relaciones/ })
        expect(tab).not.toBeDisabled()
        await userEvent.click(tab)
        expect(screen.getByTestId("relations-tab")).toBeInTheDocument()
    })

    it("has no tabs and does not query relations when creating", () => {
        render(<AdvanceDrawer open onOpenChange={vi.fn()} advance={null} onSaved={vi.fn()} />)
        expect(screen.queryByRole("tab", { name: /Relaciones/ })).not.toBeInTheDocument()
        expect(m.relationsCalls.every(([, id]) => id === null)).toBe(true)
    })
})
