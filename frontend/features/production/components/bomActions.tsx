import { DataCell, createEntityActions } from '@/components/shared'
import type { BOMListItem } from './BOMClientView'

export interface BOMActionsCtx {
    onEdit: (id: number) => void
    onDelete: (id: number) => void
}

export const bomActions = createEntityActions<
    BOMListItem,
    BOMActionsCtx
>((item, ctx) => (
    <>
        <DataCell.Action action="edit" onClick={() => item.id != null && ctx.onEdit(item.id)} />
        <DataCell.Action action="delete" onClick={() => item.id != null && ctx.onDelete(item.id)} />
    </>
))
