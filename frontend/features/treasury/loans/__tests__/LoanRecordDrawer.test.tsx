import { render, screen, fireEvent } from "@testing-library/react"
import { vi, describe, it, expect } from "vitest"
import { LoanRecordDrawer } from "../LoanRecordDrawer"

const m = vi.hoisted(() => ({ openAction: vi.fn() }))

vi.mock("@/hooks/useEntityRouteActions", () => ({ useEntityRouteActions: () => ({ openAction: m.openAction }) }))
vi.mock("../LoanViewDrawer", () => ({
    LoanViewDrawer: ({ loanId, onDisburse }: { loanId: number; onDisburse: (loan: { id: number }) => void }) => (
        <button onClick={() => onDisburse({ id: loanId })}>detalle:{loanId}</button>
    ),
}))

describe("LoanRecordDrawer (ADR-0152)", () => {
    it("shows the loan by id and delegates disbursing to the page's disburse tab", () => {
        render(<LoanRecordDrawer id={9} open onOpenChange={vi.fn()} />)
        fireEvent.click(screen.getByText("detalle:9"))
        expect(m.openAction).toHaveBeenCalledWith(9, "disburse")
    })
})
