import { describe, it, expect } from "vitest"

import { decodeStack, encodeStack } from "../drilldownStackUrl"

describe("drilldownStackUrl", () => {
    it("only encodes two or more documents", () => {
        expect(encodeStack([])).toBe("")
        expect(encodeStack([{ label: "sales.saleorder", id: 1 }])).toBe("")
        expect(encodeStack([{ label: "sales.saleorder", id: 1 }, { label: "billing.invoice", id: 2 }]))
            .toBe("sales.saleorder:1,billing.invoice:2")
    })

    it("round-trips and drops malformed parts", () => {
        expect(decodeStack("sales.saleorder:1,billing.invoice:2")).toEqual([
            { label: "sales.saleorder", id: 1 },
            { label: "billing.invoice", id: 2 },
        ])
        expect(decodeStack("x:1,sales.saleorder:abc,sales.saleorder:0,Sales.Order:3,billing.invoice:2"))
            .toEqual([{ label: "billing.invoice", id: 2 }])
        expect(decodeStack(null)).toEqual([])
    })

    it("keeps at most the last 5 entries", () => {
        const raw = Array.from({ length: 8 }, (_, i) => `a.b:${i + 1}`).join(",")
        expect(decodeStack(raw).map((r) => r.id)).toEqual([4, 5, 6, 7, 8])
    })
})
