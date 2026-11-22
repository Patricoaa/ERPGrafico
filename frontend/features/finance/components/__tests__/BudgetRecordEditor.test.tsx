import { render, screen, act } from "@testing-library/react"
import { vi, describe, it, expect, beforeEach } from "vitest"
import { toast } from "sonner"
import { BudgetRecordEditor } from "../BudgetRecordEditor"

const m = vi.hoisted(() => ({ record: null as unknown, isError: false, byId: vi.fn(), invalidate: vi.fn(), onSave: undefined as undefined | (() => void) }))

vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: m.invalidate }) }))
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }))
vi.mock("@/hooks/useRecordById", () => ({
    useRecordById: (endpoint: string, id: number | null) => { m.byId(endpoint, id); return { record: m.record, isLoading: false, isError: m.isError } },
}))
vi.mock("@/components/shared", () => ({ SkeletonShell: ({ ariaLabel }: { ariaLabel: string }) => <div aria-label={ariaLabel} /> }))
vi.mock("../../hooks/queryKeys", () => ({ FINANCE_KEYS: { budgets: { lists: () => ["finance", "budgets", "list"] } } }))
vi.mock("../BudgetEditor", () => ({
    BudgetEditor: (props: { budget: { id: number }; onSave: () => void }) => {
        m.onSave = props.onSave
        return <div>editor:{props.budget.id}</div>
    },
}))

describe("BudgetRecordEditor (ADR-0152)", () => {
    beforeEach(() => { m.record = null; m.isError = false; m.byId.mockReset(); m.invalidate.mockReset(); m.onSave = undefined; vi.mocked(toast.success).mockReset() })

    it("uses the row without fetching", () => {
        render(<BudgetRecordEditor id={3} data={{ id: 3, name: "2026" }} open onOpenChange={vi.fn()} />)
        expect(m.byId).toHaveBeenCalledWith("/accounting/budgets", null)
        expect(screen.getByText("editor:3")).toBeInTheDocument()
    })

    it("with only the id loads the budget first", () => {
        render(<BudgetRecordEditor id={3} open onOpenChange={vi.fn()} />)
        expect(m.byId).toHaveBeenCalledWith("/accounting/budgets", 3)
        expect(screen.getByLabelText("Cargando presupuesto")).toBeInTheDocument()
    })

    it("saving refreshes the list and announces it, without closing the tab", () => {
        const onOpenChange = vi.fn()
        render(<BudgetRecordEditor id={3} data={{ id: 3 }} open onOpenChange={onOpenChange} />)
        act(() => m.onSave?.())
        expect(m.invalidate).toHaveBeenCalledWith({ queryKey: ["finance", "budgets", "list"] })
        expect(toast.success).toHaveBeenCalledWith("Presupuesto actualizado")
        expect(onOpenChange).not.toHaveBeenCalled()
    })

    it("renders nothing when the budget cannot be loaded", () => {
        m.isError = true
        const { container } = render(<BudgetRecordEditor id={3} open onOpenChange={vi.fn()} />)
        expect(container).toBeEmptyDOMElement()
    })
})
