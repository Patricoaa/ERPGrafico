import { describe, expect, it } from "vitest"
import { dteSideSchema } from "./DteSettingsView.schema"

describe("dteSideSchema", () => {
    it("accepts one or more supported DTE types", () => {
        expect(dteSideSchema.safeParse({ allowed_dte_types: ["FACTURA", "BOLETA"] }).success).toBe(true)
    })

    it("rejects an empty selection", () => {
        expect(dteSideSchema.safeParse({ allowed_dte_types: [] }).success).toBe(false)
    })

    it("rejects values outside the supported DTE types", () => {
        expect(dteSideSchema.safeParse({ allowed_dte_types: ["PURCHASE_INV"] }).success).toBe(false)
    })
})
