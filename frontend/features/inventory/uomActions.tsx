import { createEntityActions } from '@/components/shared'
import type { UoM } from './hooks/useUoMs'

export interface UoMActionsCtx {
    onEdit: (id: number) => void
    onArchive: (item: UoM) => void
}

export const uomActions = createEntityActions<
    UoM,
    UoMActionsCtx
>((item, ctx) => [
    { action: "edit", onClick: () => ctx.onEdit(item.id) },
    { action: item.is_active ? "archive" : "restore", onClick: () => ctx.onArchive(item) },
])
