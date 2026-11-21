import { describe, it, expect } from "vitest"
import { fromTypedNet, fromTypedGross, uomPricesGrossPayload, variantQuickEditPayload } from "../grossPricePayload"

describe("grossPricePayload (ADR-0151)", () => {
    it("neto 1218 -> bruto 1449 y neto mostrado derivado del bruto", () => {
        expect(fromTypedNet(1218, 1.19)).toEqual({ gross: 1449, net: 1218 })
    })
    it("bruto 1450 -> neto 1218", () => {
        expect(fromTypedGross(1450, 1.19)).toEqual({ gross: 1450, net: 1218 })
    })
    it("filas UoM envían solo price_gross", () => {
        const out = uomPricesGrossPayload([{ id: 3, uom: 2, price_gross: 1450 }])
        expect(out).toEqual([{ id: 3, uom: 2, price_gross: 1450 }])
        expect(out[0]).not.toHaveProperty("price_net")
    })
    it("variante OVERRIDE envía solo sale_price_gross", () => {
        const p = variantQuickEditPayload({ price_inheritance_mode: "OVERRIDE", sale_price_gross: 1450, code: "V", sale_uom: 1 })
        expect(p).toMatchObject({ sale_price_gross: 1450, price_surcharge_gross: null })
        expect(p).not.toHaveProperty("sale_price")
        expect(p).not.toHaveProperty("price_surcharge")
    })
    it("variante SURCHARGE envía solo price_surcharge_gross", () => {
        const p = variantQuickEditPayload({ price_inheritance_mode: "SURCHARGE", sale_price_gross: 0, price_surcharge_gross: 1449, code: "V", sale_uom: 1 })
        expect(p.price_surcharge_gross).toBe(1449)
        expect(p).not.toHaveProperty("sale_price_gross")
        expect(p).not.toHaveProperty("price_surcharge")
    })
})
