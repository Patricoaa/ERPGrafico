import { createEntityActions } from '@/components/shared'
import type { Warehouse } from './hooks/useWarehouses'

export interface WarehouseActionsCtx {
    onEdit: (id: number) => void
    onArchive: (warehouse: Warehouse) => void
}

export const warehouseActions = createEntityActions<
    Warehouse,
    WarehouseActionsCtx
>((item, ctx) => [
    { action: "edit", onClick: () => ctx.onEdit(item.id) },
    { action: item.is_active ? "archive" : "restore", onClick: () => ctx.onArchive(item) },
])
