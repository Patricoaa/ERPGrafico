import { describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { SplitAllocationDialog } from "../SplitAllocationDialog"
import type { ReconciliationSystemItem } from "../../types"

vi.mock("../../hooks/useReconciliationMutations", () => ({ useAllocateMutation: () => ({ allocate: vi.fn(), isAllocating: false }) }))
const INVOICES = [{ id: 7, display_id: "F-100", contact_name: "Cliente", total: "1000" }]
vi.mock("../../../hooks", () => ({ usePendingInvoices: () => ({ data: INVOICES, isLoading: false }) }))

const payment = { id: 1, amount: "1000", display_id: "PAG-1" } as unknown as ReconciliationSystemItem

describe("SplitAllocationDialog on FormLineItemsTable", () => {
    it("starts with one line for the whole amount and adds and removes lines through the frame", async () => {
        render(<SplitAllocationDialog open onOpenChange={vi.fn()} payment={payment} />)
        const table = await screen.findByRole("table")
        expect(within(table).getAllByRole("spinbutton")).toHaveLength(1)
        expect(within(table).getByRole("spinbutton")).toHaveValue(1000)

        await userEvent.click(screen.getByRole("button", { name: /Agregar distribución/i }))
        expect(within(table).getAllByRole("spinbutton")).toHaveLength(2)
        expect(within(table).getAllByRole("spinbutton")[1]).toHaveValue(0)
    })
})
