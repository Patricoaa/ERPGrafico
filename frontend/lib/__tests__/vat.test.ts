import { describe, expect, it } from "vitest"

import cases from "../../../shared/vat-rounding-cases.json"
import { PricingUtils } from "../pricing-utils"
import { grossFromNet, netFromGross, salePriceFromGross } from "../vat"

const multiplier = Number(cases.multiplier)

describe("vat.ts paridad con backend (ADR-0151)", () => {
    it.each(cases.gross_to_net)("netFromGross($gross) = $net", ({ gross, net }) => {
        expect(netFromGross(gross, multiplier)).toBe(net)
    })

    it.each(cases.net_to_gross)("grossFromNet($net) = $gross", ({ net, gross }) => {
        expect(grossFromNet(net, multiplier)).toBe(gross)
    })

    it("salePriceFromGross redondea el bruto y deriva el neto desde él", () => {
        expect(salePriceFromGross(1449.6, multiplier)).toEqual({ gross: 1450, net: 1218 })
    })

    it("PricingUtils delega en vat.ts", () => {
        expect(PricingUtils.netToGross(1218, 0.19)).toBe(grossFromNet(1218, 1.19))
        expect(PricingUtils.grossToNet(1450, 0.19)).toBe(netFromGross(1450, 1.19))
        for (const c of cases.net_to_gross) {
            expect(PricingUtils.netToGross(c.net, 0.19)).toBe(c.gross)
        }
        for (const c of cases.gross_to_net) {
            expect(PricingUtils.grossToNet(c.gross, 0.19)).toBe(c.net)
        }
    })
})

describe("vat.ts con decimales (compras, solo frontend)", () => {
    it("netFromGross redondea half-up a 2 decimales", () => {
        expect(netFromGross(1190, 1.19, { decimals: 2 })).toBe(1000)
        expect(netFromGross(100, 1.19, { decimals: 2 })).toBe(84.03)
        expect(netFromGross(1.19, 1.19, { decimals: 2 })).toBe(1)
        expect(netFromGross(0.1785, 1.19, { decimals: 2 })).toBe(0.15)
        expect(netFromGross(1.785, 1.19, { decimals: 2 })).toBe(1.5)
        // 0.00595 / 1.19 = 0.005 exacto: half-up sube al centavo
        expect(netFromGross(0.00595, 1.19, { decimals: 2 })).toBe(0.01)
    })

    it("grossFromNet redondea half-up a 2 decimales", () => {
        expect(grossFromNet(84.03, 1.19, { decimals: 2 })).toBe(100)
        expect(grossFromNet(0.01, 1.19, { decimals: 2 })).toBe(0.01)
        expect(grossFromNet(0.5, 1.19, { decimals: 2 })).toBe(0.6)
        expect(grossFromNet(1000, 1.19, { decimals: 2 })).toBe(1190)
    })

    it("decimals 0 equivale al camino entero", () => {
        expect(netFromGross(1450, 1.19, { decimals: 0 })).toBe(netFromGross(1450, 1.19))
    })
})
