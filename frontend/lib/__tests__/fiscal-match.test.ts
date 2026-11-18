import { describe, expect, it } from "vitest"
import { FISCAL_MATCH_KEY, fiscalMatchStatusValue, partStateValue } from "../fiscal-match"

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
