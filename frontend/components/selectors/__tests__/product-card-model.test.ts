import { describe, expect, it } from 'vitest'
import type { BaseProduct } from '@/features/inventory'
import {
    getProductCardModel,
    pluralizeEs,
    variantChipLabel,
    type ProductCardContext,
} from '../ProductGridPicker/product-card-model'

const ctx: ProductCardContext = { isDisabled: false }

function product(overrides: Partial<BaseProduct>): BaseProduct {
    return { id: 1, code: 'PAP-014', name: 'Papel offset blanco 90 g', sale_price: 1000, uom_name: 'Pliego', ...overrides }
}

describe('pluralizeEs', () => {
    it.each([
        ['Gramaje', 'gramajes'],
        ['Color', 'colores'],
        ['Papel', 'papeles'],
        ['Luz', 'luces'],
        ['Tamaño', 'tamaños'],
    ])('%s → %s', (word, expected) => {
        expect(pluralizeEs(word)).toBe(expected)
    })
})

describe('variantChipLabel', () => {
    it('uses the shared attribute, pluralised', () => expect(variantChipLabel(4, 'Gramaje')).toBe('4 gramajes'))
    it('falls back to "variantes" when attributes are mixed', () => expect(variantChipLabel(6, null)).toBe('6 variantes'))
    it('keeps singular for one', () => {
        expect(variantChipLabel(1, 'Gramaje')).toBe('1 gramaje')
        expect(variantChipLabel(1)).toBe('1 variante')
    })
})

describe('getProductCardModel · availability', () => {
    it('storable with stock', () => {
        const model = getProductCardModel(product({ product_type: 'STORABLE', qty_available: 3600 }), ctx)
        expect(model.availability).toEqual({ text: '3.600 pliego disponibles', tone: 'ok', icon: 'stock' })
    })

    it('storable without stock', () => {
        const model = getProductCardModel(product({ product_type: 'STORABLE', qty_available: 0 }), ctx)
        expect(model.availability).toMatchObject({ text: 'Sin existencias', tone: 'none' })
    })

    it('POS branch limit replaces qty_available instead of adding to it', () => {
        const model = getProductCardModel(product({ product_type: 'STORABLE', qty_available: 3600 }), { ...ctx, limit: 250 })
        expect(model.availability?.text).toBe('250 pliego disponibles')
    })

    it('limit of zero reads as out of stock even when qty_available is positive', () => {
        const model = getProductCardModel(product({ product_type: 'STORABLE', qty_available: 10 }), { ...ctx, limit: 0 })
        expect(model.availability?.text).toBe('Sin existencias')
    })

    it('express manufacturable without BOM', () => {
        const model = getProductCardModel(product({ product_type: 'MANUFACTURABLE', mfg_auto_finalize: true, has_bom: false }), ctx)
        expect(model.availability).toMatchObject({ text: 'Sin lista de materiales', tone: 'neutral' })
    })

    it('express manufacturable with BOM reports makeable quantity', () => {
        const model = getProductCardModel(
            product({ product_type: 'MANUFACTURABLE', mfg_auto_finalize: true, has_bom: true, manufacturable_quantity: 12 }),
            ctx,
        )
        expect(model.availability).toMatchObject({ text: '12 fabricables', tone: 'ok' })
    })

    it('advanced manufacturable with BOM but nothing makeable warns instead of blocking', () => {
        const model = getProductCardModel(
            product({ product_type: 'MANUFACTURABLE', requires_advanced_manufacturing: true, has_bom: true, manufacturable_quantity: 0 }),
            ctx,
        )
        expect(model.availability).toMatchObject({ text: '0 fabricables', tone: 'warning' })
    })

    it('simple manufacturable behaves like stock', () => {
        const model = getProductCardModel(product({ product_type: 'MANUFACTURABLE', qty_available: 5 }), ctx)
        expect(model.availability?.tone).toBe('ok')
    })

    it('services are on demand', () => {
        expect(getProductCardModel(product({ product_type: 'SERVICE' }), ctx).availability?.text).toBe('Servicio · bajo demanda')
    })

    it('templates defer availability to their variants', () => {
        const model = getProductCardModel(product({ product_type: 'STORABLE', has_variants: true, qty_available: 0 }), ctx)
        expect(model.availability?.text).toBe('Disponibilidad por variante')
    })
})

describe('getProductCardModel · action', () => {
    it('add for a plain product', () => expect(getProductCardModel(product({}), ctx).action).toBe('add'))
    it('configure for templates', () => expect(getProductCardModel(product({ has_variants: true }), ctx).action).toBe('configure'))
    it('configure for dynamic pricing', () => expect(getProductCardModel(product({ is_dynamic_pricing: true }), ctx).action).toBe('configure'))
    it('unavailable wins over everything else', () => {
        expect(getProductCardModel(product({ has_variants: true }), { isDisabled: true }).action).toBe('unavailable')
    })
})

describe('getProductCardModel · price', () => {
    it('fixed price is shown c/IVA with the lowercase unit', () => {
        const { price } = getProductCardModel(product({ sale_price: '1000' }), ctx)
        expect(price).toEqual({ kind: 'fixed', gross: 1190, unit: 'pliego' })
    })

    it('templates show "desde" using the cheapest variant', () => {
        const { price } = getProductCardModel(product({ has_variants: true, sale_price: 1000, min_variant_price: '480' }), ctx)
        expect(price).toMatchObject({ kind: 'from', gross: 571 })
    })

    it('templates without a variant price fall back to the template price', () => {
        const { price } = getProductCardModel(product({ has_variants: true, sale_price: 1000, min_variant_price: null }), ctx)
        expect(price).toMatchObject({ kind: 'fixed', gross: 1190 })
    })

    it('dynamic pricing with a base price reads "desde"', () => {
        const { price, isDynamicPricing } = getProductCardModel(product({ is_dynamic_pricing: true, sale_price: '850' }), ctx)
        expect(isDynamicPricing).toBe(true)
        expect(price).toMatchObject({ kind: 'from', gross: 1012 })
    })

    it('dynamic pricing without a base price is pending', () => {
        const { price } = getProductCardModel(product({ is_dynamic_pricing: true, sale_price: '0' }), ctx)
        expect(price).toEqual({ kind: 'pending', gross: null, unit: 'pliego' })
    })
})

describe('getProductCardModel · identity', () => {
    it('prefers internal_code over code', () => {
        expect(getProductCardModel(product({ internal_code: 'P-0001' }), ctx).code).toBe('P-0001')
        expect(getProductCardModel(product({}), ctx).code).toBe('PAP-014')
    })

    it('only templates get a variant chip', () => {
        expect(getProductCardModel(product({}), ctx).variantChip).toBeNull()
        const model = getProductCardModel(product({ has_variants: true, variants_count: 4, variant_axis_label: 'Gramaje' }), ctx)
        expect(model.variantChip).toBe('4 gramajes')
    })
})
