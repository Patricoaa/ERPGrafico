import { createEntityFields } from '@/components/shared'
import { formatCurrency } from '@/lib/money'

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
    uom_abbreviation?: string
    uom_display_stock?: string
    uom_display_reserved?: string
    uom_display_available?: string
    unit_cost?: number | string
    total_value?: number | string
}

export type { StockReportItem }

export const stockReportFields = createEntityFields<StockReportItem>()({
    name: { key: 'name', type: 'text', label: 'Producto' },
    stock_qty: {
        key: 'stock_qty',
        type: 'number',
        label: 'Stock',
        suffix: (entity) => entity.uom_abbreviation || (entity.uom_name ?? ""),
    },
    qty_reserved: {
        key: 'qty_reserved',
        type: 'number',
        label: 'Reservado',
        suffix: (entity) => entity.uom_abbreviation || (entity.uom_name ?? ""),
    },
    qty_available: {
        key: 'qty_available',
        type: 'number',
        label: 'Disponible',
        suffix: (entity) => entity.uom_abbreviation || (entity.uom_name ?? ""),
    },
    total_value: {
        key: 'total_value',
        type: 'currency',
        label: 'Valorización',
        tooltip: (entity) => `${formatCurrency(entity.unit_cost ?? 0)} / ${entity.uom_abbreviation || entity.uom_name || ''}`,
    },
})
