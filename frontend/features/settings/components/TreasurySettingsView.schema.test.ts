import { describe, expect, it } from "vitest"
import { terminalSyncSettingsSchema, validateTerminalSyncSettings, type TerminalSyncSettingsFormValues } from "./TreasurySettingsView.schema"

const valid: TerminalSyncSettingsFormValues = {
    enabled: false,
    run_hour: 3,
    lookback_days: 7,
    history_start_date: null,
    max_retries: 3,
    retry_delay_minutes: 15,
}

describe("terminalSyncSettingsSchema", () => {
    it("accepts the default values", () => {
        expect(terminalSyncSettingsSchema.safeParse(valid).success).toBe(true)
    })

    it("accepts the boundary values", () => {
        expect(terminalSyncSettingsSchema.safeParse({ ...valid, run_hour: 0, lookback_days: 1, max_retries: 0, retry_delay_minutes: 1 }).success).toBe(true)
        expect(terminalSyncSettingsSchema.safeParse({ ...valid, run_hour: 23, lookback_days: 60, max_retries: 10, retry_delay_minutes: 120, history_start_date: "2026-01-01" }).success).toBe(true)
    })

    it("rejects run_hour 24", () => {
        expect(terminalSyncSettingsSchema.safeParse({ ...valid, run_hour: 24 }).success).toBe(false)
    })

    it("rejects lookback_days 0 and 61", () => {
        expect(terminalSyncSettingsSchema.safeParse({ ...valid, lookback_days: 0 }).success).toBe(false)
        expect(terminalSyncSettingsSchema.safeParse({ ...valid, lookback_days: 61 }).success).toBe(false)
    })

    it("rejects retry_delay_minutes 0 and max_retries 11", () => {
        expect(terminalSyncSettingsSchema.safeParse({ ...valid, retry_delay_minutes: 0 }).success).toBe(false)
        expect(terminalSyncSettingsSchema.safeParse({ ...valid, max_retries: 11 }).success).toBe(false)
    })
})

describe("validateTerminalSyncSettings", () => {
    it("returns true for valid values", () => {
        expect(validateTerminalSyncSettings(valid)).toBe(true)
    })

    it("returns the first issue message for out-of-range values", () => {
        expect(validateTerminalSyncSettings({ ...valid, lookback_days: 61 })).toBe("Entre 1 y 60")
    })

    it("rejects NaN from an emptied number input", () => {
        expect(validateTerminalSyncSettings({ ...valid, retry_delay_minutes: Number.NaN })).not.toBe(true)
    })
})
