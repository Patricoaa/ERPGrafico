import { describe, expect, it } from "vitest"
import { hrSchema } from "../hr"
import { globalSettingsSchema } from "../../components/HRSettingsView.schema"

describe("ajustes de RRHH para préstamos (ADR-0156)", () => {
    it("hrSchema conserva las cuentas de préstamos e intereses", () => {
        const parsed = hrSchema.parse({
            account_remuneraciones_por_pagar: null, account_previred_por_pagar: null, account_anticipos: "1",
            account_prestamos_trabajadores: "2", account_intereses_prestamos: "3",
        })
        expect(parsed.account_prestamos_trabajadores).toBe("2")
        expect(parsed.account_intereses_prestamos).toBe("3")
    })

    it("el formulario global conserva el tope de descuento", () => {
        const parsed = globalSettingsSchema.parse({ uf_current_value: "1", utm_current_value: "1", min_wage_value: "1", loan_deduction_cap_percent: "15" })
        expect(parsed.loan_deduction_cap_percent).toBe("15")
    })

    it("rechaza un tope fuera de 0–100", () => {
        const base = { uf_current_value: "1", utm_current_value: "1", min_wage_value: "1" }
        expect(globalSettingsSchema.safeParse({ ...base, loan_deduction_cap_percent: "150" }).success).toBe(false)
        expect(globalSettingsSchema.safeParse({ ...base, loan_deduction_cap_percent: "-1" }).success).toBe(false)
    })
})
