import { describe, it, expect } from "vitest"
import { documentRefTarget } from "../documentNavigation"

describe("documentRefTarget (ADR-0086)", () => {
    it("normalizes a DocumentRef payload, preferring display_id", () => {
        const target = documentRefTarget({
            label: "sales.saleorder",
            id: 12,
            display_id: "OV-12",
            display: "ignored",
            url: "/sales/orders?selected=12",
        })
        expect(target).toEqual({
            label: "sales.saleorder",
            id: 12,
            display: "OV-12",
            url: "/sales/orders?selected=12",
        })
    })

    it("falls back to display and nulls a missing url", () => {
        const target = documentRefTarget({
            label: "inventory.stockmove",
            id: 7,
            display: "MOV-7",
        })
        expect(target).toEqual({
            label: "inventory.stockmove",
            id: 7,
            display: "MOV-7",
            url: null,
        })
    })

    it("returns null for non-DocumentRef values", () => {
        expect(documentRefTarget(null)).toBeNull()
        expect(documentRefTarget(undefined)).toBeNull()
        expect(documentRefTarget("OV-12")).toBeNull()
        expect(documentRefTarget({ label: "sales.saleorder", id: 12 })).toBeNull() // no display
        expect(documentRefTarget({ label: "sales.saleorder", display: "OV-12" })).toBeNull() // no id
        expect(documentRefTarget({ id: 12, display: "OV-12" })).toBeNull() // no label
    })
})
