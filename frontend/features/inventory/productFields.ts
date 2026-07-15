import { createEntityFields } from '@/components/shared'
import type { Product } from '@/features/inventory/types'

export const productFields = createEntityFields<Product>()({
    internal_code: { key: 'internal_code', type: 'code', label: 'Código Interno' },
    code: { key: 'code', type: 'code', label: 'SKU' },
    category_name: { key: 'category_name', type: 'text', label: 'Categoría' },
})
