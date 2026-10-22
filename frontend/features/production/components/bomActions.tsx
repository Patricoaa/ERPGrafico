import { createEntityActions } from '@/components/shared'
import type { BOM } from '../types'

export interface BOMActionsCtx {
    onEdit: (id: number) => void
    onDelete: (id: number) => void
}

export const bomActions = createEntityActions<
    BOM,
    BOMActionsCtx
>((item, ctx) => [
    { action: "edit", onClick: () => item.id != null && ctx.onEdit(item.id) },
    { action: "delete", onClick: () => item.id != null && ctx.onDelete(item.id) },
])
