import { render, screen } from "@testing-library/react"
import { vi, describe, it, expect, beforeEach } from "vitest"
import { AccountRecordDrawer } from "../AccountRecordDrawer"

const m = vi.hoisted(() => ({ record: null as unknown, isError: false, byId: vi.fn(), drawer: vi.fn() }))

vi.mock("@/hooks/useRecordById", () => ({
    useRecordById: (endpoint: string, id: number | null) => { m.byId(endpoint, id); return { record: m.record, isLoading: false, isError: m.isError } },
}))
vi.mock("../../hooks/useAccounts", () => ({ useAccounts: () => ({ accounts: [{ id: 1 }, { id: 2 }] }) }))
vi.mock("@/features/comments", () => ({ EntitySidebar: ({ entityId }: { entityId: number }) => <span>audit:{entityId}</span> }))
vi.mock("@/components/shared", () => ({ SkeletonShell: ({ ariaLabel }: { ariaLabel: string }) => <div aria-label={ariaLabel} /> }))
vi.mock("@/features/finance", () => ({
    AccountDrawer: (props: { mode: string; accounts: unknown[]; initialData: { id: number }; auditSidebar: React.ReactNode }) => {
        m.drawer(props)
        return <div>drawer:{props.mode}:{props.initialData.id}:{props.accounts.length}{props.auditSidebar}</div>
    },
}))

const setup = (data?: unknown) => render(<AccountRecordDrawer id={7} data={data} open onOpenChange={vi.fn()} />)

describe("AccountRecordDrawer (ADR-0152)", () => {
    beforeEach(() => { m.record = null; m.isError = false; m.byId.mockReset(); m.drawer.mockReset() })

    it("with the row it does not fetch and opens in edit with the whole chart and the audit sidebar", () => {
        setup({ id: 7, code: "1.1" })
        expect(m.byId).toHaveBeenCalledWith("/accounting/accounts", null)
        expect(screen.getByText(/drawer:edit:7:2/)).toBeInTheDocument()
        expect(screen.getByText("audit:7")).toBeInTheDocument()
    })

    it("with only the id it loads the account first and shows a skeleton meanwhile", () => {
        const { rerender } = setup()
        expect(m.byId).toHaveBeenCalledWith("/accounting/accounts", 7)
        expect(screen.getByLabelText("Cargando cuenta contable")).toBeInTheDocument()
        m.record = { id: 7, code: "1.1" }
        rerender(<AccountRecordDrawer id={7} open onOpenChange={vi.fn()} />)
        expect(screen.getByText(/drawer:edit:7/)).toBeInTheDocument()
    })

    it("renders nothing when the account cannot be loaded (never a creation form)", () => {
        m.isError = true
        const { container } = setup()
        expect(container).toBeEmptyDOMElement()
    })
})
