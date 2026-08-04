import { createEntityFields } from '@/components/shared'
import { DataCell, Chip } from '@/components/shared'
import type { Product } from '@/features/inventory/types'
import { translateProductType } from '@/lib/utils'

export const productFields = createEntityFields<Product>()({
    internal_code: { key: 'internal_code', type: 'code', label: 'Código Interno' },
    code: { key: 'code', type: 'code', label: 'SKU' },
    name: {
        key: 'name',
        type: 'text',
        label: 'Nombre',
    },
    category_name: { key: 'category_name', type: 'text', label: 'Categoría' },
    product_type: {
        key: 'product_type',
        type: 'text',
        label: 'Tipo',
        get: (p) => translateProductType(p.product_type),
    },
    total: {
        key: 'sale_price',
        type: 'computed',
        fieldRole: 'primary-value',
        label: 'Total (c/IVA)',
        placement: 'header',
        render: (p) => {
            if (p.is_dynamic_pricing) {
                return (
                    <div className="flex justify-center w-full">
                        <Chip size="xs" intent="warning">Dinámico</Chip>
                    </div>
                )
            }
            const total = p.sale_price_gross || Number(p.sale_price)
            return <DataCell.Currency value={total} />
        },
    },
    availability: {
        key: 'can_be_sold',
        type: 'computed',
        label: 'Disponible para',
        placement: 'subtitle',
        render: (p) => (
            <div className="flex justify-center gap-1">
                {p.can_be_sold && <Chip size="xs">Venta</Chip>}
                {p.can_be_purchased && <Chip size="xs">Compra</Chip>}
                {!p.can_be_sold && !p.can_be_purchased && (
                    <span className="text-[10px] text-muted-foreground italic">Ninguno</span>
                )}
            </div>
        ),
    },
})
