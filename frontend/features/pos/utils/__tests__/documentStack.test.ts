import { describe, it, expect } from "vitest"
import {
    EMPTY_STACK,
    overlayEntryOf,
    paneEntryOf,
    popEntry,
    pushEntry,
    setRootEntry,
} from "../documentStack"

const order = { label: "sales.saleorder", id: 1, display: "OV-1" }
const product = { label: "inventory.product", id: 7, display: "Producto" }
const ot = { label: "production.workorder", id: 3, display: "OT-3" }

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

    it("a document replaces the open one instead of stacking (no drill-back)", () => {
        const s = pushEntry(pushEntry(setRootEntry(EMPTY_STACK, order), product), { label: "billing.invoice", id: 9 })
        expect(s.entries.map(e => e.key)).toEqual(["billing.invoice:9"])
        expect(paneEntryOf(s.entries)?.label).toBe("billing.invoice")
        expect(overlayEntryOf(s.entries)).toBeNull()
    })

    it("a nested drawer replaces the previous one: never a chain of drawers", () => {
        const s = pushEntry(pushEntry(setRootEntry(EMPTY_STACK, order), product), ot)
        expect(s.entries.map(e => e.key)).toEqual(["sales.saleorder:1", "production.workorder:3"])
        expect(paneEntryOf(s.entries)?.label).toBe("sales.saleorder")
        expect(overlayEntryOf(s.entries)?.label).toBe("production.workorder")
    })

    it("no overlay when the top is a document of the pane", () => {
        const s = setRootEntry(EMPTY_STACK, order)
        expect(overlayEntryOf(s.entries)).toBeNull()
        expect(paneEntryOf(s.entries)?.id).toBe(1)
    })
})
