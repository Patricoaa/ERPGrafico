import { describe, it, expect } from "vitest"
import {
    EMPTY_STACK,
    overlayEntriesOf,
    paneEntryOf,
    popEntry,
    pushEntry,
    setRootEntry,
} from "../documentStack"

const order = { label: "sales.saleorder", id: 1, display: "OV-1" }
const product = { label: "inventory.product", id: 7, display: "Producto" }
const payment = { label: "finance.payment", id: 5, display: "Pago 5" }

describe("POS document stack", () => {
    it("selecting a list row replaces the whole stack", () => {
        const s = pushEntry(setRootEntry(EMPTY_STACK, order), product)
        const next = setRootEntry(s, { label: "sales.saleorder", id: 2 })
        expect(next.entries.map(e => e.id)).toEqual([2])
        expect(next.direction).toBe("forward")
    })

    it("pushing the same top entry twice is a no-op (double tap)", () => {
        const once = pushEntry(EMPTY_STACK, product)
        expect(pushEntry(once, product)).toBe(once)
    })

    it("back pops the top and reports a backward direction", () => {
        const s = pushEntry(setRootEntry(EMPTY_STACK, order), product)
        const back = popEntry(s)
        expect(back.entries.map(e => e.key)).toEqual(["sales.saleorder:1"])
        expect(back.direction).toBe("back")
        expect(popEntry(EMPTY_STACK)).toBe(EMPTY_STACK)
    })

    it("every entity stacks on top of the pane document, with no depth limit", () => {
        const s = pushEntry(pushEntry(pushEntry(setRootEntry(EMPTY_STACK, order), payment), { label: "billing.invoice", id: 9 }), product)
        expect(s.entries.map(e => e.key)).toEqual(["sales.saleorder:1", "finance.payment:5", "billing.invoice:9", "inventory.product:7"])
        expect(paneEntryOf(s.entries)?.id).toBe(1)
        expect(overlayEntriesOf(s.entries).map(e => e.key)).toEqual(["finance.payment:5", "billing.invoice:9", "inventory.product:7"])
    })

    it("reopening an entry already in the stack trims back to it instead of duplicating", () => {
        const s = pushEntry(pushEntry(setRootEntry(EMPTY_STACK, order), payment), product)
        const again = pushEntry(s, payment)
        expect(again.entries.map(e => e.key)).toEqual(["sales.saleorder:1", "finance.payment:5"])
        expect(again.direction).toBe("back")
    })

    it("no overlays when only the pane document is open", () => {
        const s = setRootEntry(EMPTY_STACK, order)
        expect(overlayEntriesOf(s.entries)).toEqual([])
        expect(paneEntryOf(s.entries)?.id).toBe(1)
    })

    it("an entity opened with an empty stack is an overlay, not a pane document", () => {
        const s = pushEntry(EMPTY_STACK, product)
        expect(paneEntryOf(s.entries)).toBeNull()
        expect(overlayEntriesOf(s.entries).map(e => e.key)).toEqual(["inventory.product:7"])
    })
})
