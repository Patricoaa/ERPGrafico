import { createEntityActions } from '@/components/shared'
import type { UoMCategory } from './hooks/useUoMs'

export interface UoMCategoryActionsCtx {
    onEdit: (item: UoMCategory) => void
    onArchive: (item: UoMCategory) => void
}

export const uomCategoryActions = createEntityActions<
    UoMCategory,
    UoMCategoryActionsCtx
>((item, ctx) => [
    { action: "edit", onClick: () => ctx.onEdit(item) },
    { action: item.is_active ? "archive" : "restore", onClick: () => ctx.onArchive(item) },
])
