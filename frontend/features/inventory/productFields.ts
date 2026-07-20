import { createEntityFields } from '@/components/shared'
import type { Product } from '@/features/inventory/types'
import { translateProductType } from '@/lib/utils'
import { PricingUtils } from '@/lib/pricing-utils'

export const productFields = createEntityFields<Product>()({
    internal_code: { key: 'internal_code', type: 'code', label: 'Código Interno' },
    code: { key: 'code', type: 'code', label: 'SKU' },
    category_name: { key: 'category_name', type: 'text', label: 'Categoría' },
    product_type: { key: 'product_type', type: 'text', label: 'Tipo', get: (p) => translateProductType(p.product_type) },
    salePrice: {
        key: 'sale_price',
        type: 'currency',
        label: 'Total',
        get: (p) => p.is_dynamic_pricing ? null : Number(p.sale_price_gross || PricingUtils.netToGross(Number(p.sale_price))),
    },
    isDynamicPricing: {
        key: 'is_dynamic_pricing',
        type: 'chip',
        label: '',
        get: (p) => p.is_dynamic_pricing ? 'Dinámico' : null,
        intent: 'warning',
    },
}, {
    title: { field: 'name' },
})
