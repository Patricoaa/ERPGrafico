import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Absence } from "@/types/hr"
import { AbsenceDrawer } from "../AbsenceDrawer"

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
vi.mock("../../hooks/useAbsenceMutations", () => ({ useAbsenceMutations: () => ({ saveAbsence: vi.fn(), isSaving: false }) }))
vi.mock("@/hooks/useServerDate", () => ({ useServerDate: () => ({ dateString: "2026-11-23" }) }))
vi.mock("@/components/shared", async (importOriginal) => ({
    ...await importOriginal<typeof import("@/components/shared")>(),
    PeriodValidationDateInput: () => null,
}))

const record = {
    id: 9, employee: 5, employee_name: "Ana Pérez", absence_type: "AUSENTISMO",
    start_date: "2026-09-02", end_date: "2026-09-03", days: 2, notes: "",
} as unknown as Absence

beforeEach(() => { m.relationsCalls = [] })

describe("AbsenceDrawer — pestaña Relaciones", () => {
    it("shows Datos and Relaciones tabs for an existing record and renders hr.absence", async () => {
        render(<AbsenceDrawer open onOpenChange={vi.fn()} absence={record} onSaved={vi.fn()} />)
        expect(screen.getByRole("tab", { name: /Datos/ })).toBeInTheDocument()
        const tab = screen.getByRole("tab", { name: /Relaciones/ })
        expect(tab).toHaveTextContent("3")
        expect(m.relationsCalls).toContainEqual(["hr.absence", 9, { window: "recent" }])
        await userEvent.click(tab)
        expect(screen.getByTestId("relations-tab")).toHaveTextContent("hr.absence#9")
    })

    it("keeps Relaciones usable while the form is read-only (view mode)", async () => {
        render(<AbsenceDrawer open onOpenChange={vi.fn()} absence={record} mode="view" onSaved={vi.fn()} />)
        const tab = screen.getByRole("tab", { name: /Relaciones/ })
        expect(tab).not.toBeDisabled()
        await userEvent.click(tab)
        expect(screen.getByTestId("relations-tab")).toBeInTheDocument()
    })

    it("has no tabs and does not query relations when creating", () => {
        render(<AbsenceDrawer open onOpenChange={vi.fn()} absence={null} onSaved={vi.fn()} />)
        expect(screen.queryByRole("tab", { name: /Relaciones/ })).not.toBeInTheDocument()
        expect(m.relationsCalls.every(([, id]) => id === null)).toBe(true)
    })
})
