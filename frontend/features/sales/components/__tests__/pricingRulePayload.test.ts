import { describe, it, expect } from "vitest"
import { buildPricingRulePayload, rulePriceFromGross, rulePriceFromNet } from "../pricingRulePayload"

const base = { name: "r", rule_type: "FIXED" as const, operator: "GE", product: 1, priority: 0, active: true }

describe("pricingRulePayload (ADR-0151)", () => {
    it("bruto 1450 -> payload solo fixed_price_gross", () => {
        const f = rulePriceFromGross("1450", 1.19)
        expect(f).toEqual({ gross: "1450", net: "1218" })
        const p = buildPricingRulePayload({ ...base, fixed_price: f.net, fixed_price_gross: f.gross })
        expect(p).toMatchObject({ fixed_price_gross: 1450 })
        expect(p).not.toHaveProperty("fixed_price")
    })
    it("neto 1218 -> payload fixed_price_gross 1449", () => {
        const f = rulePriceFromNet("1218", 1.19)
        expect(f).toEqual({ gross: "1449", net: "1218" })
        const p = buildPricingRulePayload({ ...base, fixed_price: f.net, fixed_price_gross: f.gross })
        expect(p).toMatchObject({ fixed_price_gross: 1449 })
        expect(p).not.toHaveProperty("fixed_price")
    })
    it("descuento porcentual no envía campos de precio", () => {
        const p = buildPricingRulePayload({ ...base, rule_type: "DISCOUNT_PERCENTAGE", fixed_price: "1218", fixed_price_gross: "1449", discount_percentage: "10" })
        expect(p).not.toHaveProperty("fixed_price")
        expect(p).not.toHaveProperty("fixed_price_gross")
    })
})
