import { describe, expect, it } from "vitest"
import { DEFAULT_PERIOD, PERIOD_OPTIONS, periodToDateFrom } from "../period"

describe("periodToDateFrom", () => {
    it("omite la fecha para el histórico", () => {
        expect(periodToDateFrom("all")).toBeUndefined()
    })

    it("resta los meses de la clave", () => {
        expect(periodToDateFrom("3m", new Date(2026, 10, 20))).toBe("2026-08-20")
        expect(periodToDateFrom("24m", new Date(2026, 10, 20))).toBe("2024-11-20")
    })

    it("ajusta al último día del mes destino", () => {
        expect(periodToDateFrom("1m", new Date(2026, 2, 31))).toBe("2026-02-28")
    })
})

describe("PERIOD_OPTIONS", () => {
    it("lista los seis períodos en orden con Histórico al final", () => {
        expect(PERIOD_OPTIONS.map((o) => o.value)).toEqual(["1m", "3m", "6m", "12m", "24m", "all"])
        expect(PERIOD_OPTIONS[PERIOD_OPTIONS.length - 1].label).toBe("Histórico")
    })

    it("usa 12 meses por defecto", () => {
        expect(DEFAULT_PERIOD).toBe("12m")
    })
})
