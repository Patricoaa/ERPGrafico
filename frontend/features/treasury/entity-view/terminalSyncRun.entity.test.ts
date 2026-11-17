import { describe, expect, it } from "vitest"
import { formatTerminalSyncDuration, terminalSyncRunDetail } from "./terminalSyncRun.entity"

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

describe("formatTerminalSyncDuration", () => {
    it("formats m:ss between start and end", () => {
        expect(formatTerminalSyncDuration("2026-11-17T10:00:00Z", "2026-11-17T10:01:05Z")).toBe("1:05")
    })

    it("is a dash while the run has not finished", () => {
        expect(formatTerminalSyncDuration("2026-11-17T10:00:00Z", null)).toBe("—")
    })
})
