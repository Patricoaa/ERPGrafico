import { DataCell, createEntityActions } from '@/components/shared'
import type { BOMListItem } from './BOMsPageClient'

export interface BOMActionsCtx {
    onEdit: (id: number) => void
    onDelete: (id: number) => void
}

export const bomActions = createEntityActions<
    BOMListItem,
    BOMActionsCtx
>((item, ctx) => (
    <>
        <DataCell.Action action="edit" onClick={() => ctx.onEdit(item.id!)} />
        <DataCell.Action action="delete" onClick={() => ctx.onDelete(item.id!)} />
    </>
))
