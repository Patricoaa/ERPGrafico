import { describe, expect, it } from "vitest"
import { formatEntityDisplay } from "../entity-registry"

describe("formatEntityDisplay", () => {
    it("returns '' for a null record (selector rendered before any value exists)", () => {
        expect(formatEntityDisplay("production.workorder", null)).toBe("")
    })

    it("returns '' for undefined", () => {
        expect(formatEntityDisplay("production.workorder", undefined)).toBe("")
    })

    it("returns '' for non-object data", () => {
        // @ts-expect-error — runtime guard for callers that pass a primitive by mistake
        expect(formatEntityDisplay("production.workorder", "OT-1")).toBe("")
    })

    it("prefers the backend-supplied display_id", () => {
        expect(
            formatEntityDisplay("sales.saleorder", { id: 7, number: "000007", display_id: "OV-7" }),
        ).toBe("OV-7")
    })

    it("falls back to the registry shortTemplate", () => {
        expect(formatEntityDisplay("production.workorder", { id: 12, number: "12" })).toBe("OT-12")
    })

    it("falls back to data.id when the entity has no template", () => {
        expect(formatEntityDisplay("unknown.entity", { id: 42 })).toBe("42")
    })
})
