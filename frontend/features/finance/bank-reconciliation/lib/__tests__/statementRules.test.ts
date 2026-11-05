import { describe, expect, it } from "vitest"
import { canDeleteStatement, canReconcileStatement, deleteBlockedReason } from "../statementRules"

describe("statementRules", () => {
    it("elimina solo borradores sin líneas trabajadas", () => {
        expect(canDeleteStatement({ state: "DRAFT", touched_lines: 0 })).toBe(true)
        expect(canDeleteStatement({ state: "DRAFT", touched_lines: 3 })).toBe(false)
        expect(canDeleteStatement({ state: "CONFIRMED", touched_lines: 0 })).toBe(false)
        expect(canDeleteStatement({ state: "CANCELLED", touched_lines: 0 })).toBe(false)
    })

    it("explica por qué no se puede eliminar", () => {
        expect(deleteBlockedReason({ state: "DRAFT", touched_lines: 0 })).toBeNull()
        expect(deleteBlockedReason({ state: "DRAFT", touched_lines: 2 })).toMatch(/conciliadas o excluidas/)
        expect(deleteBlockedReason({ state: "CONFIRMED", touched_lines: 0 })).toMatch(/borrador/)
    })

    it("reconcilia cartolas abiertas bajo 100 %", () => {
        expect(canReconcileStatement({ state: "DRAFT", reconciliation_progress: 40 })).toBe(true)
        expect(canReconcileStatement({ state: "DRAFT", reconciliation_progress: 100 })).toBe(false)
        expect(canReconcileStatement({ state: "CONFIRMED", reconciliation_progress: 40 })).toBe(false)
    })
})
