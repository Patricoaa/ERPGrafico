import { DataCell, createEntityActions } from '@/components/shared'
import type { Warehouse } from './hooks/useWarehouses'

export interface WarehouseActionsCtx {
    onEdit: (id: number) => void
    onDelete: (warehouse: Warehouse) => void
}

export const warehouseActions = createEntityActions<
    Warehouse,
    WarehouseActionsCtx
>((item, ctx) => (
    <>
        <DataCell.Action action="edit" onClick={() => ctx.onEdit(item.id)} />
        <DataCell.Action action="delete" onClick={() => ctx.onDelete(item)} />
    </>
))
