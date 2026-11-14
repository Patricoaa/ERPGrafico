import { describe, it, expect } from "vitest"
import { format, addDays, subDays } from "date-fns"
import { terminalSyncSchema, toManualSyncPayload } from "../TerminalSyncModal.schema"

const fmt = (d: Date) => format(d, "yyyy-MM-dd")
const today = fmt(new Date())

function messages(values: unknown): string[] {
    const result = terminalSyncSchema.safeParse(values)
    return result.success ? [] : result.error.issues.map((i) => i.message)
}

describe("terminalSyncSchema", () => {
    it("acepta ambas fechas vacías", () => {
        expect(terminalSyncSchema.safeParse({ start_date: "", end_date: "" }).success).toBe(true)
        expect(terminalSyncSchema.safeParse({}).success).toBe(true)
    })

    it("acepta un rango válido que termina hoy", () => {
        expect(terminalSyncSchema.safeParse({ start_date: fmt(subDays(new Date(), 7)), end_date: today }).success).toBe(true)
    })

    it("rechaza una fecha final futura", () => {
        expect(messages({ start_date: "", end_date: fmt(addDays(new Date(), 1)) })).toContain("La fecha final no puede ser futura")
    })

    it("rechaza una fecha inicial posterior a la final", () => {
        const issues = terminalSyncSchema.safeParse({ start_date: today, end_date: fmt(subDays(new Date(), 3)) })
        expect(issues.success).toBe(false)
        if (!issues.success) {
            const issue = issues.error.issues.find((i) => i.message === "La fecha inicial debe ser anterior a la final")
            expect(issue?.path).toEqual(["start_date"])
        }
    })
})

describe("toManualSyncPayload", () => {
    it("omite las fechas vacías", () => {
        expect(toManualSyncPayload({ start_date: "", end_date: "" })).toEqual({})
        expect(toManualSyncPayload({ start_date: "2026-11-01", end_date: "" })).toEqual({ start_date: "2026-11-01" })
    })
})
