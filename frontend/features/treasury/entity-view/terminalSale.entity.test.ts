import { describe, expect, it } from "vitest"
import { formatDteType, terminalSaleEntity, terminalSaleMatchStatus } from "./terminalSale.entity"

describe("formatDteType", () => {
    it("joins the SII code and its label", () => {
        expect(formatDteType(39, "Boleta Electrónica")).toBe("39 · Boleta Electrónica")
    })

    it("is empty without a code", () => {
        expect(formatDteType(null, "")).toBe("")
    })
})

describe("match_status", () => {
    it("maps each status to its Spanish label and intent", () => {
        expect(terminalSaleMatchStatus("MATCHED", "Cuadrado")).toMatchObject({ status: "matched", label: "Cuadrado", intent: "success" })
        expect(terminalSaleMatchStatus("AMOUNT_DIFF", "Diferencia de monto").intent).toBe("warning")
        expect(terminalSaleMatchStatus("ONLY_ERP", "Falta en el SII/TUU").intent).toBe("destructive")
        expect(terminalSaleMatchStatus("EXCLUDED", "Excluido").intent).toBe("neutral")
        expect(terminalSaleMatchStatus("", "").label).toBe("Sin evaluar")
    })

    it("is a status column of the entity", () => {
        expect(terminalSaleEntity.fields.matchStatus).toBeDefined()
    })
})
