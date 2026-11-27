import { describe, expect, it } from "vitest"
import { rcvSettingsSchema, validateRcvSettings, type RcvSettingsFormValues } from "./RcvSettingsView.schema"
import { rcvApiKeySchema, missingRcvKeyMessage } from "./rcvApiKeyModal.schema"

const base: RcvSettingsFormValues = {
    company_rut: "", user_rut: "", enabled: false, interval_days: 7, run_hour: 6, include_purchases: true, include_sales: true,
    fiscal_match_start_date: null, terminal_match_window_minutes: 15,
}

describe("rcvSettingsSchema", () => {
    it("rechaza un RUT con dígito verificador incorrecto", () => {
        const result = rcvSettingsSchema.safeParse({ ...base, company_rut: "8973356-2" })
        expect(result.success).toBe(false)
        expect(result.error?.issues[0]?.message).toBe("RUT inválido")
    })
    it("acepta un RUT válido con formato y RUTs vacíos", () => {
        expect(rcvSettingsSchema.safeParse({ ...base, company_rut: "8.973.356-1" }).success).toBe(true)
        expect(rcvSettingsSchema.safeParse(base).success).toBe(true)
    })
    it("acota los días y la hora", () => {
        expect(rcvSettingsSchema.safeParse({ ...base, interval_days: 0 }).success).toBe(false)
        expect(rcvSettingsSchema.safeParse({ ...base, interval_days: 61 }).success).toBe(false)
        expect(rcvSettingsSchema.safeParse({ ...base, run_hour: 24 }).success).toBe(false)
    })
    it("acota la ventana del cuadre TUU entre 1 y 240 minutos", () => {
        expect(rcvSettingsSchema.safeParse({ ...base, terminal_match_window_minutes: 0 }).success).toBe(false)
        expect(rcvSettingsSchema.safeParse({ ...base, terminal_match_window_minutes: 241 }).success).toBe(false)
        expect(rcvSettingsSchema.safeParse({ ...base, terminal_match_window_minutes: 1 }).success).toBe(true)
        expect(rcvSettingsSchema.safeParse({ ...base, terminal_match_window_minutes: 240 }).success).toBe(true)
    })
    it("acepta la fecha de inicio del cuadre vacía o ISO", () => {
        expect(rcvSettingsSchema.safeParse({ ...base, fiscal_match_start_date: "2026-11-01" }).success).toBe(true)
        expect(rcvSettingsSchema.safeParse({ ...base, fiscal_match_start_date: "01/11/2026" }).success).toBe(false)
    })
    it("exige compras o ventas solo si está activada", () => {
        const none = { ...base, include_purchases: false, include_sales: false }
        expect(validateRcvSettings(none)).toBe(true)
        expect(validateRcvSettings({ ...none, enabled: true })).toBe("Selecciona compras, ventas o ambas")
    })
})

describe("rcvApiKeySchema", () => {
    const key = { label: "", key: "", is_active: true }
    it("acota la etiqueta", () => {
        expect(rcvApiKeySchema.safeParse(key).success).toBe(true)
        expect(rcvApiKeySchema.safeParse({ ...key, label: "x".repeat(61) }).success).toBe(false)
    })
    it("la key es obligatoria solo al crear", () => {
        expect(missingRcvKeyMessage(key, false)).toBe("La API key es obligatoria")
        expect(missingRcvKeyMessage(key, true)).toBeNull()
        expect(missingRcvKeyMessage({ ...key, key: "abc" }, false)).toBeNull()
    })
})
