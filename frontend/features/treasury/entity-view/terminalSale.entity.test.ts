import { describe, expect, it } from "vitest"
import type { FiscalMatchStatus } from "@/lib/fiscal-match"
import { formatDteType, terminalSaleEntity, terminalSaleMatchStatus } from "./terminalSale.entity"

describe("formatDteType", () => {
    it("joins the SII code and its label", () => {
        expect(formatDteType(39, "Boleta Electrónica")).toBe("39 · Boleta Electrónica")
    })

    it("is empty without a code", () => {
        expect(formatDteType(null, "")).toBe("")
    })
})

describe("fiscal_match", () => {
    const ref = (status: FiscalMatchStatus, status_display: string) => ({ id: 1, status, status_display })

    it("maps the group status to its Spanish label and intent", () => {
        expect(terminalSaleMatchStatus(ref("MATCHED", "Cuadrado"))).toMatchObject({ status: "matched", label: "Cuadrado", intent: "success" })
        expect(terminalSaleMatchStatus(ref("DIFF", "Con advertencias")).intent).toBe("warning")
        expect(terminalSaleMatchStatus(ref("MISSING_EXTERNAL", "Falta en SII/TUU")).intent).toBe("destructive")
        expect(terminalSaleMatchStatus(ref("EXCLUDED", "Excluido")).intent).toBe("neutral")
        expect(terminalSaleMatchStatus(null).label).toBe("Sin evaluar")
    })

    it("is a status column of the entity", () => {
        expect(terminalSaleEntity.fields.matchStatus).toBeDefined()
    })
})
