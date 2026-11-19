import { describe, expect, it } from 'vitest'
import { suggestedUnitCost } from '../suggestedUnitCost'

describe('suggestedUnitCost', () => {
    it('prefiere el último precio de compra', () => {
        expect(suggestedUnitCost({ last_purchase_price: '1500.5', cost_price: 900 })).toBe(1500.5)
    })

    it('usa cost_price cuando no hay historial de compras', () => {
        expect(suggestedUnitCost({ last_purchase_price: 0, cost_price: '900' })).toBe(900)
        expect(suggestedUnitCost({ cost_price: 900 })).toBe(900)
    })

    it('devuelve 0 si no hay ninguno', () => {
        expect(suggestedUnitCost({})).toBe(0)
    })
})
