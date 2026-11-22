import { render, screen } from "@testing-library/react"
import { vi, describe, it, expect, beforeEach } from "vitest"
import { SubscriptionRecordDrawer } from "../SubscriptionRecordDrawer"

const m = vi.hoisted(() => ({ record: null as unknown, isError: false, byId: vi.fn() }))

vi.mock("@/hooks/useRecordById", () => ({
    useRecordById: (endpoint: string, id: number | null) => { m.byId(endpoint, id); return { record: m.record, isLoading: false, isError: m.isError } },
}))
vi.mock("@/components/shared", () => ({ SkeletonShell: ({ ariaLabel }: { ariaLabel: string }) => <div aria-label={ariaLabel} /> }))
vi.mock("@/features/inventory", () => ({ ProductDrawerById: ({ id }: { id: number }) => <div>producto:{id}</div> }))

describe("SubscriptionRecordDrawer (ADR-0152)", () => {
    beforeEach(() => { m.record = null; m.isError = false; m.byId.mockReset() })

    it("opens the subscription's product from the row without fetching", () => {
        render(<SubscriptionRecordDrawer id={4} data={{ id: 4, product: 21 }} open onOpenChange={vi.fn()} />)
        expect(m.byId).toHaveBeenCalledWith("/inventory/subscriptions", null)
        expect(screen.getByText("producto:21")).toBeInTheDocument()
    })

    it("with only the id loads the subscription first, then opens its product", () => {
        const { rerender } = render(<SubscriptionRecordDrawer id={4} open onOpenChange={vi.fn()} />)
        expect(m.byId).toHaveBeenCalledWith("/inventory/subscriptions", 4)
        expect(screen.getByLabelText("Cargando suscripción")).toBeInTheDocument()
        m.record = { id: 4, product: 21 }
        rerender(<SubscriptionRecordDrawer id={4} open onOpenChange={vi.fn()} />)
        expect(screen.getByText("producto:21")).toBeInTheDocument()
    })

    it("renders nothing when the subscription cannot be loaded", () => {
        m.isError = true
        const { container } = render(<SubscriptionRecordDrawer id={4} open onOpenChange={vi.fn()} />)
        expect(container).toBeEmptyDOMElement()
    })
})
