import { describe, expect, it } from "vitest"
import { FISCAL_MATCH_KEY, cuadreAttentionHref, fiscalMatchStatusValue, partStateValue } from "../fiscal-match"

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
    it("«Ir al cuadre» abre ventas y compras del mes que necesitan atención", () => {
        // El conteo del F29 y del cierre cuenta ambas direcciones: el enlace no puede filtrar solo ventas.
        expect(cuadreAttentionHref(2026, 2)).toBe(
            "/accounting/rcv/cuadre?direction=all&status=attention&date_from=2026-02-01&date_to=2026-02-28",
        )
    })
})
