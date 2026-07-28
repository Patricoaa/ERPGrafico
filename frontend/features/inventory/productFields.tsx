import { createEntityFields } from '@/components/shared'
import { DataCell, Chip } from '@/components/shared'
import type { Product } from '@/features/inventory/types'
import { translateProductType } from '@/lib/utils'

export const productFields = createEntityFields<Product>()({
    internal_code: { key: 'internal_code', type: 'code', label: 'Código Interno', order: 10 },
    code: { key: 'code', type: 'code', label: 'SKU', order: 20 },
    name: {
        key: 'name',
        type: 'computed',
        label: 'Nombre',
        order: 25,
        render: (p) => (
            <div className="flex items-center justify-center w-full">
                <DataCell.Text>{p.name}</DataCell.Text>
            </div>
        ),
    },
    category_name: { key: 'category_name', type: 'text', label: 'Categoría', order: 30 },
    product_type: {
        key: 'product_type',
        type: 'text',
        label: 'Tipo',
        get: (p) => translateProductType(p.product_type),
        order: 40,
    },
    total: {
        key: 'sale_price',
        type: 'computed',
        fieldRole: 'primary-value',
        label: 'Total (c/IVA)',
        order: 50,
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
        type: 'chip',
        label: 'Disponible para',
        order: 60,
        placement: 'subtitle',
        get: (p) => {
            if (p.can_be_sold && p.can_be_purchased) return 'Venta y Compra'
            if (p.can_be_sold) return 'Venta'
            if (p.can_be_purchased) return 'Compra'
            return 'Ninguno'
        },
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
