import { createEntityActions } from '@/components/shared'
import type { UoM } from './hooks/useUoMs'

export interface UoMActionsCtx {
    onEdit: (id: number) => void
    onDelete: (id: number) => void
}

export const uomActions = createEntityActions<
    UoM,
    UoMActionsCtx
>((item, ctx) => [
    { action: "edit", onClick: () => ctx.onEdit(item.id) },
    { action: "delete", onClick: () => ctx.onDelete(item.id) },
])
