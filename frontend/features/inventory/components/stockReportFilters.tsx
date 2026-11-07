"use client"

import { useQueryState, parseAsString } from 'nuqs'
import { CategorySelector } from '@/components/selectors/CategorySelector'
import { WarehouseSelector } from '@/components/selectors/WarehouseSelector'

export function StockReportCategorySelector() {
    const [categoryParam, setCategoryParam] = useQueryState('category', parseAsString)

    return (
        <CategorySelector
            variant="inline"
            placeholder="Categoría"
            value={categoryParam}
            onChange={(val) => setCategoryParam(val)}
            allowNone
            noneLabel="Todas las categorías"
            showPlusButton={false}
        />
    )
}

export function StockReportWarehouseSelector() {
    const [warehouseParam, setWarehouseParam] = useQueryState('warehouse_id', parseAsString)

    return (
        <WarehouseSelector
            variant="inline"
            placeholder="Bodega"
            value={warehouseParam}
            onChange={(val) => setWarehouseParam(val)}
            allowNone
            noneLabel="Todas las bodegas"
        />
    )
}
