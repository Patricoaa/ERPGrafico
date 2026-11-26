import { describe, expect, it, vi, beforeEach } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { DraftCartsClientView, type DraftCart } from "../DraftCartsClientView"

const getDrafts = vi.fn<(params: unknown) => Promise<DraftCart[]>>()
vi.mock("../../api/posApi", () => ({ posApi: { getDrafts: (params: unknown) => getDrafts(params), deleteDraft: vi.fn() } }))

function draft(id: number, overrides: Partial<DraftCart> = {}): DraftCart {
    return {
        id, session_local_id: id, name: `Mesa ${id}`, notes: "", customer: null, customer_name: null, items: [],
        total_net: 1000, total_gross: 1190, item_count: 2, created_by_full_name: null, last_modified_by_full_name: null,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(), pos_session: 1, ...overrides,
    }
}

function setup(props: Partial<React.ComponentProps<typeof DraftCartsClientView>> = {}) {
    const onLoadDraft = vi.fn()
    render(<DraftCartsClientView posSessionId={1} open onOpenChange={vi.fn()} showTrigger={false} onLoadDraft={onLoadDraft} {...props} />)
    return { user: userEvent.setup(), onLoadDraft }
}

describe("DraftCartsClientView (entity-view)", () => {
    beforeEach(() => getDrafts.mockReset())

    it("lists the session drafts and loads one from its row", async () => {
        getDrafts.mockResolvedValue([draft(1, { customer_name: "Viña Los Robles" })])
        const { user, onLoadDraft } = setup()
        const row = (await screen.findByText("Mesa 1")).closest("tr")
        expect(row).not.toBeNull()
        expect(within(row as HTMLElement).getByText("Viña Los Robles")).toBeInTheDocument()
        await user.click(within(row as HTMLElement).getByRole("button", { name: /Cargar/ }))
        expect(onLoadDraft).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }))
    })

    it("blocks a draft another user is editing and the current one", async () => {
        getDrafts.mockResolvedValue([draft(1, { is_locked: true, locked_by_name: "Ana" }), draft(2)])
        setup({ currentDraftId: 2 })
        const locked = (await screen.findByText("Mesa 1")).closest("tr") as HTMLElement
        expect(within(locked).getByText("Ana")).toBeInTheDocument()
        expect(within(locked).getByRole("button", { name: /En uso/ })).toBeDisabled()
        const current = screen.getByText("Mesa 2").closest("tr") as HTMLElement
        expect(within(current).getByRole("button", { name: /Actual/ })).toBeDisabled()
        expect(within(current).getByRole("button", { name: "Eliminar Mesa 2" })).toBeDisabled()
    })

    it("says so when the session has no drafts", async () => {
        getDrafts.mockResolvedValue([])
        setup()
        expect(await screen.findByText("No hay borradores en esta sesión")).toBeInTheDocument()
    })
})
