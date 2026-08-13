import { createEntityFields } from '@/components/shared'
import { DataCell, Chip, type SubtitleItem } from '@/components/shared'
import type { Product } from '@/features/inventory/types'

function AvailabilityBadges({ product, inline = false }: { product: Product; inline?: boolean }) {
    const badges = (
        <>
            {product.can_be_sold && <Chip size="sm" intent="success">Venta</Chip>}
            {product.can_be_purchased && <Chip size="sm" intent="info">Compra</Chip>}
        </>
    )
    if (inline) {
        return <span className="inline-flex items-center gap-1 align-middle">{badges}</span>
    }
    return <div className="flex justify-center gap-1">{badges}</div>
}

export const productFields = createEntityFields<Product>()({
    internal_code: { key: 'internal_code', type: 'code', label: 'Código Interno' },
    code: { key: 'code', type: 'code', label: 'SKU' },
    name: {
        key: 'name',
        type: 'text',
        label: 'Nombre',
    },
    category_name: { key: 'category_name', type: 'secondary', label: 'Categoría' },
    product_type: {
        key: 'product_type',
        type: 'chip-category',
        domain: 'product_type',
        label: 'Tipo',
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
                <AvailabilityBadges product={p} />
                {!p.can_be_sold && !p.can_be_purchased && (
                    <span className="text-3xs text-muted-foreground italic">Ninguno</span>
                )}
            </div>
        ),
    },
}, {
    subtitle: {
        excludeKeys: ['name', 'availability'],
        renderer: (p): SubtitleItem[] => {
            const items: SubtitleItem[] = []
            if (p.name) items.push({ kind: 'text', content: p.name })
            if (p.can_be_sold || p.can_be_purchased) {
                if (items.length > 0) items.push({ kind: 'separator' })
                items.push({ kind: 'node', content: <AvailabilityBadges product={p} inline /> })
            }
            return items
        },
    },
})
