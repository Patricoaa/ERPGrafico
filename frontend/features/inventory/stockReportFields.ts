import { createEntityFields } from '@/components/shared'
import { cn } from '@/lib/utils'

interface StockReportItem {
    id: number | string
    name?: string
    code?: string
    internal_code?: string
    category_id?: number | string
    category_name?: string
    stock_qty?: number | string
    qty_reserved?: number | string
    qty_available?: number | string
    uom_name?: string
    unit_cost?: number | string
    total_value?: number | string
}

export type { StockReportItem }

export const stockReportFields = createEntityFields<StockReportItem>()({
    category_name: { key: 'category_name', type: 'text', label: 'Categoría' },
    stock_qty: {
        key: 'stock_qty',
        type: 'number',
        label: 'Stock',
        cardPlacement: 'metric',
        className: (value) => {
            const qty = Number(value)
            return cn(
                "text-[14px]",
                qty <= 0 ? "text-destructive" : qty < 10 ? "text-warning" : "text-foreground/80"
            )
        },
        suffix: (entity) => entity.uom_name ?? "",
    },
    qty_reserved: {
        key: 'qty_reserved',
        type: 'number',
        label: 'Reservado',
        suffix: (entity) => entity.uom_name ?? "",
    },
    qty_available: {
        key: 'qty_available',
        type: 'number',
        label: 'Disponible',
        cardPlacement: 'metric',
        className: (value) => {
            const qty = Number(value)
            return cn(
                "text-[14px]",
                qty <= 0 ? "text-destructive" : "text-primary font-black"
            )
        },
        suffix: (entity) => entity.uom_name ?? "",
    },
    total_value: {
        key: 'total_value',
        type: 'currency',
        label: 'Valorización',
        cardPlacement: 'metric',
    },
})
