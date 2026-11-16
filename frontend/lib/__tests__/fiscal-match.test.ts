import { describe, expect, it } from "vitest"
import { matchStatusValue } from "../fiscal-match"

describe("matchStatusValue", () => {
    it("maps statuses to label and intent", () => {
        expect(matchStatusValue("MATCHED")).toEqual({ status: "matched", label: "Cuadrado", intent: "success" })
        expect(matchStatusValue("AMOUNT_DIFF").intent).toBe("warning")
        expect(matchStatusValue("ONLY_ERP").label).toBe("Falta en el SII/TUU")
        expect(matchStatusValue("EXCLUDED").intent).toBe("neutral")
        expect(matchStatusValue("PENDING_ERP")).toEqual({
            status: "pending_erp", label: "Sin documento ERP", intent: "warning",
        })
    })
    it("prefers the backend display text", () => {
        expect(matchStatusValue("MATCHED", "Cuadrada").label).toBe("Cuadrada")
    })
    it("renders empty as Sin evaluar", () => {
        expect(matchStatusValue("", null)).toMatchObject({ label: "Sin evaluar", intent: "neutral" })
    })
})
