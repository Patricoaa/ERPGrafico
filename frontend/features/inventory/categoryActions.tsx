import { createEntityActions } from '@/components/shared'
import type { Category } from './hooks/useCategories'

export interface CategoryActionsCtx {
    onEdit: (id: number) => void
    onArchive: (category: Category) => void
}

export const categoryActions = createEntityActions<
    Category,
    CategoryActionsCtx
>((item, ctx) => [
    { action: "edit", onClick: () => ctx.onEdit(item.id) },
    { action: item.is_active ? "archive" : "restore", onClick: () => ctx.onArchive(item) },
])
