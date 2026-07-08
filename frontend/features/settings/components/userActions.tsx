import { DataCell, createEntityActions } from '@/components/shared'
import type { AppUser } from '@/types/entities'

export interface UserActionsCtx {
    onEdit: (id: number) => void
}

export const userActions = createEntityActions<
    AppUser,
    UserActionsCtx
>((item, ctx) => (
    <DataCell.Action action="edit" onClick={() => ctx.onEdit(item.id)} />
))
