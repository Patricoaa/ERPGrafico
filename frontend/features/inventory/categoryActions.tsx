import { DataCell, createEntityActions } from '@/components/shared'
import type { Category } from '@/features/inventory/hooks/useCategories'

export interface CategoryActionsCtx {
    onEdit: (id: number) => void
    onDelete: (category: Category) => void
}

export const categoryActions = createEntityActions<
    Category,
    CategoryActionsCtx
>((item, ctx) => (
    <>
        <DataCell.Action action="edit" onClick={() => ctx.onEdit(item.id)} />
        <DataCell.Action action="delete" onClick={() => ctx.onDelete(item)} />
    </>
))
