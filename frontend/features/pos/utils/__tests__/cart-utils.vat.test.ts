import { describe, expect, it } from 'vitest'
import { calculateCartTotals } from '../cart-utils'
import type { CartItem } from '../../types'

const item = (total_gross: number, discount_amount = 0) =>
    ({ total_gross, discount_amount }) as unknown as CartItem

describe('calculateCartTotals con multiplicador explícito (ADR-0151)', () => {
    it('deriva el neto desde el bruto total con half-up', () => {
        const t = calculateCartTotals([item(1450)], 0, 1.19)
        expect(t).toMatchObject({ total_gross: 1450, total_net: 1218, total_tax: 232 })
    })

    it('aplica el descuento global antes de derivar el neto', () => {
        const t = calculateCartTotals([item(1000), item(500)], 50, 1.19)
        expect(t.total_gross).toBe(1450)
        expect(t.total_net).toBe(1218)
        expect(t.global_discount_total).toBe(50)
    })

    it('respeta una tasa distinta de 19%', () => {
        const t = calculateCartTotals([item(1100)], 0, 1.1)
        expect(t.total_net).toBe(1000)
    })
})
