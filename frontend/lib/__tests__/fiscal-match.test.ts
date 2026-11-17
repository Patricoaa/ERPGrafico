import { describe, expect, it } from "vitest"
import { FISCAL_MATCH_KEY, fiscalMatchStatusValue, matchStatusValue, partStateValue } from "../fiscal-match"

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

describe("cuadre por grupo", () => {
    it("maps group statuses", () => {
        expect(fiscalMatchStatusValue("DIFF")).toEqual({ status: "diff", label: "Con diferencia", intent: "warning" })
        expect(fiscalMatchStatusValue("MISSING_EXTERNAL")).toMatchObject({ label: "Falta en SII/TUU", intent: "destructive" })
        expect(fiscalMatchStatusValue("PENDING").intent).toBe("neutral")
        expect(fiscalMatchStatusValue("MATCHED", "Cuadrada").label).toBe("Cuadrada")
    })
    it("maps part states", () => {
        expect(partStateValue("MATCHED")).toEqual({ status: "matched", label: "Cuadrado", intent: "success" })
        expect(partStateValue("MISSING").intent).toBe("destructive")
        expect(partStateValue("SUMMARY_ONLY")).toMatchObject({ label: "Solo resumen", intent: "neutral" })
        expect(partStateValue("AMBIGUOUS").intent).toBe("warning")
    })
    it("exposes the key prefix", () => {
        expect(FISCAL_MATCH_KEY).toEqual(["fiscal-match"])
    })
})
