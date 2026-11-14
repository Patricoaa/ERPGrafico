import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { defaultRcvImportPeriod, defaultRcvImportValues, rcvImportSchema, toStartRcvImportPayload } from "../rcv/RcvImportModal.schema"

describe("rcvImportSchema", () => {
    beforeEach(() => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date(2026, 10, 14, 12, 0, 0))
    })
    afterEach(() => vi.useRealTimers())

    it("acepta un período pasado con una dirección", () => {
        expect(rcvImportSchema.safeParse({ year: 2026, month: 10, directions: ["SALES"] }).success).toBe(true)
    })

    it("rechaza directions vacío", () => {
        const result = rcvImportSchema.safeParse({ year: 2026, month: 10, directions: [] })
        expect(result.success).toBe(false)
        expect(result.error?.issues[0]?.path).toEqual(["directions"])
    })

    it("rechaza un período futuro", () => {
        const result = rcvImportSchema.safeParse({ year: 2026, month: 12, directions: ["SALES"] })
        expect(result.success).toBe(false)
        expect(result.error?.issues[0]?.message).toBe("No se puede importar un período futuro")
        expect(rcvImportSchema.safeParse({ year: 2027, month: 1, directions: ["SALES"] }).success).toBe(false)
    })

    it("acepta el mes actual y rechaza años anteriores a 2017 o meses fuera de rango", () => {
        expect(rcvImportSchema.safeParse({ year: 2026, month: 11, directions: ["SALES"] }).success).toBe(true)
        expect(rcvImportSchema.safeParse({ year: 2016, month: 12, directions: ["SALES"] }).success).toBe(false)
        expect(rcvImportSchema.safeParse({ year: 2026, month: 13, directions: ["SALES"] }).success).toBe(false)
    })

    it("propone el mes de hoy − 3 días con ambas direcciones", () => {
        expect(defaultRcvImportValues()).toEqual({ year: 2026, month: 11, directions: ["PURCHASES", "SALES"] })
        expect(defaultRcvImportPeriod(new Date(2026, 0, 2))).toEqual({ year: 2025, month: 12 })
    })

    it("arma el payload de la API", () => {
        expect(toStartRcvImportPayload({ year: 2026, month: 10, directions: ["SALES"] })).toEqual({ year: 2026, month: 10, directions: ["SALES"] })
    })
})
