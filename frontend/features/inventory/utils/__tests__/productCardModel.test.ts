import { describe, it, expect } from 'vitest'
import { getPrice } from '../productCardModel'
import type { BaseProduct } from '../../types'

const base = (over: Partial<BaseProduct>): BaseProduct => ({
    id: 1,
    name: 'Producto',
    sale_price: '0',
    ...over,
} as BaseProduct)

describe('getPrice (ADR-0151: muestra el bruto de la API sin convertir)', () => {
    it('regresion 1450/1449: neto 1218 con bruto 1450 muestra 1450', () => {
        const price = getPrice(base({ sale_price: '1218', sale_price_gross: '1450' }))
        expect(price).toMatchObject({ kind: 'fixed', gross: 1450 })
    })

    it('plantilla con variantes usa min_variant_price_gross', () => {
        const price = getPrice(base({
            has_variants: true,
            sale_price: '0',
            min_variant_price: '1723',
            min_variant_price_gross: '2050',
        }))
        expect(price).toMatchObject({ kind: 'from', gross: 2050 })
    })

    it('sin bruto no convierte el neto: muestra 0', () => {
        const price = getPrice(base({ sale_price: '1218' }))
        expect(price).toMatchObject({ kind: 'fixed', gross: 0 })
    })

    it('precio dinamico no tiene bruto', () => {
        expect(getPrice(base({ is_dynamic_pricing: true, sale_price_gross: '100' })))
            .toMatchObject({ kind: 'dynamic', gross: null })
    })
})
