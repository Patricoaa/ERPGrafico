import { describe, expect, it } from "vitest"
import { terminalSyncRunDetail } from "./terminalSyncRun.entity"

describe("terminalSyncRunDetail", () => {
    it("prefers the error message", () => {
        expect(terminalSyncRunDetail({ error_message: "Falló", warnings: ["a"] })).toBe("Falló")
    })

    it("summarizes warnings when there is no error", () => {
        expect(terminalSyncRunDetail({ error_message: "", warnings: ["a", "b"] })).toBe("2 aviso(s): a · b")
    })

    it("is empty without error or warnings", () => {
        expect(terminalSyncRunDetail({ error_message: "", warnings: [] })).toBe("")
    })
})
