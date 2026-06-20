import { DataCell, createEntityActions } from '@/components/shared'
import type { Group } from "../api/types"

export interface GroupActionsCtx {
    onEdit: (group: Group) => void
    onDelete: (id: number) => void
}

export const groupActions = createEntityActions<Group, GroupActionsCtx>(
    (item, ctx) => (
        <>
            <DataCell.Action action="edit" onClick={() => ctx.onEdit(item)} />
            <DataCell.Action action="delete" onClick={() => ctx.onDelete(item.id)} />
        </>
    )
)
