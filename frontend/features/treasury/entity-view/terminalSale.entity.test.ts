import { describe, expect, it } from "vitest"
import { formatDteType } from "./terminalSale.entity"

describe("formatDteType", () => {
    it("joins the SII code and its label", () => {
        expect(formatDteType(39, "Boleta Electrónica")).toBe("39 · Boleta Electrónica")
    })

    it("is empty without a code", () => {
        expect(formatDteType(null, "")).toBe("")
    })
})
