import { DataCell, createEntityActions } from '@/components/shared'
import type { UoM } from '@/features/inventory/hooks/useUoMs'

export interface UoMActionsCtx {
    onEdit: (id: number) => void
    onDelete: (id: number) => void
}

export const uomActions = createEntityActions<
    UoM,
    UoMActionsCtx
>((item, ctx) => (
    <>
        <DataCell.Action action="edit" onClick={() => ctx.onEdit(item.id)} />
        <DataCell.Action action="delete" onClick={() => ctx.onDelete(item.id)} />
    </>
))
