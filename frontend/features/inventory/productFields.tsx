import { createEntityFields } from '@/components/shared'
import { DataCell, Chip, StatusBadge } from '@/components/shared'
import type { Product } from '@/features/inventory/types'
import { translateProductType } from '@/lib/utils'
import { PricingUtils } from '@/lib/pricing-utils'

export const productFields = createEntityFields<Product>()({
    internal_code: { key: 'internal_code', type: 'code', label: 'Código Interno', order: 10 },
    code: { key: 'code', type: 'code', label: 'SKU', order: 20 },
    name: {
        key: 'name',
        type: 'computed',
        label: 'Nombre',
        order: 25,
        render: (p) => (
            <div className="flex items-center justify-center gap-2 w-full">
                <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                        <DataCell.Text>{p.name}</DataCell.Text>
                        {!p.is_active && (
                            <StatusBadge status="inactive" label="ARCHIVADO" size="sm" className="h-3.5" />
                        )}
                    </div>
                </div>
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
    salePrice: {
        key: 'sale_price',
        type: 'computed',
        label: 'Neto',
        order: 50,
        render: (p) => {
            if (p.is_dynamic_pricing) {
                return (
                    <div className="flex justify-center w-full">
                        <Chip size="xs" intent="warning">Dinámico</Chip>
                    </div>
                )
            }
            return <DataCell.Currency value={Number(p.sale_price)} />
        },
    },
    tax: {
        key: 'sale_price',
        type: 'computed',
        label: 'IVA',
        order: 55,
        render: (p) => {
            if (p.is_dynamic_pricing) {
                return (
                    <div className="flex justify-center w-full">
                        <Chip size="xs" intent="warning">Dinámico</Chip>
                    </div>
                )
            }
            const tax = PricingUtils.calculateTax(Number(p.sale_price))
            return <DataCell.Currency value={tax} />
        },
    },
    total: {
        key: 'sale_price',
        type: 'computed',
        label: 'Total (c/IVA)',
        order: 57,
        render: (p) => {
            if (p.is_dynamic_pricing) {
                return (
                    <div className="flex justify-center w-full">
                        <Chip size="xs" intent="warning">Dinámico</Chip>
                    </div>
                )
            }
            const total = p.sale_price_gross || PricingUtils.netToGross(Number(p.sale_price))
            return <DataCell.Currency value={total} />
        },
    },
    availability: {
        key: 'can_be_sold',
        type: 'computed',
        label: 'Disponible para',
        order: 60,
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
    isActive: {
        key: 'is_active',
        type: 'status',
        label: 'Estado',
        get: (p) => p.is_active ? 'active' : 'inactive',
        surfaces: ['table'],
        order: 70,
    },
})
