import { DataCell, createEntityActions } from '@/components/shared'
import type { UoMCategory } from '@/features/inventory/hooks/useUoMs'

export interface UoMCategoryActionsCtx {
    onEdit: (item: UoMCategory) => void
    onDelete: (id: number) => void
}

export const uomCategoryActions = createEntityActions<
    UoMCategory,
    UoMCategoryActionsCtx
>((item, ctx) => (
    <>
        <DataCell.Action action="edit" onClick={() => ctx.onEdit(item)} />
        <DataCell.Action action="delete" onClick={() => ctx.onDelete(item.id)} />
    </>
))
