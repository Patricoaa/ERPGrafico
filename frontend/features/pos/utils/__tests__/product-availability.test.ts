import { describe, it, expect } from 'vitest'
import { isPOSProductDisabled } from '../product-availability'
import type { Product } from '../../types'

function makeProduct(overrides: Partial<Product>): Product {
    return {
        id: 1,
        code: 'P1',
        name: 'Producto',
        sale_price: 100,
        sale_price_gross: 119,
        product_type: 'STORABLE',
        qty_available: 0,
        ...overrides,
    } as Product
}

describe('isPOSProductDisabled', () => {
    it('STORABLE con stock disponible queda habilitado', () => {
        expect(isPOSProductDisabled(makeProduct({ product_type: 'STORABLE', qty_available: 5 }))).toBe(false)
    })

    it('STORABLE sin stock queda deshabilitado', () => {
        expect(isPOSProductDisabled(makeProduct({ product_type: 'STORABLE', qty_available: 0 }))).toBe(true)
    })

    it('MANUFACTURABLE SIMPLE sin stock queda deshabilitado', () => {
        expect(isPOSProductDisabled(makeProduct({
            product_type: 'MANUFACTURABLE',
            requires_advanced_manufacturing: false,
            mfg_auto_finalize: false,
            has_bom: false,
            qty_available: 0,
        }))).toBe(true)
    })

    it('MANUFACTURABLE SIMPLE con stock queda habilitado', () => {
        expect(isPOSProductDisabled(makeProduct({
            product_type: 'MANUFACTURABLE',
            requires_advanced_manufacturing: false,
            mfg_auto_finalize: false,
            has_bom: false,
            qty_available: 10,
        }))).toBe(false)
    })

    it('MANUFACTURABLE ADVANCED nunca se deshabilita aunque qty_available sea 0', () => {
        expect(isPOSProductDisabled(makeProduct({
            product_type: 'MANUFACTURABLE',
            requires_advanced_manufacturing: true,
            qty_available: 0,
        }))).toBe(false)
    })

    it('MANUFACTURABLE EXPRESS con BOM y manufacturable_quantity > 0 queda habilitado', () => {
        expect(isPOSProductDisabled(makeProduct({
            product_type: 'MANUFACTURABLE',
            requires_advanced_manufacturing: false,
            mfg_auto_finalize: true,
            has_bom: true,
            manufacturable_quantity: 12535,
            qty_available: 0,
        }))).toBe(false)
    })

    it('MANUFACTURABLE EXPRESS sin BOM queda deshabilitado', () => {
        expect(isPOSProductDisabled(makeProduct({
            product_type: 'MANUFACTURABLE',
            requires_advanced_manufacturing: false,
            mfg_auto_finalize: true,
            has_bom: false,
        }))).toBe(true)
    })

    it('MANUFACTURABLE EXPRESS con BOM pero sin componentes queda deshabilitado', () => {
        expect(isPOSProductDisabled(makeProduct({
            product_type: 'MANUFACTURABLE',
            requires_advanced_manufacturing: false,
            mfg_auto_finalize: true,
            has_bom: true,
            manufacturable_quantity: 0,
        }))).toBe(true)
    })

    it('plantilla con variantes nunca se deshabilita en la grilla', () => {
        expect(isPOSProductDisabled(makeProduct({
            product_type: 'MANUFACTURABLE',
            has_variants: true,
            requires_advanced_manufacturing: true,
            qty_available: 0,
        }))).toBe(false)

        expect(isPOSProductDisabled(makeProduct({
            product_type: 'MANUFACTURABLE',
            has_variants: true,
            mfg_auto_finalize: true,
            has_bom: true,
            manufacturable_quantity: 0,
            qty_available: 0,
        }))).toBe(false)
    })

    it('SERVICE / CONSUMABLE / SUBSCRIPTION nunca se deshabilitan', () => {
        for (const productType of ['SERVICE', 'CONSUMABLE', 'SUBSCRIPTION'] as const) {
            expect(isPOSProductDisabled(makeProduct({ product_type: productType }))).toBe(false)
        }
    })

    it('flags de manufactura ausentes: fail open en vez de deshabilitar el catálogo', () => {
        expect(isPOSProductDisabled(makeProduct({
            product_type: 'MANUFACTURABLE',
            qty_available: 0,
        }))).toBe(false)
    })
})
